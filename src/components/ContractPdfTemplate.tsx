import { forwardRef, useState, useEffect, useMemo } from "react";
import { getServiceTotal } from "@/lib/servicePrice";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { formatPrice, parseDateSafe } from "@/lib/utils";

interface FlightSegment {
  from: string;
  to: string;
  date: string;
  departure_time?: string;
  arrival_time?: string;
  flight_number?: string;
  airline_name?: string;
}

function bankAccountToIban(account: string): string | null {
  if (!account) return null;
  const cleaned = account.replace(/\s/g, "");
  const match = cleaned.match(/^(?:(\d+)-)?(\d+)\/(\d{4})$/);
  if (!match) return null;
  const prefix = match[1] ? match[1].padStart(6, "0") : "000000";
  const number = match[2].padStart(10, "0");
  const bankCode = match[3];
  const bban = bankCode + prefix + number;
  const numericIban = bban + "123500";
  const remainder = BigInt(numericIban) % BigInt(97);
  const checkDigits = String(98 - Number(remainder)).padStart(2, "0");
  return `CZ${checkDigits}${bban}`;
}

export const ContractPdfTemplate = forwardRef<HTMLDivElement, { contract: any }>(
  ({ contract }, ref) => {
    const currency = useMemo(() => contract?.currency || "CZK", [contract?.currency]);
    const isCzk = currency === "CZK";

    const deal = contract?.deal;
    const services = useMemo(() => {
      if (!deal?.services) return [];
      return [...deal.services].sort((a: any, b: any) => {
        const aIsMain = ["hotel", "flight"].includes(a.service_type);
        const bIsMain = ["hotel", "flight"].includes(b.service_type);
        if (aIsMain && !bIsMain) return -1;
        if (!aIsMain && bIsMain) return 1;
        return 0;
      });
    }, [deal?.services]);

    const payments = contract?.payments || [];
    const unpaidPayments = payments.filter((p: any) => !p.paid && (p.amount || 0) > 0);

    const [paymentQrUrls, setPaymentQrUrls] = useState<Record<string, string>>({});

    useEffect(() => {
      if (!isCzk || unpaidPayments.length === 0) return;
      const bankAccount = contract?.agency_bank_account;
      if (!bankAccount) return;
      const iban = bankAccountToIban(bankAccount);
      if (!iban) return;

      unpaidPayments.forEach((payment: any) => {
        if (!payment.id || !payment.amount) return;
        const spaydString = `SPD*1.0*ACC:${iban}*AM:${payment.amount.toFixed(2)}*CC:CZK*MSG:Smlouva ${contract?.contract_number || ""}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(spaydString)}`;
        setPaymentQrUrls(prev => ({ ...prev, [payment.id]: qrUrl }));
      });
    }, [contract?.agency_bank_account, contract?.contract_number, isCzk, unpaidPayments]);

    useEffect(() => {
      const el = ref && typeof ref === "object" ? (ref as React.RefObject<HTMLDivElement>).current : null;
      if (el) el.setAttribute("data-qr-ready", "true");
    }, [paymentQrUrls, ref]);

    const flightItineraryLines = useMemo(() => {
      const lines: string[] = [];
      if (!contract?.services) return lines;
      const flightServices = contract.services.filter((s: any) => s.service_type === "flight");
      for (const svc of flightServices) {
        if (!svc.details) continue;
        const details = typeof svc.details === "string" ? JSON.parse(svc.details) : svc.details;
        if (details.segments && Array.isArray(details.segments)) {
          for (const seg of details.segments) {
            const d = seg.date ? parseDateSafe(seg.date) : null;
            const dateStr = d ? format(d, "d.M.yy", { locale: cs }) : "—";
            const flightNum = [seg.flight_number, seg.airline_name].filter(Boolean).join(" ");
            const route = `${seg.from || "—"} → ${seg.to || "—"}`;
            const dep = seg.departure_time ? `Odlet: ${seg.departure_time}` : "";
            const arr = seg.arrival_time ? `Přílet: ${seg.arrival_time}` : "";
            const parts = [dateStr, flightNum ? `${flightNum}` : null, route, dep, arr].filter(Boolean);
            lines.push(parts.join(" • "));
          }
        }
        if (details.return?.segments && Array.isArray(details.return.segments)) {
          for (const seg of details.return.segments) {
            const d = seg.date ? parseDateSafe(seg.date) : null;
            const dateStr = d ? format(d, "d.M.yy", { locale: cs }) : "—";
            const flightNum = [seg.flight_number, seg.airline_name].filter(Boolean).join(" ");
            const route = `${seg.from || "—"} → ${seg.to || "—"}`;
            const dep = seg.departure_time ? `Odlet: ${seg.departure_time}` : "";
            const arr = seg.arrival_time ? `Přílet: ${seg.arrival_time}` : "";
            const parts = [dateStr, flightNum ? `${flightNum}` : null, route, dep, arr].filter(Boolean);
            lines.push(parts.join(" • "));
          }
        }
      }
      return lines;
    }, [contract?.services]);

    const sectionTitle: React.CSSProperties = {
      fontSize: "10px",
      fontWeight: "bold",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "#1e3a5f",
      borderBottom: "1.5px solid #1e3a5f",
      paddingBottom: "2px",
      marginBottom: "5px",
      marginTop: "0",
    };

    const valueStyle: React.CSSProperties = { fontSize: "9px", lineHeight: "1.4" };
    const tdStyle: React.CSSProperties = { padding: "3px 6px", borderBottom: "1px solid #e5e7eb", fontSize: "8px", verticalAlign: "top" };

    const contractDate = contract?.contract_date ? parseDateSafe(contract.contract_date) : null;

    return (
      <div
        ref={ref}
        style={{
          backgroundColor: "#ffffff",
          color: "#000000",
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "9px",
          lineHeight: "1.3",
          padding: "14px 16px",
          width: "210mm",
          minHeight: "297mm",
          boxSizing: "border-box",
        }}
      >
        {/* HEADER */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px", borderBottom: "2px solid #1e3a5f", paddingBottom: "8px" }}>
          <div>
            <div style={{ fontSize: "16px", fontWeight: "bold", color: "#1e3a5f", letterSpacing: "0.05em" }}>SMLOUVA O ZÁJEZDU</div>
            <div style={{ fontSize: "10px", color: "#555", marginTop: "1px" }}>č. {contract?.contract_number}</div>
          </div>
          <div style={{ textAlign: "right", fontSize: "8px", color: "#555" }}>
            <div>Datum: {contractDate ? format(contractDate, "d. M. yyyy") : "—"}</div>
            {contract?.agency_name && <div style={{ marginTop: "1px", fontWeight: "bold" }}>{contract.agency_name}</div>}
            {contract?.agency_ico && <div>IČO: {contract.agency_ico}</div>}
            {contract?.agency_contact && <div>{contract.agency_contact}</div>}
          </div>
        </div>

        {/* SMLUVNÍ STRANY */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
          {/* Zákazník */}
          <div style={{ flex: 1 }}>
            <h2 style={sectionTitle}>Zákazník</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>Jméno: </span><strong>{contract?.client?.title ? `${contract.client.title} ` : ""}{contract?.client?.first_name} {contract?.client?.last_name}</strong></td></tr>
                {contract?.client?.date_of_birth && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>Datum narození: </span>{(() => { const d = parseDateSafe(contract.client.date_of_birth); return d ? format(d, "d. M. yyyy") : '-'; })()}</td></tr>}
                {contract?.client?.address && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>Adresa: </span>{contract.client.address}</td></tr>}
                {contract?.client?.email && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>E-mail: </span>{contract.client.email}</td></tr>}
                {contract?.client?.phone && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>Telefon: </span>{contract.client.phone}</td></tr>}
                {contract?.client?.id_card_number && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>OP: </span>{contract.client.id_card_number}{contract.client.id_card_expiry ? ` (do ${(() => { const d = parseDateSafe(contract.client.id_card_expiry); return d ? format(d, "d. M. yyyy") : ''; })()})` : ""}</td></tr>}
                {contract?.client?.passport_number && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>Pas: </span>{contract.client.passport_number}{contract.client.passport_expiry ? ` (do ${(() => { const d = parseDateSafe(contract.client.passport_expiry); return d ? format(d, "d. M. yyyy") : ''; })()})` : ""}</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Agentura */}
          <div style={{ flex: 1 }}>
            <h2 style={sectionTitle}>Cestovní agentura</h2>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {contract?.agency_name && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><strong>{contract.agency_name}</strong></td></tr>}
                {contract?.agency_address && <tr><td style={{ ...valueStyle, padding: "2px 0" }}>{contract.agency_address}</td></tr>}
                {contract?.agency_ico && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>IČO: </span>{contract.agency_ico}</td></tr>}
                {contract?.agency_contact && <tr><td style={{ ...valueStyle, padding: "2px 0" }}>{contract.agency_contact}</td></tr>}
                {contract?.agency_bank_account && <tr><td style={{ ...valueStyle, padding: "2px 0" }}><span style={{ color: "#666", fontSize: "9px" }}>Účet: </span>{contract.agency_bank_account}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* CESTUJÍCÍ */}
        {deal?.travelers && deal.travelers.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <h2 style={sectionTitle}>Cestující ({deal.travelers.length})</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px" }}>
              {deal.travelers.map((t: any, i: number) => (
                <span key={i} style={{ fontSize: "8px" }}>
                  {t.client?.title ? `${t.client.title} ` : ""}{t.client?.first_name} {t.client?.last_name}
                  {t.client?.date_of_birth ? ` (nar. ${(() => { const d = parseDateSafe(t.client.date_of_birth); return d ? format(d, "d. M. yyyy") : ""; })()})` : ""}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* LETOVÝ ITINERÁŘ */}
        {flightItineraryLines.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <h2 style={sectionTitle}>Letový itinerář</h2>
            <div style={{ fontSize: "7.5px", lineHeight: "1.5" }}>
              {flightItineraryLines.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {/* SLUŽBY */}
        {services.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <h2 style={sectionTitle}>Přehled služeb</h2>
            <table style={{ width: "100%", fontSize: "8px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f0f4f8" }}>
                  <th style={{ ...tdStyle, textAlign: "left", fontWeight: "bold", width: "55%" }}>Název</th>
                  <th style={{ ...tdStyle, textAlign: "left", fontWeight: "bold", width: "15%" }}>Termín</th>
                  <th style={{ ...tdStyle, textAlign: "center", fontWeight: "bold", width: "10%" }}>
                    Osoby
                  </th>
                  <th style={{ ...tdStyle, textAlign: "right", fontWeight: "bold", width: "20%" }}>Cena</th>
                </tr>
              </thead>
              <tbody>
                {services
                  .map((service: any, si: number) => {
                    // Build baggage line for flight services
                    let baggageLine: string | null = null;
                    if (service.service_type === "flight" && service.details) {
                      const details = typeof service.details === "string" ? JSON.parse(service.details) : service.details;
                      const b = details?.baggage;
                      if (b) {
                        const parts: string[] = [];
                        if (b.cabin_bag?.included) parts.push("Taška");
                        if (b.hand_luggage?.included) parts.push(b.hand_luggage.kg ? `Palubní, ${b.hand_luggage.kg} kg` : "Palubní (v ceně)");
                        if (b.checked_luggage?.included) parts.push(b.checked_luggage.kg ? `Odbavené, ${b.checked_luggage.kg} kg` : "Odbavené (v ceně)");
                        if (b.golf_bag?.included) parts.push(b.golf_bag.kg ? `Golfbag, ${b.golf_bag.kg} kg` : "Golfbag (v ceně)");
                        if (parts.length > 0) baggageLine = parts.join(" · ");
                      }
                    }
                    return (
                      <tr key={si}>
                        <td style={{ ...tdStyle, paddingLeft: "4px" }}>
                          {service.service_name}
                          {service.description && <span style={{ display: "block", fontSize: "7px", color: "#888", lineHeight: "1.2", marginTop: "1px" }}>{service.description}</span>}
                          {baggageLine && (
                            <span style={{ display: "block", fontSize: "7px", color: "#555", marginTop: "2px" }}>
                              {baggageLine}
                            </span>
                          )}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: "nowrap", fontSize: "8px" }}>
                          {service.start_date ? (() => { const d = parseDateSafe(service.start_date); return d ? format(d, "d.M.") : ""; })() : ""}
                          {service.end_date ? ` – ${(() => { const d = parseDateSafe(service.end_date); return d ? format(d, "d.M.") : ""; })()}` : ""}
                        </td>
                        <td style={{ ...tdStyle, textAlign: "center" }}>{service.person_count || "-"}</td>
                        <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{formatPrice(getServiceTotal(service), true, currency)}</td>
                      </tr>
                    );
                  })}
                <tr style={{ backgroundColor: "#f0f4f8" }}>
                  <td colSpan={3} style={{ padding: "6px 6px", fontWeight: "bold", textAlign: "right", fontSize: "9px", verticalAlign: "middle" }}>Celkem:</td>
                  <td style={{ padding: "6px 6px", fontWeight: "bold", textAlign: "right", fontSize: "11px", verticalAlign: "middle" }}>{formatPrice(deal?.total_price, true, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* PLATEBNÍ KALENDÁŘ S QR KÓDY */}
        {payments.length > 0 && (
          <div style={{ marginBottom: "6px" }}>
            <h2 style={sectionTitle}>Platební kalendář</h2>
            <table style={{ width: "100%", fontSize: "9px", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f0f4f8" }}>
                  <th style={{ ...tdStyle, textAlign: "left" }}>Typ platby</th>
                  <th style={{ ...tdStyle, textAlign: "left" }}>Splatnost</th>
                  <th style={{ ...tdStyle, textAlign: "right" }}>Částka</th>
                  <th style={{ ...tdStyle, textAlign: "center" }}>Stav</th>
                  {isCzk && <th style={{ ...tdStyle, textAlign: "center" }}>QR platba</th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((payment: any, i: number) => {
                  const dueDate = parseDateSafe(payment.due_date);
                  const qrUrl = paymentQrUrls[payment.id];
                  return (
                    <tr key={i}>
                      <td style={tdStyle}>{payment.payment_type === "deposit" ? "Záloha" : payment.payment_type === "final" ? "Doplatek" : payment.payment_type}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{dueDate ? format(dueDate, "d. M. yyyy") : "—"}</td>
                      <td style={{ ...tdStyle, textAlign: "right", fontWeight: "bold" }}>{formatPrice(payment.amount, true, currency)}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        {payment.paid ? "✓ Zaplaceno" : "Nezaplaceno"}
                      </td>
                      {isCzk && (
                        <td style={{ ...tdStyle, textAlign: "center" }}>
                          {qrUrl && !payment.paid ? (
                            <img src={qrUrl} alt="QR platba" style={{ width: "55px", height: "55px" }} />
                          ) : null}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* TEE TIMES */}
        {contract?.tee_times && Array.isArray(contract.tee_times) && contract.tee_times.length > 0 && (
          <div style={{ marginBottom: "8px" }}>
            <h2 style={sectionTitle}>Startovací časy (Tee Times)</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 16px", fontSize: "8px" }}>
              {contract.tee_times.map((tt: any, i: number) => {
                const d = tt.date ? parseDateSafe(tt.date) : null;
                const dateStr = d ? format(d, "d. M. yy") : "—";
                return (
                  <span key={i}>{dateStr} – {tt.course || "—"}{tt.time ? ` – ${tt.time}` : ""}{tt.players ? ` (${tt.players}×)` : ""}</span>
                );
              })}
            </div>
          </div>
        )}

        {/* PODMÍNKY */}
        {contract?.terms && (
          <div style={{ marginBottom: "8px" }}>
            <h2 style={sectionTitle}>Podmínky a poznámky</h2>
            <p style={{ fontSize: "7.5px", color: "#333", whiteSpace: "pre-line", margin: 0, lineHeight: "1.4" }}>{contract.terms}</p>
          </div>
        )}

        {/* PODPISY */}
        <div data-pdf-section style={{ marginTop: "12px", pageBreakInside: "avoid" }}>
          <h2 style={sectionTitle}>Podpisy</h2>
          <div style={{ display: "flex", gap: "24px" }}>
            {/* Zákazník */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "8px", color: "#555", marginBottom: "4px" }}>Zákazník</div>
              {contract?.signature_url ? (
                <img src={contract.signature_url} alt="Podpis zákazníka" style={{ maxHeight: "50px", maxWidth: "180px", display: "block", marginBottom: "2px" }} />
              ) : (
                <div style={{ height: "50px", borderBottom: "1px solid #333", marginBottom: "2px" }} />
              )}
              {contract?.signed_at && (
                <div style={{ fontSize: "7px", color: "#666" }}>
                  Podepsáno: {(() => { const d = parseDateSafe(contract.signed_at); return d ? format(d, "d. M. yyyy HH:mm") : ""; })()}
                </div>
              )}
              <div style={{ fontSize: "7.5px", marginTop: "2px" }}>{contract?.client?.first_name} {contract?.client?.last_name}</div>
            </div>

            {/* Agentura */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "8px", color: "#555", marginBottom: "4px" }}>Za cestovní agenturu</div>
              <div style={{ height: "50px", borderBottom: "1px solid #333", marginBottom: "2px", display: "flex", alignItems: "flex-end" }}>
                <img
                  src="/radek-podpis.png"
                  alt="Podpis agentury"
                  className="logo-dark-mode"
                  style={{ maxHeight: "45px", maxWidth: "150px", display: "block", filter: "none" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              </div>
              <div style={{ fontSize: "7.5px", marginTop: "2px" }}>{contract?.agency_name || "YARO s.r.o."}</div>
            </div>
          </div>
        </div>

        {/* PRÁVNÍ USTANOVENÍ */}
        <div style={{ marginTop: "10px", fontSize: "6.5px", color: "#888", borderTop: "1px solid #e5e7eb", paddingTop: "6px", lineHeight: "1.4" }}>
          Tato smlouva o zájezdu je uzavřena v souladu s § 2521 a násl. zákona č. 89/2012 Sb., občanský zákoník, a zákonem č. 159/1999 Sb., o některých podmínkách podnikání v oblasti cestovního ruchu. Zákazník svým podpisem potvrzuje, že se seznámil s podmínkami zájezdu a souhlasí s nimi. Elektronický podpis má stejnou právní platnost jako podpis vlastnoruční.
        </div>
      </div>
    );
  }
);

ContractPdfTemplate.displayName = "ContractPdfTemplate";
