import { forwardRef } from "react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { formatPrice } from "@/lib/utils";
import yaroLogo from "@/assets/yaro-logo-wide.png";

interface ParsedFlightLeg {
  date?: string;
  airline_code?: string;
  airline_name?: string;
  flight_number?: string;
  departure_airport?: string;
  arrival_airport?: string;
  departure_time?: string;
  arrival_time?: string;
}

interface PaymentRecord {
  id: string;
  payment_type: string;
  amount: number;
  due_date: string;
  paid: boolean | null;
  paid_at: string | null;
  notes: string | null;
}

interface ContractPdfTemplateProps {
  contract: any;
}

export const ContractPdfTemplate = forwardRef<HTMLDivElement, ContractPdfTemplateProps>(
  ({ contract }, ref) => {
    const deal = contract.deal;
    const travelers = deal?.travelers || [];
    const services = deal?.services || [];

    const payments: PaymentRecord[] = (contract.payments || [])
      .sort((a: PaymentRecord, b: PaymentRecord) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    // Extract flight services and their segments
    const flightServices = services.filter((s: any) => s.service_type === "flight");
    const hasFlights = flightServices.length > 0;

    // Determine transportation method
    const getTransportationText = () => {
      if (hasFlights) return "letecká";
      const hasTransfer = services.some((s: any) => s.service_type === "transfer");
      if (hasTransfer) return "pozemní (transfer)";
      return "individuální";
    };

    // Normalize all flight detail formats into a flat list of legs
    const getFlightLegs = (service: any): ParsedFlightLeg[] => {
      if (!service.details) return [];
      const details = typeof service.details === "string" ? JSON.parse(service.details) : service.details;
      const legs: ParsedFlightLeg[] = [];

      // Format 1: outbound_segments / return_segments (multi-segment with times)
      if (details.outbound_segments || details.return_segments) {
        for (const seg of (details.outbound_segments || [])) {
          legs.push({
            date: seg.date,
            airline_code: seg.airline,
            airline_name: seg.airline_name,
            flight_number: seg.flight_number,
            departure_airport: seg.departure,
            arrival_airport: seg.arrival,
            departure_time: seg.departure_time,
            arrival_time: seg.arrival_time,
          });
        }
        for (const seg of (details.return_segments || [])) {
          legs.push({
            date: seg.date,
            airline_code: seg.airline,
            airline_name: seg.airline_name,
            flight_number: seg.flight_number,
            departure_airport: seg.departure,
            arrival_airport: seg.arrival,
            departure_time: seg.departure_time,
            arrival_time: seg.arrival_time,
          });
        }
        return legs;
      }

      // Format 2: simple outbound / return objects
      if (details.outbound) {
        legs.push({
          date: service.start_date || undefined,
          airline_code: details.outbound.airline,
          airline_name: details.outbound.airline_name,
          flight_number: details.outbound.flight_number,
          departure_airport: details.outbound.departure,
          arrival_airport: details.outbound.arrival,
          departure_time: details.outbound.departure_time,
          arrival_time: details.outbound.arrival_time,
        });
      }
      if (details.return) {
        legs.push({
          date: service.end_date || undefined,
          airline_code: details.return.airline,
          airline_name: details.return.airline_name,
          flight_number: details.return.flight_number,
          departure_airport: details.return.departure,
          arrival_airport: details.return.arrival,
          departure_time: details.return.departure_time,
          arrival_time: details.return.arrival_time,
        });
      }

      // Format 3: segments array (generic)
      if (details.segments) {
        for (const seg of details.segments) {
          legs.push({
            date: seg.date,
            airline_code: seg.airline,
            airline_name: seg.airline_name,
            flight_number: seg.flight_number,
            departure_airport: seg.departure_airport || seg.departure,
            arrival_airport: seg.arrival_airport || seg.arrival,
            departure_time: seg.departure_time,
            arrival_time: seg.arrival_time,
          });
        }
      }

      return legs;
    };

    // Format a flight leg into "DD.MM.YY • W64600 Wizz Air • PRG → LCA • Odlet: 18:25 • Přílet: 22:50"
    const formatFlightLeg = (leg: ParsedFlightLeg): string => {
      const parts: string[] = [];

      // Date
      if (leg.date) {
        try {
          parts.push(format(new Date(leg.date), "dd.MM.yy"));
        } catch { parts.push(leg.date); }
      }

      // Flight number + airline name: "W64600 Wizz Air"
      const flightId = [
        leg.airline_code && leg.flight_number ? `${leg.airline_code}${leg.flight_number}` : (leg.flight_number || ''),
        leg.airline_name || ''
      ].filter(Boolean).join(' ');
      if (flightId) parts.push(flightId);

      // Route
      if (leg.departure_airport || leg.arrival_airport) {
        parts.push(`${leg.departure_airport || '?'} → ${leg.arrival_airport || '?'}`);
      }

      // Times
      if (leg.departure_time) parts.push(`Odlet: ${leg.departure_time}`);
      if (leg.arrival_time) parts.push(`Přílet: ${leg.arrival_time}`);

      return parts.join(' • ');
    };

    // Shared cell styles
    const labelStyle: React.CSSProperties = { padding: '2px 0', color: '#666', fontSize: '10px', verticalAlign: 'top' };
    const valueStyle: React.CSSProperties = { padding: '2px 0 2px 6px', fontSize: '10px', verticalAlign: 'top' };
    const sectionTitle: React.CSSProperties = { fontSize: '11px', fontWeight: 'bold', marginBottom: '4px', color: '#0066cc', textTransform: 'uppercase', borderBottom: '1px solid #0066cc', paddingBottom: '2px' };
    const thStyle: React.CSSProperties = { padding: '3px 6px', textAlign: 'left', borderBottom: '1px solid #ccc', fontSize: '9px', fontWeight: 'bold', backgroundColor: '#f0f4f8' };
    const tdStyle: React.CSSProperties = { padding: '3px 6px', borderBottom: '1px solid #eee', fontSize: '10px' };

    return (
      <div
        ref={ref}
        id="contract-pdf-content"
        style={{
          width: '190mm',
          padding: '0',
          fontFamily: 'Arial, Helvetica, sans-serif',
          backgroundColor: '#ffffff',
          color: '#000000',
          lineHeight: 1.3,
        }}
      >
        {/* ===== HLAVIČKA ===== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', borderBottom: '2px solid #0066cc', paddingBottom: '8px' }}>
          <div>
            <img src={yaroLogo} alt="YARO Travel" style={{ height: '32px', marginBottom: '4px' }} className="logo-dark-mode" />
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, color: '#0066cc' }}>CESTOVNÍ SMLOUVA</h1>
            <p style={{ fontSize: '13px', fontWeight: 'bold', margin: '2px 0 0' }}>{contract.contract_number}</p>
            <p style={{ fontSize: '9px', color: '#666', margin: 0 }}>
              Datum: {format(new Date(contract.contract_date), "d. MMMM yyyy", { locale: cs })}
            </p>
          </div>
        </div>

        {/* ===== SMLUVNÍ STRANY – dvousloupcový layout ===== */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
          {/* Dodavatel */}
          <div style={{ flex: 1 }}>
            <h2 style={sectionTitle}>Dodavatel</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ ...valueStyle, fontWeight: 'bold', paddingLeft: 0 }}>
                    {(contract as any).agency_name || 'YARO Travel s.r.o.'}
                  </td>
                </tr>
                {(contract as any).agency_address && (
                  <tr><td style={{ ...valueStyle, paddingLeft: 0 }}>{(contract as any).agency_address}</td></tr>
                )}
                {(contract as any).agency_ico && (
                  <tr><td style={{ ...valueStyle, paddingLeft: 0 }}>IČO: {(contract as any).agency_ico}</td></tr>
                )}
                {(contract as any).agency_contact && (
                  <tr><td style={{ ...valueStyle, paddingLeft: 0 }}>Kontakt: {(contract as any).agency_contact}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Zákazník */}
          <div style={{ flex: 1 }}>
            <h2 style={sectionTitle}>Zákazník</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ ...valueStyle, fontWeight: 'bold', paddingLeft: 0 }}>
                    {contract.client?.title ? `${contract.client.title} ` : ''}{contract.client?.first_name} {contract.client?.last_name}
                  </td>
                </tr>
                {contract.client?.date_of_birth && (
                  <tr><td style={{ ...valueStyle, paddingLeft: 0 }}>Nar.: {format(new Date(contract.client.date_of_birth), "d. M. yyyy")}</td></tr>
                )}
                {contract.client?.address && (
                  <tr><td style={{ ...valueStyle, paddingLeft: 0 }}>{contract.client.address}</td></tr>
                )}
                {contract.client?.email && (
                  <tr><td style={{ ...valueStyle, paddingLeft: 0 }}>{contract.client.email}</td></tr>
                )}
                {contract.client?.phone && (
                  <tr><td style={{ ...valueStyle, paddingLeft: 0 }}>{contract.client.phone}</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== PŘEDMĚT SMLOUVY ===== */}
        <div style={{ marginBottom: '10px' }}>
          <h2 style={sectionTitle}>Předmět smlouvy – Zájezd</h2>
          <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, width: '22%' }}>Destinace:</td>
                <td style={{ ...valueStyle, fontWeight: 'bold' }}>
                  {deal?.destination?.name}{deal?.destination?.country?.name ? `, ${deal.destination.country.name}` : ''}
                </td>
                <td style={{ ...labelStyle, width: '16%' }}>Celková cena:</td>
                <td style={{ ...valueStyle, fontWeight: 'bold', fontSize: '12px' }}>{formatPrice(deal?.total_price)}</td>
              </tr>
              {deal?.start_date && deal?.end_date && (
                <tr>
                  <td style={labelStyle}>Termín:</td>
                  <td style={valueStyle}>
                    {format(new Date(deal.start_date), "d. M. yyyy")} – {format(new Date(deal.end_date), "d. M. yyyy")}
                  </td>
                  <td style={labelStyle}>Způsob přepravy:</td>
                  <td style={valueStyle}>{getTransportationText()}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ===== ITINERÁŘ LETŮ ===== */}
        {hasFlights && (
          <div style={{ marginBottom: '10px' }}>
            <h2 style={sectionTitle}>Itinerář cesty – letecká přeprava</h2>
            {flightServices.map((flight: any) => {
              const legs = getFlightLegs(flight);
              return (
                <div key={flight.id} style={{ marginBottom: '6px' }}>
                  {legs.length > 0 ? (
                    <div style={{ fontSize: '10px' }}>
                      {legs.map((leg, idx) => (
                        <p key={idx} style={{ margin: '2px 0', lineHeight: 1.4 }}>
                          {formatFlightLeg(leg)}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '10px', margin: '2px 0' }}>
                      {flight.service_name}
                      {flight.start_date && flight.end_date
                        ? ` · ${format(new Date(flight.start_date), "d. M. yyyy")} – ${format(new Date(flight.end_date), "d. M. yyyy")}`
                        : ''}
                      {flight.description ? ` · ${flight.description}` : ''}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== CESTUJÍCÍ ===== */}
        {travelers.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <h2 style={sectionTitle}>Cestující</h2>
            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Jméno</th>
                  <th style={thStyle}>Datum narození</th>
                  <th style={thStyle}>Číslo pasu</th>
                </tr>
              </thead>
              <tbody>
                {travelers.map((t: any, idx: number) => (
                  <tr key={idx}>
                    <td style={tdStyle}>
                      {t.client?.title ? `${t.client.title} ` : ''}{t.client?.first_name} {t.client?.last_name}
                    </td>
                    <td style={tdStyle}>
                      {t.client?.date_of_birth ? format(new Date(t.client.date_of_birth), "d. M. yyyy") : '-'}
                    </td>
                    <td style={tdStyle}>{t.client?.passport_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== POSKYTNUTÉ SLUŽBY ===== */}
        {services.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <h2 style={sectionTitle}>Poskytnuté služby</h2>
            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Služba</th>
                  <th style={{ ...thStyle, width: '15%' }}>Termín</th>
                  <th style={{ ...thStyle, width: '8%', textAlign: 'center' }}>Osoby</th>
                  <th style={{ ...thStyle, width: '14%', textAlign: 'right' }}>Cena</th>
                </tr>
              </thead>
              <tbody>
                {services
                  .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                  .map((service: any) => (
                    <tr key={service.id}>
                      <td style={tdStyle}>
                        {service.service_name}
                        {service.description && (
                          <span style={{ display: 'block', fontSize: '8px', color: '#888' }}>{service.description}</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '9px' }}>
                        {service.start_date ? format(new Date(service.start_date), "d.M.") : ''}
                        {service.end_date ? ` – ${format(new Date(service.end_date), "d.M.")}` : ''}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>{service.person_count || '-'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(service.price)}</td>
                    </tr>
                  ))}
                <tr style={{ backgroundColor: '#f0f4f8' }}>
                  <td colSpan={3} style={{ padding: '4px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '10px' }}>Celkem:</td>
                  <td style={{ padding: '4px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '12px' }}>{formatPrice(deal?.total_price)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ===== PLATEBNÍ KALENDÁŘ ===== */}
        {payments.length > 0 && (
          <div style={{ marginBottom: '10px' }}>
            <h2 style={sectionTitle}>Platební kalendář</h2>
            <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Typ platby</th>
                  <th style={{ ...thStyle, width: '22%' }}>Splatnost</th>
                  <th style={{ ...thStyle, width: '20%', textAlign: 'right' }}>Částka</th>
                  <th style={{ ...thStyle, width: '18%', textAlign: 'center' }}>Stav</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => {
                  const typeLabels: Record<string, string> = {
                    deposit: 'Záloha',
                    deposit_1: '1. záloha',
                    deposit_2: '2. záloha',
                    deposit_3: '3. záloha',
                    final: 'Doplatek',
                    installment: 'Splátka',
                  };
                  return (
                    <tr key={payment.id}>
                      <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                        {typeLabels[payment.payment_type] || payment.payment_type}
                        {payment.notes && <span style={{ display: 'block', fontSize: '8px', color: '#888' }}>{payment.notes}</span>}
                      </td>
                      <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                        {format(new Date(payment.due_date), "d. M. yyyy")}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                        {formatPrice(payment.amount)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'middle', color: payment.paid ? '#16a34a' : '#666' }}>
                        {payment.paid ? '✓ Zaplaceno' : 'Nezaplaceno'}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f0f4f8' }}>
                  <td colSpan={2} style={{ padding: '4px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '10px' }}>Celkem k úhradě:</td>
                  <td style={{ padding: '4px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '12px' }}>
                    {formatPrice(payments.reduce((sum, p) => sum + (p.amount || 0), 0))}
                  </td>
                  <td style={{ padding: '4px 6px', textAlign: 'center', fontSize: '9px', color: '#666' }}>
                    {payments.filter(p => p.paid).length}/{payments.length} zaplaceno
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ===== PRÁVNÍ PODMÍNKY ===== */}
        <div style={{ marginBottom: '10px' }}>
          <h2 style={sectionTitle}>Právní podmínky</h2>
          <div style={{ fontSize: '8px', color: '#444', lineHeight: 1.4 }}>
            <p style={{ margin: '0 0 3px' }}>Tato smlouva je uzavřena podle §2521 a násl. zákona č. 89/2012 Sb., občanský zákoník, v účinném znění.</p>
            <p style={{ fontWeight: 'bold', margin: '4px 0 1px' }}>Storno podmínky (§2531-2533 OZ)</p>
            <p style={{ margin: '0 0 3px' }}>Zákazník může od smlouvy odstoupit kdykoliv před zahájením zájezdu za storno poplatek dle sazebníku, bez storno poplatku při podstatné změně podmínek zájezdu nebo při zrušení zájezdu cestovní kanceláří.</p>
            <p style={{ fontWeight: 'bold', margin: '4px 0 1px' }}>Pojištění (§2534 OZ)</p>
            <p style={{ margin: '0 0 3px' }}>Cestovní kancelář je pojištěna pro případ úpadku v souladu se zákonem.</p>
            <p style={{ fontWeight: 'bold', margin: '4px 0 1px' }}>Reklamace (§2536 OZ)</p>
            <p style={{ margin: 0 }}>Zákazník má právo reklamovat vady plnění. Reklamaci je nutné uplatnit bez zbytečného odkladu.</p>
          </div>
        </div>

        {/* ===== PODPISY ===== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', marginTop: '24px' }}>
          <div style={{ width: '44%', textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '6px', marginTop: '40px' }}>
              <p style={{ fontWeight: 'bold', margin: 0 }}>{(contract as any).agency_name || 'YARO Travel s.r.o.'}</p>
              <p style={{ color: '#666', fontSize: '8px', margin: '2px 0 0' }}>(podpis a razítko)</p>
            </div>
          </div>
          <div style={{ width: '44%', textAlign: 'center' }}>
            <div style={{ borderTop: '1px solid #000', paddingTop: '6px', marginTop: '40px' }}>
              <p style={{ fontWeight: 'bold', margin: 0 }}>{contract.client?.first_name} {contract.client?.last_name}</p>
              <p style={{ color: '#666', fontSize: '8px', margin: '2px 0 0' }}>(podpis zákazníka)</p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ContractPdfTemplate.displayName = "ContractPdfTemplate";
