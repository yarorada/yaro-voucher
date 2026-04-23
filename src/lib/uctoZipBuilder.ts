// UCTO výstup — sestavení ZIP balíčku pro účetní
// Sbalí všechny doklady z dávky (faktury vystavené, faktury přijaté, smlouvy)
// do jednoho ZIP souboru pojmenovaného po složce/měsíci.

import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

export type ZipInvoice = {
  id: string;
  invoice_number: string | null;
  invoice_type: string; // "issued" | "received"
  client_name: string | null;
  supplier_name: string | null;
  supplier_ico?: string | null;
  supplier_dic?: string | null;
  client_ico?: string | null;
  client_dic?: string | null;
  issue_date: string | null;
  due_date?: string | null;
  total_amount: number | null;
  net_amount?: number | null;
  vat_amount?: number | null;
  currency: string | null;
  variable_symbol?: string | null;
  bank_account?: string | null;
  iban?: string | null;
  paid?: boolean | null;
  notes?: string | null;
  file_url?: string | null;
  payment_method?: string | null;
  bank?: string | null;
  items?: Array<{ text?: string; quantity?: number; unit_price?: number; vat_rate?: number }> | null;
};

export type ZipContract = {
  id: string;
  contract_number: string;
  contract_date: string;
  total_price: number;
  currency: string | null;
  deposit_amount?: number | null;
  payment_schedule?: unknown;
  client?: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null } | null;
};

export type ZipBankStatement = {
  id: string;
  bank: string;          // 'moneta' | 'amnis' | 'other'
  file_url: string;
  file_name: string;
  uploaded_at?: string | null;
};

export type ZipBatchInput = {
  folderName: string; // např. "UCTO_2026-04_duben-2026"
  invoices: ZipInvoice[];
  contracts: ZipContract[];
  bankStatements?: ZipBankStatement[];
};

/* ---------- helpers ---------- */

function safeFileName(s: string, fallback = "soubor"): string {
  const cleaned = (s || fallback)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // diakritika
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
}

