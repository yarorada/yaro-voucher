// Branded invoice PDF generator extracted from Invoicing.tsx
// Used by uctoZipBuilder to produce real PDFs (not blank pages) for issued invoices.

import { createRoot } from "react-dom/client";
import { format } from "date-fns";
import QRCode from "qrcode";
import { bankAccountToIban, generateSpaydString } from "@/lib/spayd";
import yaroLogo from "@/assets/yaro-logo-wide.png";

export const DEFAULT_BANK_ACCOUNT = "227993932/0600";
export const EUR_BANK = {
  iban: "DE89202208000051200891",
  swift: "SXPYDEHH",
  bank: "BANKING CIRCLE S.A.",
};
export const AGENCY_PARTNER_NAME = "YARO s.r.o.";

export type InvoiceItem = {
  text: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
};

export type InvoicePdfData = {
  id: string;
  user_id?: string;
  invoice_type: string;
  invoice_number: string | null;
  client_name?: string | null;
  client_ico?: string | null;
  client_dic?: string | null;
  client_address?: string | null;
  supplier_name?: string | null;
  supplier_ico?: string | null;
  supplier_dic?: string | null;
  supplier_address?: string | null;
  total_amount: number | null;
  currency: string | null;
  issue_date: string | null;
  due_date: string | null;
  taxable_date?: string | null;
  variable_symbol?: string | null;
  specific_symbol?: string | null;
  constant_symbol?: string | null;
  bank_account?: string | null;
  iban?: string | null;
  notes?: string | null;
  items?: InvoiceItem[] | null;
};

function normCurrency(c: string | null | undefined): string {
  if (!c) return "CZK";
  const v = c.trim();
  if (v === "Kč" || v === "kč" || v === "KČ") return "CZK";
  return v;
}

function getInvoiceTotal(inv: InvoicePdfData): number | null {
  if (Array.isArray(inv.items) && inv.items.length > 0 && inv.items.some((it) => it.text || it.unit_price > 0)) {
    return Math.round(inv.items.reduce((s, it) => s + it.quantity * it.unit_price * (1 + it.vat_rate / 100), 0) * 100) / 100;
  }
  return inv.total_amount;
}

function getInvoicePdfFileName(inv: InvoicePdfData) {
  return `${inv.invoice_number || "faktura"}.pdf`;
}

function getInvoicePdfOptions(fileName: string) {
  return {
    margin: [10, 10, 10, 10] as [number, number, number, number],
    filename: fileName,
    image: { type: "jpeg" as const, quality: 0.95 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm" as const, format: "a4" as const, orientation: "portrait" as const },
  };
}

async function buildInvoiceQrUrl(inv: InvoicePdfData): Promise<string | null> {
  const effectiveTotal = getInvoiceTotal(inv);
  if (normCurrency(inv.currency) !== "CZK" || !effectiveTotal) return null;

  const account = inv.bank_account || DEFAULT_BANK_ACCOUNT;
  const iban = inv.iban || bankAccountToIban(account);
  if (!iban) return null;

  const spayd = generateSpaydString({
    iban,
    amount: effectiveTotal,
    variableSymbol: inv.variable_symbol || undefined,
    dueDate: inv.due_date || undefined,
    message: inv.notes || (inv.invoice_number ? `Faktura ${inv.invoice_number}` : undefined),
  });

  return QRCode.toDataURL(spayd, { width: 180, margin: 1, errorCorrectionLevel: "M" });
}

let cachedLogo: string | null = null;
async function loadLogoBase64(): Promise<string> {
  if (cachedLogo) return cachedLogo;
  try {
    const blob = await (await fetch(yaroLogo)).blob();
    cachedLogo = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("logo read failed"));
      reader.readAsDataURL(blob);
    });
    return cachedLogo;
  } catch {
    return "";
  }
}

