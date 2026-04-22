import { jsPDF } from "jspdf";
import { removeDiacritics } from "@/lib/utils";

export interface BaggageAllowance {
  cabin_bag?: { included?: boolean; kg?: number; count?: number };
  hand_luggage?: { included?: boolean; kg?: number; count?: number };
  checked_luggage?: { included?: boolean; kg?: number; count?: number };
  golf_bag?: { included?: boolean; kg?: number; count?: number };
}

export interface LogoInfo {
  base64: string;
  w: number;
  h: number;
}

interface VoucherPdfTraveler {
  client_id: string;
  is_main_client: boolean;
  clients: { first_name: string; last_name: string };
}

const normalizePdfInlineText = (value?: string | null) => {
  if (!value) return "";
  return removeDiacritics(value)
    .replace(/\s*[\r\n]+\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(,\s*){2,}/g, ", ")
    .replace(/^,\s*|,\s*$/g, "")
    .trim();
};

export const buildVoucherPdfBlob = (
  voucher: any,
  supplierName?: string,
  supplierData?: { contact_person?: string | null; email?: string | null; phone?: string | null; address?: string | null } | null,
  logoInfo?: LogoInfo,
  travelers?: VoucherPdfTraveler[],
  baggage?: BaggageAllowance | null
): Blob => {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const W = 210;
  const margin = 15;
  const contentW = W - margin * 2;
  let y = 0;

  const fmtD = (d: string) => {
    if (!d) return "";
    const parts = d.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0].slice(2)}`;
    return d;
  };

  // ── HEADER ──
  y = margin;
  const logoW = 30;
  const aspectRatio = logoInfo ? (logoInfo.w / logoInfo.h) : (260 / 123);
  const logoH = logoW / aspectRatio;
  if (logoInfo?.base64) {
    try {
      doc.addImage(logoInfo.base64, "PNG", margin, y, logoW, logoH, undefined, "NONE");
    } catch { /* skip */ }
  }
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text(`TRAVEL VOUCHER · ${voucher.voucher_code}`, W - margin, y + 11, { align: "right" });
  y += logoH + 3;
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.3);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ── SERVICE PROVIDER ──
  if (supplierName) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("SERVICE PROVIDER", margin, y);
    y += 4.5;

    doc.setTextColor(15, 23, 42);
    const supplierNameClean = normalizePdfInlineText(supplierName);
    const addressInline = normalizePdfInlineText(supplierData?.address);
    const addressText = addressInline ? `, ${addressInline}` : "";

    const getProviderLineWidth = () => {
      doc.setFont("helvetica", "bold");
      const nameWidth = supplierNameClean ? doc.getTextWidth(supplierNameClean) : 0;
      doc.setFont("helvetica", "normal");
      const addressWidth = addressText ? doc.getTextWidth(addressText) : 0;
      return nameWidth + addressWidth;
    };

    let providerFontSize = 9;
    doc.setFontSize(providerFontSize);
    while (providerFontSize > 5 && getProviderLineWidth() > contentW) {
      providerFontSize -= 0.5;
      doc.setFontSize(providerFontSize);
    }

    doc.setFont("helvetica", "bold");
    doc.text(supplierNameClean, margin, y);
    if (addressText) {
      const nameW = doc.getTextWidth(supplierNameClean);
      doc.setFont("helvetica", "normal");
      doc.text(addressText, margin + nameW, y);
    }
    y += 4.5;

    const contactParts: string[] = [];
    if (supplierData?.phone) contactParts.push(`Phone: ${supplierData.phone}`);
    if (supplierData?.email) contactParts.push(supplierData.email);
    if (contactParts.length > 0) {
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(contactParts.join(", "), margin, y);
      y += 4.5;
    }

    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, W - margin, y);
    y += 6;
  }

  // ── CLIENT INFORMATION ──
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("CLIENT INFORMATION", margin, y);
  y += 4;

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  const mainTraveler = travelers?.find(t => t.is_main_client);
  const mainClientName = mainTraveler
    ? `${mainTraveler.clients.first_name} ${mainTraveler.clients.last_name}`
    : voucher.client_name || "";

  doc.setFont("helvetica", "bold");
  doc.text("Main Client:", margin, y);
  const mainLabelW = doc.getTextWidth("Main Client:") + 3;
  const namesX = margin + mainLabelW;
  doc.setFont("helvetica", "normal");
  doc.text(`1. ${removeDiacritics(mainClientName)}`, namesX, y);
  y += 5;

  const others: string[] = (voucher.other_travelers as string[]) || [];
  if (others.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.text("Others:", margin, y);
    doc.setFont("helvetica", "normal");
    const colW = (W - margin - namesX) / 3;
    let col = 0;
    let rowY = y;
    others.forEach((n, i) => {
      const xPos = namesX + col * colW;
      doc.text(`${i + 2}. ${removeDiacritics(n)}`, xPos, rowY);
      col++;
      if (col >= 3) {
        col = 0;
        rowY += 4.5;
      }
    });
    y = rowY + (col > 0 ? 4.5 : 0);
    y -= 1;
  }
  y += 4;
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ── SERVICE OVERVIEW ──
  const rawServices = (voucher.services as any[]) || [];
  const serviceMap = new Map<string, any>();
  for (const s of rawServices) {
    const name = s.name || s.service || "";
    const key = `${name}||${s.dateFrom || ""}||${s.dateTo || ""}`;
    if (serviceMap.has(key)) {
      const existing = serviceMap.get(key);
      existing.pax = (Number(existing.pax || existing.person_count || 0) + Number(s.pax || s.person_count || 0)) || existing.pax;
      existing.qty = (Number(existing.qty || 1) + Number(s.qty || 1));
    } else {
      serviceMap.set(key, { ...s });
    }
  }
  const services = Array.from(serviceMap.values());

  if (services.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("SERVICE OVERVIEW", margin, y);
    y += 4;

    const colPax = margin;
    const colQty = margin + 13;
    const colService = margin + 24;
    const colFrom = margin + 128;
    const colTo = margin + 153;
    const rowH = 6;

    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentW, rowH, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("PAX", colPax + 2, y + 4);
    doc.text("Qtd.", colQty + 1, y + 4);
    doc.text("Service", colService + 2, y + 4);
    doc.text("Date From", colFrom, y + 4);
    doc.text("Date To", colTo + 2, y + 4);
    y += rowH;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(15, 23, 42);
    let rowAlt = false;
    for (const s of services) {
      const serviceName = s.name || s.service || "";
      const nameLines = doc.splitTextToSize(removeDiacritics(serviceName), 100);
      const cellH = Math.max(rowH, nameLines.length * 4.5);
      if (y + cellH > 270) { doc.addPage(); y = margin; }
      if (rowAlt) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentW, cellH, "F");
      }
      doc.setFontSize(8.5);
      doc.setDrawColor(226, 232, 240);
      doc.rect(margin, y, contentW, cellH);
      doc.text(String(s.pax || s.person_count || ""), colPax + 2, y + 4);
      doc.text(String(s.qty || "1"), colQty + 1, y + 4);
      doc.text(nameLines, colService + 2, y + 4);
      doc.text(s.dateFrom ? fmtD(s.dateFrom) : "", colFrom, y + 4);
      doc.text(s.dateTo ? fmtD(s.dateTo) : "", colTo + 2, y + 4);
      y += cellH;
      rowAlt = !rowAlt;
    }
    y += 6;
  }

  // ── FLIGHT DETAILS ──
  const iataToCity: Record<string, string> = {
    PRG: "Prague", VIE: "Vienna", LHR: "London", CDG: "Paris", AMS: "Amsterdam",
    FRA: "Frankfurt", MUC: "Munich", ZRH: "Zurich", BCN: "Barcelona", MAD: "Madrid",
    FCO: "Rome", MXP: "Milan", ATH: "Athens", IST: "Istanbul", DXB: "Dubai",
    AYT: "Antalya", DLM: "Dalaman", BJV: "Bodrum", ESB: "Ankara", SAW: "Istanbul",
    ADB: "Izmir", TFS: "Tenerife", LPA: "Gran Canaria", PMI: "Mallorca",
    HER: "Heraklion", RHO: "Rhodes", CFU: "Corfu", SKG: "Thessaloniki",
    MLA: "Malta", OPO: "Porto", LIS: "Lisbon", FAO: "Faro",
    BUD: "Budapest", WAW: "Warsaw", BRQ: "Brno", OSL: "Oslo",
    CPH: "Copenhagen", ARN: "Stockholm", HEL: "Helsinki",
    JFK: "New York", LAX: "Los Angeles", MIA: "Miami", ORD: "Chicago",
    DEN: "Denver", SFO: "San Francisco", BOS: "Boston", SEA: "Seattle",
    CUN: "Cancun", MCO: "Orlando", LAS: "Las Vegas",
    NBO: "Nairobi", CMN: "Casablanca", JNB: "Johannesburg", CAI: "Cairo",
    BKK: "Bangkok", SIN: "Singapore", HKG: "Hong Kong", NRT: "Tokyo",
    ICN: "Seoul", PEK: "Beijing", PVG: "Shanghai", DEL: "Delhi",
    BOM: "Mumbai", SYD: "Sydney", MEL: "Melbourne",
  };

  const resolveCity = (code: string) => {
    if (!code) return "";
    const upper = code.trim().toUpperCase();
    return iataToCity[upper] || removeDiacritics(code);
  };

  const flights = (voucher.flights as any[]) || [];
  if (flights.length > 0) {
    if (y > 245) { doc.addPage(); y = margin; }
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, W - margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("FLIGHT DETAILS", margin, y);
    y += 5;

    for (const f of flights) {
      if (y > 268) { doc.addPage(); y = margin; }
      const fromCity = resolveCity(f.fromCity || f.fromIata || f.departure || "");
      const toCity = resolveCity(f.toCity || f.toIata || f.arrival || "");
      const flightCode = `${f.airlineCode || ""} ${f.flightNumber || ""}`.trim();
      const datePart = f.date ? fmtD(f.date) : "";
      const parts: string[] = [];
      if (datePart) parts.push(datePart);
      if (flightCode) parts.push(flightCode);
      if (fromCity && toCity) parts.push(`${fromCity} - ${toCity}`);
      if (f.departureTime) parts.push(`Dep. ${f.departureTime}`);
      if (f.arrivalTime) parts.push(`Arr. ${f.arrivalTime}`);
      if (f.pax) {
        const paxNum = String(f.pax).replace(/\s*ADT\s*/gi, "").trim();
        parts.push(`Pax: ${paxNum} ADT`);
      }
      const line = parts.join(" · ");
      doc.setFontSize(8.5);
      doc.setTextColor(30, 41, 59);
      if (fromCity && toCity) {
        const cityStr = `${fromCity} - ${toCity}`;
        const beforeIdx = line.indexOf(cityStr);
        const before = line.slice(0, beforeIdx);
        const after = line.slice(beforeIdx + cityStr.length);
        let x = margin;
        if (before) { doc.setFont("helvetica", "normal"); doc.text(before, x, y); x += doc.getTextWidth(before); }
        doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42); doc.text(cityStr, x, y); x += doc.getTextWidth(cityStr);
        if (after) { doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59); doc.text(after, x, y); }
      } else {
        doc.setFont("helvetica", "normal"); doc.text(line, margin, y);
      }
      y += 5;
    }
  }

  // ── BAGGAGE ALLOWANCE ──
  if (flights.length > 0 && baggage) {
    const baggageItems: { label: string; kg?: number; count?: number; included?: boolean }[] = [
      { label: "Personal item", ...(baggage.cabin_bag || {}) },
      { label: "Cabin bag", ...(baggage.hand_luggage || {}) },
      { label: "Checked luggage", ...(baggage.checked_luggage || {}) },
      { label: "Golf bag", ...(baggage.golf_bag || {}) },
    ].filter(item => item.included);

    if (baggageItems.length > 0) {
      if (y > 260) { doc.addPage(); y = margin; }
      doc.setDrawColor(203, 213, 225);
      doc.line(margin, y, W - margin, y);
      y += 5;
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(71, 85, 105);
      doc.text("BAGGAGE", margin, y);
      y += 5;

      const bagParts = baggageItems.map(item => {
        let part = '';
        if (item.count && item.count > 1) part += `${item.count}x `;
        part += item.label;
        if (item.kg) part += ` ${item.kg} kg`;
        return part;
      });

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 41, 59);
      doc.text(bagParts.join(" · "), margin, y);
      y += 5;
    }
  }

  // ── CONFIRMED TEE TIMES ──
  const teeTimes = (voucher.tee_times as any[]) || [];
  if (teeTimes.length > 0) {
    if (y > 245) { doc.addPage(); y = margin; }
    doc.setDrawColor(203, 213, 225);
    doc.line(margin, y, W - margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(71, 85, 105);
    doc.text("CONFIRMED TEE TIMES", margin, y);
    y += 5;

    for (const t of teeTimes) {
      if (y > 268) { doc.addPage(); y = margin; }
      const paxCount = Number(t.golfers || t.players || t.pax || 0);
      const datePart = t.date ? fmtD(t.date) : "";
      const clubPart = removeDiacritics(t.club || t.course || "");
      const timePart = t.time || "";
      const endTime = t.endTime || t.end_time || "";
      doc.setFontSize(8.5);
      let xCursor = margin;
      const printBold = (text: string) => {
        doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
        doc.text(text, xCursor, y); xCursor += doc.getTextWidth(text);
      };
      const printNormal = (text: string) => {
        doc.setFont("helvetica", "normal"); doc.setTextColor(30, 41, 59);
        doc.text(text, xCursor, y); xCursor += doc.getTextWidth(text);
      };
      if (datePart) { printNormal(datePart); printNormal(" · "); }
      printBold(clubPart);
      if (timePart) {
        printNormal(" · "); printNormal(timePart);
        if (endTime) { printNormal(` - ${endTime}`); }
      }
      if (paxCount > 0) { printNormal(` · ${paxCount} golfers`); }
      y += 5;
    }
  }

  // ── DATES ROW ──
  if (y > 255) { doc.addPage(); y = margin; }
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, W - margin, y);
  y += 5;
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Issue Date", margin, y);
  doc.text("Expiration Date", W / 2, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(15, 23, 42);
  doc.text(voucher.issue_date ? fmtD(voucher.issue_date) : "", margin, y);
  doc.text(voucher.expiration_date ? fmtD(voucher.expiration_date) : "—", W / 2, y);
  y += 5;

  // ── TERMS ──
  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, W - margin, y);
  y += 5;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(71, 85, 105);
  doc.text("Terms & Conditions:", margin, y);
  y += 4;
  doc.setFont("helvetica", "normal");
  const terms = "This voucher is valid for the services listed above. Please present this voucher to service providers. Changes or cancellations must be made 48 hours in advance. For assistance, contact YARO Travel support.";
  const termsLines = doc.splitTextToSize(terms, contentW);
  doc.text(termsLines, margin, y);
  y += termsLines.length * 4 + 2;

  // ── FOOTER ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.line(margin, 284, W - margin, 284);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text("YARO Travel  ·  +420 602 102 108  ·  www.yarotravel.cz  ·  zajezdy@yarotravel.cz", W / 2, 289, { align: "center" });
  }

  return doc.output("blob");
};

/** Load logo as base64 with correct dimensions for PDF aspect ratio */
export const getLogoBase64ForPdf = (logoSrc: string): Promise<LogoInfo | undefined> => {
  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve({ base64: dataUrl, w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => resolve(undefined);
      img.src = logoSrc;
    } catch { resolve(undefined); }
  });
};

/** Fetch baggage allowance from deal flight services */
export const fetchBaggageFromDeal = async (
  supabaseClient: any,
  dealId: string
): Promise<BaggageAllowance | null> => {
  const { data: flightServices } = await supabaseClient
    .from("deal_services")
    .select("details")
    .eq("deal_id", dealId)
    .eq("service_type", "flight");
  if (flightServices && flightServices.length > 0) {
    let mergedBaggage: BaggageAllowance | null = null;
    for (const svc of flightServices) {
      const d = svc.details as any;
      if (d?.baggage) {
        mergedBaggage = { ...(mergedBaggage || {}), ...d.baggage };
      }
    }
    return mergedBaggage;
  }
  return null;
};