function formatAmount(n: number | null | undefined, currency = "CZK"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  try {
    const date = new Date(d.includes("T") ? d : d + "T00:00:00");
    return date.toLocaleDateString("cs-CZ");
  } catch {
    return d;
  }
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/* ---------- Storage download ---------- */

function parseStorageReference(fileUrl: string): { bucket: string; path: string } | null {
  try {
    const url = new URL(fileUrl);
    // typicky: /storage/v1/object/public/<bucket>/<path...>
    const m = url.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

async function fetchInvoiceFile(fileUrl: string): Promise<Blob | null> {
  // Nejdřív zkus přes Supabase storage (pro privátní buckety)
  const ref = parseStorageReference(fileUrl);
  if (ref) {
    const { data, error } = await supabase.storage.from(ref.bucket).download(ref.path);
    if (!error && data) return data;
  }
  // Fallback: přímý fetch (pro veřejné URL)
  try {
    const r = await fetch(fileUrl);
    if (r.ok) return await r.blob();
  } catch {
    /* ignore */
  }
  return null;
}

function fileExtFromBlob(blob: Blob, originalName?: string | null): string {
  if (originalName) {
    const m = originalName.match(/\.([a-zA-Z0-9]{1,5})$/);
    if (m) return m[1].toLowerCase();
  }
  if (blob.type === "application/pdf") return "pdf";
  if (blob.type === "image/jpeg") return "jpg";
  if (blob.type === "image/png") return "png";
  if (blob.type === "image/heic") return "heic";
  return "bin";
}

/* ---------- HTML templates for issued invoice & contract PDFs ---------- */

function issuedInvoiceHtml(inv: ZipInvoice): string {
  const items = (inv.items || []).filter((it) => (it?.text || "").trim() || (it?.unit_price || 0) > 0);
  const itemsRows = items
    .map((it) => {
      const qty = it.quantity ?? 1;
      const price = it.unit_price ?? 0;
      const vat = it.vat_rate ?? 0;
      const total = qty * price * (1 + vat / 100);
      return `
        <tr>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5">${escapeHtml(it.text || "")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right">${qty}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right">${formatAmount(price, inv.currency || "CZK")}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right">${vat}%</td>
          <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right">${formatAmount(total, inv.currency || "CZK")}</td>
        </tr>`;
    })
    .join("");

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Faktura ${escapeHtml(inv.invoice_number || "")}</title></head>
<body style="font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:24px;line-height:1.45">
  <table style="width:100%;margin-bottom:16px"><tr>
    <td style="vertical-align:top;width:50%">
      <h1 style="font-size:20px;margin:0 0 8px">Faktura ${escapeHtml(inv.invoice_number || "")}</h1>
      <div>Datum vystavení: <b>${formatDate(inv.issue_date)}</b></div>
      <div>Datum splatnosti: <b>${formatDate(inv.due_date)}</b></div>
      ${inv.variable_symbol ? `<div>Variabilní symbol: <b>${escapeHtml(inv.variable_symbol)}</b></div>` : ""}
    </td>
    <td style="vertical-align:top;text-align:right">
      <div style="font-size:24px;font-weight:bold">${formatAmount(inv.total_amount, inv.currency || "CZK")}</div>
      ${inv.bank_account ? `<div style="margin-top:4px">Účet: <b>${escapeHtml(inv.bank_account)}</b></div>` : ""}
      ${inv.iban ? `<div>IBAN: <b>${escapeHtml(inv.iban)}</b></div>` : ""}
    </td>
  </tr></table>

  <table style="width:100%;margin-bottom:16px;border-collapse:collapse">
    <tr>
      <td style="vertical-align:top;width:50%;padding:8px;border:1px solid #e5e5e5">
        <div style="font-size:10px;color:#666;text-transform:uppercase">Odběratel</div>
        <div style="font-weight:bold">${escapeHtml(inv.client_name || "—")}</div>
        ${inv.client_ico ? `<div>IČO: ${escapeHtml(inv.client_ico)}</div>` : ""}
        ${inv.client_dic ? `<div>DIČ: ${escapeHtml(inv.client_dic)}</div>` : ""}
      </td>
      <td style="vertical-align:top;width:50%;padding:8px;border:1px solid #e5e5e5">
        <div style="font-size:10px;color:#666;text-transform:uppercase">Dodavatel</div>
        <div style="font-weight:bold">${escapeHtml(inv.supplier_name || "—")}</div>
        ${inv.supplier_ico ? `<div>IČO: ${escapeHtml(inv.supplier_ico)}</div>` : ""}
        ${inv.supplier_dic ? `<div>DIČ: ${escapeHtml(inv.supplier_dic)}</div>` : ""}
      </td>
    </tr>
  </table>

  ${
    items.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead><tr style="background:#f5f5f5">
            <th style="padding:6px 8px;text-align:left">Položka</th>
            <th style="padding:6px 8px;text-align:right">Množství</th>
            <th style="padding:6px 8px;text-align:right">Cena/ks</th>
            <th style="padding:6px 8px;text-align:right">DPH</th>
            <th style="padding:6px 8px;text-align:right">Celkem</th>
          </tr></thead>
          <tbody>${itemsRows}</tbody>
        </table>`
      : ""
  }

  <table style="width:100%;margin-bottom:16px">
    <tr>
      <td style="text-align:right;font-size:14px">
        ${inv.net_amount != null ? `<div>Bez DPH: <b>${formatAmount(inv.net_amount, inv.currency || "CZK")}</b></div>` : ""}
        ${inv.vat_amount != null ? `<div>DPH: <b>${formatAmount(inv.vat_amount, inv.currency || "CZK")}</b></div>` : ""}
        <div style="font-size:18px;margin-top:6px">Celkem k úhradě: <b>${formatAmount(inv.total_amount, inv.currency || "CZK")}</b></div>
      </td>
    </tr>
  </table>

  ${inv.notes ? `<div style="margin-top:16px;padding:8px;border-top:1px solid #e5e5e5;font-style:italic">${escapeHtml(inv.notes)}</div>` : ""}
</body></html>`;
}

function contractHtml(c: ZipContract): string {
  const fullName = `${c.client?.first_name ?? ""} ${c.client?.last_name ?? ""}`.trim() || "—";
  const schedule = Array.isArray(c.payment_schedule) ? (c.payment_schedule as Array<{ due_date?: string; amount?: number; payment_type?: string; paid?: boolean }>) : [];
  const scheduleRows = schedule
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5">${escapeHtml(p.payment_type || "—")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5">${formatDate(p.due_date)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5;text-align:right">${formatAmount(p.amount ?? null, c.currency || "CZK")}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e5e5e5">${p.paid ? "Uhrazeno" : "Neuhrazeno"}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html><html><head><meta charset="utf-8"><title>Smlouva ${escapeHtml(c.contract_number)}</title></head>
<body style="font-family:Arial,sans-serif;font-size:12px;color:#000;background:#fff;padding:24px;line-height:1.45">
  <h1 style="font-size:20px;margin:0 0 12px">Cestovní smlouva ${escapeHtml(c.contract_number)}</h1>

  <table style="width:100%;margin-bottom:16px;border-collapse:collapse">
    <tr><td style="padding:6px 8px;background:#f5f5f5;width:35%"><b>Klient</b></td><td style="padding:6px 8px">${escapeHtml(fullName)}</td></tr>
    ${c.client?.email ? `<tr><td style="padding:6px 8px;background:#f5f5f5"><b>E-mail</b></td><td style="padding:6px 8px">${escapeHtml(c.client.email)}</td></tr>` : ""}
    ${c.client?.phone ? `<tr><td style="padding:6px 8px;background:#f5f5f5"><b>Telefon</b></td><td style="padding:6px 8px">${escapeHtml(c.client.phone)}</td></tr>` : ""}
    <tr><td style="padding:6px 8px;background:#f5f5f5"><b>Datum smlouvy</b></td><td style="padding:6px 8px">${formatDate(c.contract_date)}</td></tr>
    <tr><td style="padding:6px 8px;background:#f5f5f5"><b>Celková cena</b></td><td style="padding:6px 8px;font-size:16px"><b>${formatAmount(c.total_price, c.currency || "CZK")}</b></td></tr>
    ${c.deposit_amount != null ? `<tr><td style="padding:6px 8px;background:#f5f5f5"><b>Záloha</b></td><td style="padding:6px 8px">${formatAmount(c.deposit_amount, c.currency || "CZK")}</td></tr>` : ""}
  </table>

  ${
    schedule.length > 0
      ? `<h2 style="font-size:14px;margin-top:16px">Splátkový kalendář</h2>
         <table style="width:100%;border-collapse:collapse">
           <thead><tr style="background:#f5f5f5">
             <th style="padding:6px 8px;text-align:left">Typ</th>
             <th style="padding:6px 8px;text-align:left">Splatnost</th>
             <th style="padding:6px 8px;text-align:right">Částka</th>
             <th style="padding:6px 8px;text-align:left">Stav</th>
           </tr></thead>
           <tbody>${scheduleRows}</tbody>
         </table>`
      : ""
  }
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}

/* ---------- HTML → PDF Blob přes html2pdf.js ---------- */

async function htmlToPdfBlob(html: string, fileName: string): Promise<Blob> {
  const html2pdf = (await import("html2pdf.js")).default;
  const mount = document.createElement("div");
  mount.style.position = "fixed";
  mount.style.left = "-10000px";
  mount.style.top = "0";
  mount.style.width = "794px";
  mount.style.opacity = "0";
  mount.style.pointerEvents = "none";
  mount.style.background = "#ffffff";
  mount.innerHTML = html;
  document.body.appendChild(mount);

  try {
    // dva animation frames, ať se layout/fonty stihnou usadit
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    const opt = {
      margin: [10, 10, 10, 10] as [number, number, number, number],
      filename: fileName,
      image: { type: "jpeg" as const, quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true, letterRendering: true, backgroundColor: "#ffffff" },
      jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
      pagebreak: { mode: ["avoid-all", "css", "legacy"] as Array<"avoid-all" | "css" | "legacy"> },
    };
    const blob = (await html2pdf().set(opt).from(mount.firstElementChild as HTMLElement).outputPdf("blob")) as Blob;
    return blob;
  } finally {
    mount.remove();
  }
}

/* ---------- Build summary CSV ---------- */

function buildSummaryCsv(invoices: ZipInvoice[], contracts: ZipContract[]): string {
  const lines: string[] = [];
  lines.push("Typ;Číslo;Datum;Protistrana;Částka;Měna;Stav");
  for (const inv of invoices) {
    const counterparty = inv.invoice_type === "issued" ? inv.client_name : inv.supplier_name;
    lines.push(
      [
        inv.invoice_type === "issued" ? "Vystavená faktura" : "Přijatá faktura",
        inv.invoice_number,
        formatDate(inv.issue_date),
        counterparty,
        inv.total_amount,
        inv.currency || "CZK",
        inv.paid ? "Uhrazeno" : "Neuhrazeno",
      ]
        .map(csvEscape)
        .join(";")
    );
  }
  for (const c of contracts) {
    const fullName = `${c.client?.first_name ?? ""} ${c.client?.last_name ?? ""}`.trim();
    lines.push(
      [
        "Smlouva",
        c.contract_number,
        formatDate(c.contract_date),
        fullName,
        c.total_price,
        c.currency || "CZK",
        "",
      ]
        .map(csvEscape)
        .join(";")
    );
  }
  return "\uFEFF" + lines.join("\n"); // BOM pro Excel
}

/* ---------- Public API ---------- */

export type ZipProgress = { current: number; total: number; label: string };

export async function buildUctoZip(
  input: ZipBatchInput,
  onProgress?: (p: ZipProgress) => void
): Promise<Blob> {
  const zip = new JSZip();
  const root = zip.folder(input.folderName)!;
  const issuedFolder = root.folder("vystavene-faktury")!;
  const receivedFolder = root.folder("prijate-faktury")!;
  const contractsFolder = root.folder("smlouvy")!;
  const bankFolder = root.folder("bankovni-vypisy")!;

  const issued = input.invoices.filter((i) => i.invoice_type === "issued");
  const received = input.invoices.filter((i) => i.invoice_type === "received");
  const bank = input.bankStatements || [];
  const total = issued.length + received.length + input.contracts.length + bank.length + 1; // +1 = summary
  let current = 0;
  const tick = (label: string) => {
    current += 1;
    onProgress?.({ current, total, label });
  };

  // 1) Vystavené faktury — generuj PDF
  for (const inv of issued) {
    const fileName = `${safeFileName(inv.invoice_number || `faktura-${inv.id.slice(0, 8)}`)}.pdf`;
    try {
      const blob = await htmlToPdfBlob(issuedInvoiceHtml(inv), fileName);
      issuedFolder.file(fileName, blob);
    } catch (e) {
      console.error("Failed to render issued invoice", inv.invoice_number, e);
    }
    tick(`Vystavená faktura ${inv.invoice_number ?? ""}`);
  }

  // 2) Přijaté faktury — stáhni originál ze storage
  for (const inv of received) {
    if (inv.file_url) {
      const blob = await fetchInvoiceFile(inv.file_url);
      if (blob) {
        const ext = fileExtFromBlob(blob, inv.file_url.split("/").pop());
        const baseName = safeFileName(
          `${inv.supplier_name || "dodavatel"}_${inv.invoice_number || inv.id.slice(0, 8)}`
        );
        receivedFolder.file(`${baseName}.${ext}`, blob);
      }
    } else {
      // bez souboru — vygeneruj alespoň základní PDF přehled
      const fileName = `${safeFileName(inv.supplier_name || "dodavatel")}_${safeFileName(inv.invoice_number || inv.id.slice(0, 8))}.pdf`;
      try {
        const blob = await htmlToPdfBlob(issuedInvoiceHtml(inv), fileName); // stejný layout, jen s opačnými stranami
        receivedFolder.file(fileName, blob);
      } catch (e) {
        console.error("Failed to render received invoice fallback", e);
      }
    }
    tick(`Přijatá faktura ${inv.invoice_number ?? inv.supplier_name ?? ""}`);
  }

  // 3) Smlouvy — generuj PDF
  for (const c of input.contracts) {
    const fileName = `${safeFileName(c.contract_number)}.pdf`;
    try {
      const blob = await htmlToPdfBlob(contractHtml(c), fileName);
      contractsFolder.file(fileName, blob);
    } catch (e) {
      console.error("Failed to render contract", c.contract_number, e);
    }
    tick(`Smlouva ${c.contract_number}`);
  }

  // 3.5) Bankovní výpisy — stáhni originál ze storage
  for (const bs of bank) {
    if (bs.file_url) {
      const blob = await fetchInvoiceFile(bs.file_url);
      if (blob) {
        const ext = fileExtFromBlob(blob, bs.file_name || bs.file_url.split("/").pop());
        const baseName = safeFileName(`${bs.bank}_${bs.file_name?.replace(/\.[^.]+$/, "") || bs.id.slice(0, 8)}`);
        const folder = bankFolder.folder(bs.bank) || bankFolder;
        folder.file(`${baseName}.${ext}`, blob);
      }
    }
    tick(`Výpis ${bs.bank} ${bs.file_name ?? ""}`);
  }

  // 4) Summary CSV
  root.file("prehled.csv", buildSummaryCsv(input.invoices, input.contracts));
  tick("Přehled");

  return await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