export async function generateInvoicePdfBlob(inv: InvoicePdfData): Promise<{ blob: Blob; fileName: string }> {
  const html2pdf = (await import("html2pdf.js")).default;
  const [qrUrl, logoSrc] = await Promise.all([buildInvoiceQrUrl(inv), loadLogoBase64()]);
  const mountNode = document.createElement("div");
  mountNode.style.position = "fixed";
  mountNode.style.left = "-10000px";
  mountNode.style.top = "0";
  mountNode.style.width = "794px";
  mountNode.style.pointerEvents = "none";
  mountNode.style.opacity = "0";
  mountNode.style.background = "#ffffff";
  document.body.appendChild(mountNode);

  const root = createRoot(mountNode);

  try {
    root.render(
      <div className="bg-white text-black p-8" style={{ fontFamily: "Arial, sans-serif", fontSize: "12px", lineHeight: "1.5" }}>
        <InvoicePdfContent invoice={inv} qrUrl={qrUrl} logoSrc={logoSrc} />
      </div>
    );

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

    const content = mountNode.firstElementChild as HTMLElement | null;
    if (!content) throw new Error("Nepodařilo se připravit PDF faktury");

    const fileName = getInvoicePdfFileName(inv);
    const blob = (await html2pdf().set(getInvoicePdfOptions(fileName)).from(content).outputPdf("blob")) as Blob;
    return { blob, fileName };
  } finally {
    root.unmount();
    mountNode.remove();
  }
}

function InvoicePdfContent({ invoice, qrUrl, logoSrc }: { invoice: InvoicePdfData; qrUrl: string | null; logoSrc?: string }) {
  const formatDate = (d: string | null | undefined) => (d ? format(new Date(d), "d.M.yyyy") : "—");
  const cur = normCurrency(invoice.currency);
  const curSymbol = cur === "CZK" ? "Kč" : cur === "EUR" ? "€" : cur === "USD" ? "$" : cur === "GBP" ? "£" : cur;
  const fmt = (n: number) => n.toLocaleString("cs-CZ", { minimumFractionDigits: 2 });
  const fmtCur = (n: number) => <span style={{ whiteSpace: "nowrap" }}>{fmt(n)}&nbsp;{curSymbol}</span>;
  const formatAmount = (a: number | null) => (a != null ? fmtCur(a) : "—");
  const taxableDate = invoice.taxable_date || invoice.issue_date;

  const isIssued = invoice.invoice_type === "issued";
  const supplierName = invoice.supplier_name || (isIssued ? AGENCY_PARTNER_NAME : "");
  const supplierAddress = invoice.supplier_address || (isIssued ? "Bratranců Veverkových 680, 53002, Pardubice" : "");
  const supplierIco = invoice.supplier_ico || (isIssued ? "07849290" : "");
  const supplierDic = invoice.supplier_dic || (isIssued ? "CZ07849290" : "");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: "0 0 4px", color: "#000" }}>
            FAKTURA {invoice.invoice_number || ""}
          </h1>
          <p style={{ margin: 0, fontSize: "10px", color: "#888" }}>Daňový doklad</p>
        </div>
        {logoSrc && <img src={logoSrc} alt="YARO s.r.o." style={{ height: "40px" }} />}
      </div>

      <div style={{ display: "flex", gap: "40px", marginBottom: "16px" }}>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "9px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.5px" }}>
            Dodavatel
          </h3>
          <p style={{ fontWeight: "bold", margin: "0 0 2px", fontSize: "11px" }}>{supplierName}</p>
          <p style={{ margin: "0 0 1px", fontSize: "10px" }}>{supplierAddress}</p>
          {supplierIco && <p style={{ margin: "0 0 1px", fontSize: "10px" }}>IČO: {supplierIco}</p>}
          {supplierDic && <p style={{ margin: "0 0 1px", fontSize: "10px" }}>DIČ: {supplierDic}</p>}
          {isIssued && <p style={{ margin: "2px 0 0", fontSize: "8px", color: "#555" }}>Společnost zapsána v OR vložka C 43278 vedená u Krajského soudu v Hradci Králové</p>}
        </div>
        <div style={{ flex: 1 }}>
          <h3 style={{ fontSize: "9px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "4px", letterSpacing: "0.5px" }}>
            Odběratel
          </h3>
          <p style={{ fontWeight: "bold", margin: "0 0 2px", fontSize: "11px" }}>{invoice.client_name || "—"}</p>
          <p style={{ margin: "0 0 1px", fontSize: "10px" }}>{invoice.client_address || ""}</p>
          {invoice.client_ico && <p style={{ margin: "0 0 1px", fontSize: "10px" }}>IČO: {invoice.client_ico}</p>}
          {invoice.client_dic && <p style={{ margin: 0, fontSize: "10px" }}>DIČ: {invoice.client_dic}</p>}
        </div>
      </div>

      <div style={{ borderTop: "2px solid #000", borderBottom: "1px solid #ddd", padding: "8px 0", marginBottom: "16px", display: "flex", gap: "16px", fontSize: "9px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>Datum vystavení</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{formatDate(invoice.issue_date)}</p>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>DUZP</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{formatDate(taxableDate)}</p>
          </div>
          <div>
            <span style={{ color: "#888" }}>Datum splatnosti</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{formatDate(invoice.due_date)}</p>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>Variabilní symbol</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.variable_symbol || "—"}</p>
          </div>
          <div style={{ marginBottom: "4px" }}>
            <span style={{ color: "#888" }}>Specifický symbol</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.specific_symbol || "—"}</p>
          </div>
          <div>
            <span style={{ color: "#888" }}>Konstantní symbol</span>
            <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.constant_symbol || "—"}</p>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {cur === "EUR" ? (
            <>
              <div style={{ marginBottom: "4px" }}>
                <span style={{ color: "#888" }}>IBAN</span>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{EUR_BANK.iban}</p>
              </div>
              <div style={{ marginBottom: "4px" }}>
                <span style={{ color: "#888" }}>SWIFT</span>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{EUR_BANK.swift}</p>
              </div>
              <div>
                <span style={{ color: "#888" }}>Banka</span>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{EUR_BANK.bank}</p>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: "4px" }}>
                <span style={{ color: "#888" }}>Bankovní účet</span>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.bank_account || DEFAULT_BANK_ACCOUNT}</p>
              </div>
              {invoice.iban && (
                <div style={{ marginBottom: "4px" }}>
                  <span style={{ color: "#888" }}>IBAN</span>
                  <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{invoice.iban}</p>
                </div>
              )}
              <div>
                <span style={{ color: "#888" }}>Měna</span>
                <p style={{ margin: 0, fontWeight: "bold", fontSize: "10px" }}>{curSymbol}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {Array.isArray(invoice.items) && invoice.items.length > 0 && invoice.items.some((it) => it.text || it.unit_price > 0) && (() => {
        const typedItems = invoice.items as InvoiceItem[];
        const vatGroups = new Map<number, { base: number; vat: number }>();
        typedItems.forEach((it) => {
          const lineBase = it.quantity * it.unit_price;
          const lineVat = lineBase * (it.vat_rate / 100);
          const existing = vatGroups.get(it.vat_rate) || { base: 0, vat: 0 };
          vatGroups.set(it.vat_rate, { base: existing.base + lineBase, vat: existing.vat + lineVat });
        });
        const subtotal = typedItems.reduce((s, it) => s + it.quantity * it.unit_price, 0);
        const vatTotal = typedItems.reduce((s, it) => s + it.quantity * it.unit_price * (it.vat_rate / 100), 0);
        return (
          <div style={{ marginBottom: "16px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "10px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000" }}>
                  <th style={{ textAlign: "left", padding: "4px 3px", fontWeight: "bold" }}>Popis</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "40px" }}>Ks</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "80px", whiteSpace: "nowrap" }}>Cena/ks bez DPH</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "70px" }}>Základ</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "40px" }}>DPH</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "65px", whiteSpace: "nowrap" }}>DPH {curSymbol}</th>
                  <th style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", width: "75px" }}>Celkem</th>
                </tr>
              </thead>
              <tbody>
                {typedItems.map((it, idx) => {
                  const lb = it.quantity * it.unit_price;
                  const lv = lb * (it.vat_rate / 100);
                  return (
                    <tr key={idx} style={{ borderBottom: "1px solid #eee" }}>
                      <td style={{ padding: "4px 3px" }}>{it.text}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px" }}>{it.quantity}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmt(it.unit_price)}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmt(lb)}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px" }}>{it.vat_rate}%</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmt(lv)}</td>
                      <td style={{ textAlign: "right", padding: "4px 3px", whiteSpace: "nowrap" }}>{fmtCur(lb + lv)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "1px solid #ccc" }}>
                  <td colSpan={6} style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold" }}>Základ celkem:</td>
                  <td style={{ textAlign: "right", padding: "4px 3px", fontWeight: "bold", whiteSpace: "nowrap" }}>{fmtCur(subtotal)}</td>
                </tr>
                {Array.from(vatGroups.entries()).map(([rate, { base, vat }]) => (
                  <tr key={rate}>
                    <td colSpan={6} style={{ textAlign: "right", padding: "2px 3px", fontSize: "9px" }}>DPH {rate}% (základ {fmt(base)}):</td>
                    <td style={{ textAlign: "right", padding: "2px 3px", fontSize: "9px", whiteSpace: "nowrap" }}>{fmtCur(vat)}</td>
                  </tr>
                ))}
                {vatTotal > 0 && vatGroups.size > 1 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "right", padding: "2px 3px", fontWeight: "bold" }}>DPH celkem:</td>
                    <td style={{ textAlign: "right", padding: "2px 3px", fontWeight: "bold", whiteSpace: "nowrap" }}>{fmtCur(vatTotal)}</td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #000" }}>
                  <td colSpan={6} style={{ textAlign: "right", padding: "5px 3px", fontWeight: "bold", fontSize: "12px" }}>Celkem k úhradě:</td>
                  <td style={{ textAlign: "right", padding: "5px 3px", fontWeight: "bold", fontSize: "12px", whiteSpace: "nowrap" }}>{fmtCur(subtotal + vatTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })()}

      {(!Array.isArray(invoice.items) || !invoice.items.length || !invoice.items.some((it) => it.text || it.unit_price > 0)) && (
        <div style={{ background: "#f8f8f8", borderRadius: "6px", padding: "14px 18px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: "13px", fontWeight: "bold" }}>Celkem k úhradě</span>
          <span style={{ fontSize: "18px", fontWeight: "bold", whiteSpace: "nowrap" }}>{formatAmount(invoice.total_amount)}</span>
        </div>
      )}

      {invoice.notes && (
        <div style={{ marginBottom: "20px" }}>
          <h3 style={{ fontSize: "9px", fontWeight: "bold", color: "#888", textTransform: "uppercase", marginBottom: "3px" }}>Poznámka</h3>
          <p style={{ margin: 0, fontSize: "10px" }}>{invoice.notes}</p>
        </div>
      )}

      {qrUrl && (
        <div style={{ borderTop: "1px solid #ddd", paddingTop: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
          <img src={qrUrl} alt="QR platba" style={{ width: "120px", height: "120px" }} />
          <div>
            <p style={{ fontWeight: "bold", margin: "0 0 3px", fontSize: "10px" }}>QR platba</p>
            <p style={{ margin: "0 0 2px", fontSize: "9px", color: "#666" }}>Naskenujte kód pro rychlou úhradu</p>
            <p style={{ margin: "0 0 2px", fontSize: "9px", color: "#666", whiteSpace: "nowrap" }}>Částka: {formatAmount(invoice.total_amount)}</p>
            {invoice.variable_symbol && <p style={{ margin: "0 0 2px", fontSize: "9px", color: "#666" }}>VS: {invoice.variable_symbol}</p>}
            {invoice.due_date && <p style={{ margin: 0, fontSize: "9px", color: "#666" }}>Splatnost: {formatDate(invoice.due_date)}</p>}
          </div>
        </div>
      )}

      {cur !== "CZK" && (
        <div style={{ marginBottom: "12px", fontSize: "8px", color: "#666" }}>
          Faktura vystavena v měně {cur}. Dle § 4 odst. 15 zákona č. 235/2004 Sb. se přepočet na CZK provádí kurzem ČNB ke dni uskutečnění zdanitelného plnění.
        </div>
      )}

      <div style={{ marginTop: "20px", borderTop: "1px solid #ddd", paddingTop: "8px", textAlign: "center", color: "#999", fontSize: "8px" }}>
        {supplierName} • {supplierAddress}{supplierIco ? ` • IČO: ${supplierIco}` : ""}{supplierDic ? ` • DIČ: ${supplierDic}` : ""}
        {isIssued && <div style={{ marginTop: "2px" }}>Tel: +420 602 102 108 • E-mail: zajezdy@yarotravel.cz</div>}
      </div>
    </div>
  );
}
