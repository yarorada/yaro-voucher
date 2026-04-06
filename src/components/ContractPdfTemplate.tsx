import { forwardRef, useState, useEffect, useMemo } from "react";
import { getServiceTotal } from "@/lib/servicePrice";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { formatPrice, parseDateSafe } from "@/lib/utils";
import { generatePaymentQrDataUrl, bankAccountToIban, extractVariableSymbol } from "@/lib/spayd";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import radekPodpis from "@/assets/radek-podpis.png";



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
    const services = deal?.services || [];
    const currency = (contract as any).currency || deal?.currency || "CZK";

    // Sort travelers: main client first
    const sortedTravelers = useMemo(() => {
      const travelers = deal?.travelers || [];
      return [...travelers].sort((a: any, b: any) => {
        const aIsMain = a.client?.id === contract.client_id;
        const bIsMain = b.client?.id === contract.client_id;
        if (aIsMain && !bIsMain) return -1;
        if (!aIsMain && bIsMain) return 1;
        return 0;
      });
    }, [deal?.travelers, contract.client_id]);


    const payments: PaymentRecord[] = (contract.payments || [])
      .sort((a: PaymentRecord, b: PaymentRecord) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

    const bankAccount = (contract as any).agency_bank_account || '227993932/0600';
    const iban = bankAccountToIban(bankAccount);
    const contractNumber = contract.contract_number || '';
    const variableSymbol = extractVariableSymbol(contractNumber);

    // QR codes for each unpaid payment
    const unpaidPayments = payments.filter(p => !p.paid && (p.amount || 0) > 0);

    const [paymentQrUrls, setPaymentQrUrls] = useState<Record<string, string>>({});

    const isCzk = (currency || 'CZK').toUpperCase() === 'CZK';

    useEffect(() => {
      if (!isCzk || unpaidPayments.length === 0 || !contractNumber) {
        // Mark as ready even when no QR codes needed
        const el = document.getElementById('contract-pdf-content');
        if (el) el.setAttribute('data-qr-ready', 'true');
        return;
      }
      const generate = async () => {
        const urls: Record<string, string> = {};
        for (const p of unpaidPayments) {
          try {
            urls[p.id] = await generatePaymentQrDataUrl({
              amount: p.amount,
              contractNumber,
              bankAccount,
              size: 160,
            });
          } catch (e) { console.error(e); }
        }
        setPaymentQrUrls(urls);
      };
      generate();
    }, [unpaidPayments.length, contractNumber, bankAccount]);

    // Mark as ready after QR codes are generated
    useEffect(() => {
      if (!isCzk || unpaidPayments.length === 0) return;
      if (Object.keys(paymentQrUrls).length >= unpaidPayments.length) {
        const el = document.getElementById('contract-pdf-content');
        if (el) el.setAttribute('data-qr-ready', 'true');
      }
    }, [paymentQrUrls, unpaidPayments.length, isCzk]);

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

      if (details.outbound_segments || details.return_segments) {
        for (const seg of (details.outbound_segments || [])) {
          legs.push({ date: seg.date, airline_code: seg.airline, airline_name: seg.airline_name, flight_number: seg.flight_number, departure_airport: seg.departure, arrival_airport: seg.arrival, departure_time: seg.departure_time, arrival_time: seg.arrival_time });
        }
        for (const seg of (details.return_segments || [])) {
          legs.push({ date: seg.date, airline_code: seg.airline, airline_name: seg.airline_name, flight_number: seg.flight_number, departure_airport: seg.departure, arrival_airport: seg.arrival, departure_time: seg.departure_time, arrival_time: seg.arrival_time });
        }
        return legs;
      }

      if (details.outbound) {
        legs.push({ date: service.start_date || undefined, airline_code: details.outbound.airline, airline_name: details.outbound.airline_name, flight_number: details.outbound.flight_number, departure_airport: details.outbound.departure, arrival_airport: details.outbound.arrival, departure_time: details.outbound.departure_time, arrival_time: details.outbound.arrival_time });
      }
      if (details.return) {
        legs.push({ date: service.end_date || undefined, airline_code: details.return.airline, airline_name: details.return.airline_name, flight_number: details.return.flight_number, departure_airport: details.return.departure, arrival_airport: details.return.arrival, departure_time: details.return.departure_time, arrival_time: details.return.arrival_time });
      }

      if (details.segments) {
        for (const seg of details.segments) {
          legs.push({ date: seg.date, airline_code: seg.airline, airline_name: seg.airline_name, flight_number: seg.flight_number, departure_airport: seg.departure_airport || seg.departure, arrival_airport: seg.arrival_airport || seg.arrival, departure_time: seg.departure_time, arrival_time: seg.arrival_time });
        }
      }

      return legs;
    };

    const formatFlightLeg = (leg: ParsedFlightLeg): string => {
      const parts: string[] = [];
      if (leg.date) {
        try { const d = parseDateSafe(leg.date); parts.push(d ? format(d, "dd.MM.yy") : leg.date); } catch { parts.push(leg.date); }
      }
      const flightId = [
        leg.airline_code && leg.flight_number ? `${leg.airline_code}${leg.flight_number}` : (leg.flight_number || ''),
        leg.airline_name || ''
      ].filter(Boolean).join(' ');
      if (flightId) parts.push(flightId);
      if (leg.departure_airport || leg.arrival_airport) {
        parts.push(`${leg.departure_airport || '?'} → ${leg.arrival_airport || '?'}`);
      }
      if (leg.departure_time) parts.push(`Odlet: ${leg.departure_time}`);
      if (leg.arrival_time) parts.push(`Přílet: ${leg.arrival_time}`);
      return parts.join(' • ');
    };

    // Shared cell styles
    const labelStyle: React.CSSProperties = { padding: '2px 0', color: '#666', fontSize: '9px', verticalAlign: 'middle', lineHeight: '1.2' };
    const valueStyle: React.CSSProperties = { padding: '2px 0 2px 6px', fontSize: '9px', verticalAlign: 'middle', lineHeight: '1.2' };
    const sectionTitle: React.CSSProperties = { fontSize: '10px', fontWeight: 'bold', marginTop: '10px', marginBottom: '5px', color: '#0066cc', textTransform: 'uppercase', borderBottom: '1px solid #0066cc', paddingBottom: '4px', lineHeight: '1.4' };
    const thStyle: React.CSSProperties = { padding: '6px 6px', textAlign: 'left', borderBottom: '1px solid #ccc', fontSize: '7px', fontWeight: 'bold', backgroundColor: '#f0f4f8', lineHeight: '1.3', verticalAlign: 'middle' };
    const tdStyle: React.CSSProperties = { padding: '6px 6px', borderBottom: '1px solid #eee', fontSize: '8px', lineHeight: '1.3', verticalAlign: 'middle' };

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
          lineHeight: 1.2,
        }}
      >
        {/* ===== HLAVIČKA ===== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', borderBottom: '2px solid #0066cc', paddingBottom: '6px' }}>
          <div>
            <img src={yaroLogo} alt="YARO Travel" style={{ height: '36px', marginBottom: '2px' }} className="logo-dark-mode" />
          </div>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{ fontSize: '16px', fontWeight: 'bold', margin: 0, color: '#0066cc' }}>CESTOVNÍ SMLOUVA</h1>
            <p style={{ fontSize: '12px', fontWeight: 'bold', margin: '1px 0 0' }}>{contract.contract_number}</p>
            <p style={{ fontSize: '8px', color: '#666', margin: 0 }}>
              Datum: {(() => { const d = parseDateSafe(contract.contract_date); return d ? format(d, "d. MMMM yyyy", { locale: cs }) : contract.contract_date; })()}
            </p>
          </div>
        </div>

        {/* ===== SMLUVNÍ STRANY ===== */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
          <div style={{ flex: 1 }}>
            <h2 style={sectionTitle}>Dodavatel</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ ...valueStyle, fontWeight: 'bold', padding: '2px 0' }}>{(contract as any).agency_name || 'YARO Travel s.r.o.'}</td></tr>
                <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>Adresa: </span>{(contract as any).agency_address || '-'}</td></tr>
                <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>IČO: </span>{(contract as any).agency_ico || '-'}</td></tr>
                <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>E-mail: </span>radek@yarotravel.cz</td></tr>
                <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>Telefon: </span>+420 602 102 108</td></tr>
              </tbody>
            </table>
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={sectionTitle}>Zákazník / prodejce</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <tbody>
                <tr><td style={{ ...valueStyle, fontWeight: 'bold', padding: '2px 0' }}>
                  {contract.client?.company_as_orderer && contract.client?.company_name
                    ? contract.client.company_name
                    : `${contract.client?.title ? `${contract.client.title} ` : ''}${contract.client?.first_name} ${contract.client?.last_name}`}
                </td></tr>
                <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>Adresa: </span>{contract.client?.address || '-'}</td></tr>
                {contract.client?.company_as_orderer
                  ? <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>IČO: </span>{(contract.client as any)?.ico || '-'}</td></tr>
                  : <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>Datum narození: </span>{contract.client?.date_of_birth ? (() => { const d = parseDateSafe(contract.client.date_of_birth); return d ? format(d, "d. M. yyyy") : '-'; })() : '-'}</td></tr>
                }
                <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>E-mail: </span>{contract.client?.email || '-'}</td></tr>
                <tr><td style={{ ...valueStyle, padding: '2px 0' }}><span style={{ color: '#666', fontSize: '9px' }}>Telefon: </span>{contract.client?.phone || '-'}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* ===== PŘEDMĚT SMLOUVY ===== */}
        <div style={{ marginBottom: '6px' }}>
          <h2 style={sectionTitle}>Předmět smlouvy – Zájezd</h2>
          <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ ...labelStyle, width: '22%' }}>Destinace:</td>
                <td style={{ ...valueStyle, fontWeight: 'bold' }}>
                  {deal?.destination?.name}{deal?.destination?.country?.name ? `, ${deal.destination.country.name}` : ''}
                </td>
                <td style={{ ...labelStyle, width: '16%' }}>Celková cena:</td>
                <td style={{ ...valueStyle, fontWeight: 'bold', fontSize: '11px' }}>{formatPrice(services.length > 0 ? services.reduce((sum: number, s: any) => sum + getServiceTotal(s), 0) : (deal?.total_price ?? contract.total_price), true, currency)}</td>
              </tr>
              {deal?.start_date && deal?.end_date && (
                <tr>
                  <td style={labelStyle}>Termín:</td>
                  <td style={valueStyle}>
                    {(() => { const ds = parseDateSafe(deal.start_date); const de = parseDateSafe(deal.end_date); return `${ds ? format(ds, "d. M. yyyy") : ''} – ${de ? format(de, "d. M. yyyy") : ''}`; })()}
                  </td>
                  <td style={labelStyle}>Způsob přepravy:</td>
                  <td style={valueStyle}>{getTransportationText()}</td>
                </tr>
              )}
              <tr>
                <td style={labelStyle}>Hotel:</td>
                <td style={valueStyle} colSpan={3}>
                  {(() => {
                    const hotelService = services.find((s: any) => s.service_type === 'hotel');
                    if (!hotelService) return '-';
                    return hotelService.service_name + (hotelService.description ? ` – ${hotelService.description}` : '');
                  })()}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ===== ITINERÁŘ LETŮ ===== */}
        {hasFlights && (
          <div style={{ marginBottom: '6px' }}>
            <h2 style={sectionTitle}>Itinerář cesty – letecká přeprava</h2>
            {flightServices.map((flight: any) => {
              const legs = getFlightLegs(flight);
              const details = flight.details ? (typeof flight.details === 'string' ? JSON.parse(flight.details) : flight.details) : {};
              const baggage = details.baggage || {};

              // Build baggage lines from OP (deal service details)
              const baggageItems: { label: string; kg?: number; count?: number }[] = [];
              if (baggage.cabin_bag?.included) {
                baggageItems.push({ label: 'Taška na palubu', kg: baggage.cabin_bag.kg, count: baggage.cabin_bag.count });
              }
              if (baggage.hand_luggage?.included) {
                baggageItems.push({ label: 'Palubní zavazadlo', kg: baggage.hand_luggage.kg, count: baggage.hand_luggage.count });
              }
              if (baggage.checked_luggage?.included) {
                baggageItems.push({ label: 'Odbavené zavazadlo', kg: baggage.checked_luggage.kg, count: baggage.checked_luggage.count });
              }
              if (baggage.golf_bag?.included) {
                baggageItems.push({ label: 'Golfový bag', kg: baggage.golf_bag.kg, count: baggage.golf_bag.count });
              }

              return (
                <div key={flight.id} style={{ marginBottom: '4px' }}>
                  {legs.length > 0 ? (
                    <div style={{ fontSize: '9px' }}>
                      {legs.map((leg, idx) => (
                        <p key={idx} style={{ margin: '2px 0', lineHeight: 1.2 }}>{formatFlightLeg(leg)}</p>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: '9px', margin: '2px 0' }}>
                      {flight.service_name}
                      {flight.start_date && flight.end_date ? ` · ${(() => { const ds = parseDateSafe(flight.start_date); const de = parseDateSafe(flight.end_date); return `${ds ? format(ds, "d. M. yyyy") : ''} – ${de ? format(de, "d. M. yyyy") : ''}`; })()}` : ''}
                      {flight.description ? ` · ${flight.description}` : ''}
                    </p>
                  )}
                  {baggageItems.length > 0 && (
                    <div style={{ fontSize: '8.5px', margin: '3px 0 1px 0', color: '#444', lineHeight: 1.3 }}>
                      <span style={{ fontWeight: 600 }}>Zavazadla: </span>
                      {baggageItems.map((b, i) => (
                        <span key={i}>
                          {i > 0 && <span style={{ margin: '0 4px', color: '#aaa' }}>|</span>}
                          {b.count && b.count > 1 ? `${b.count}x ` : ''}{b.label}{b.kg ? <span style={{ fontWeight: 600 }}> {b.kg} kg</span> : ''}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ===== CESTUJÍCÍ ===== */}
        {sortedTravelers.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <h2 style={sectionTitle}>Cestující</h2>
            <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, width: '5%', textAlign: 'center' }}>#</th>
                  <th style={thStyle}>Jméno</th>
                  <th style={thStyle}>Datum narození</th>
                  <th style={thStyle}>Číslo pasu</th>
                </tr>
              </thead>
              <tbody>
                {sortedTravelers.map((t: any, idx: number) => (
                  <tr key={idx}>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      {idx + 1}
                    </td>
                    <td style={tdStyle}>{t.client?.title ? `${t.client.title} ` : ''}{t.client?.first_name} {t.client?.last_name}</td>
                    <td style={tdStyle}>{t.client?.date_of_birth ? (() => { const d = parseDateSafe(t.client.date_of_birth); return d ? format(d, "d. M. yyyy") : '-'; })() : '-'}</td>
                    <td style={tdStyle}>{t.client?.passport_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ===== POSKYTNUTÉ SLUŽBY ===== */}
        {services.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <h2 style={sectionTitle}>Poskytnuté služby</h2>
            <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Služba</th>
                  <th style={{ ...thStyle, width: '15%' }}>Termín</th>
                  <th style={{ ...thStyle, width: '6%', textAlign: 'center' }}>Osoby</th>
                  <th style={{ ...thStyle, width: '13%', textAlign: 'right' }}>Cena/os.</th>
                  <th style={{ ...thStyle, width: '13%', textAlign: 'right' }}>Cena</th>
                </tr>
              </thead>
              <tbody>
                {services
                  .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                  .map((service: any) => {
                    // Build baggage line for flight services
                    let baggageLine: string | null = null;
                    if (service.service_type === 'flight' && service.details) {
                      const details = typeof service.details === "string" ? JSON.parse(service.details) : service.details;
                      const b = details?.baggage;
                      if (b) {
                        const parts: string[] = [];
                        const fmtCount = (c?: number) => c && c > 1 ? `${c}x ` : '';
                        if (b.cabin_bag?.included) parts.push(`${fmtCount(b.cabin_bag.count)}Taška`);
                        if (b.hand_luggage?.included) parts.push(`${fmtCount(b.hand_luggage.count)}Palubní${b.hand_luggage.kg ? ` ${b.hand_luggage.kg} kg` : ''}`);
                        if (b.checked_luggage?.included) parts.push(`${fmtCount(b.checked_luggage.count)}Odbavené${b.checked_luggage.kg ? ` ${b.checked_luggage.kg} kg` : ''}`);
                        if (b.golf_bag?.included) parts.push(`${fmtCount(b.golf_bag.count)}Golfbag${b.golf_bag.kg ? ` ${b.golf_bag.kg} kg` : ''}`);
                        if (parts.length > 0) baggageLine = parts.join(', ');
                      }
                    }
                    return (
                      <tr key={service.id}>
                        <td style={tdStyle}>
                          {service.service_name}
                          {service.description && <span style={{ display: 'block', fontSize: '7px', color: '#888', lineHeight: '1.2', marginTop: '1px' }}>{service.description}</span>}
                          {baggageLine && <span style={{ display: 'block', fontSize: '7px', color: '#888', lineHeight: '1.2', marginTop: '1px' }}>{baggageLine}</span>}
                        </td>
                        <td style={{ ...tdStyle, whiteSpace: 'nowrap', fontSize: '8px' }}>
                          {service.start_date ? (() => { const d = parseDateSafe(service.start_date); return d ? format(d, "d.M.") : ''; })() : ''}
                          {service.end_date ? ` – ${(() => { const d = parseDateSafe(service.end_date); return d ? format(d, "d.M.") : ''; })()}` : ''}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>{service.person_count || '-'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold' }}>{formatPrice(getServiceTotal(service), true, currency)}</td>
                      </tr>
                    );
                  })}
                <tr style={{ backgroundColor: '#f0f4f8' }}>
                  <td colSpan={3} style={{ padding: '6px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '9px', verticalAlign: 'middle' }}>Celkem:</td>
                  <td style={{ padding: '6px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '11px', verticalAlign: 'middle' }}>{formatPrice(services.reduce((sum: number, s: any) => sum + getServiceTotal(s), 0), true, currency)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* ===== PLATEBNÍ KALENDÁŘ S QR KÓDY ===== */}
        {payments.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <h2 style={sectionTitle}>Platební kalendář</h2>
            {/* Tabulka plateb - plná šířka */}
            <table style={{ width: '100%', fontSize: '9px', borderCollapse: 'collapse' }}>
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
                        {payment.notes && <span style={{ display: 'block', fontSize: '7px', color: '#888', lineHeight: '1.2', marginTop: '1px' }}>{payment.notes}</span>}
                      </td>
                      <td style={{ ...tdStyle, verticalAlign: 'middle' }}>
                        {(() => { const d = parseDateSafe(payment.due_date); return d ? format(d, "d. M. yyyy") : payment.due_date; })()}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 'bold', verticalAlign: 'middle' }}>
                        {formatPrice(payment.amount, true, currency)}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center', verticalAlign: 'middle', color: payment.paid ? '#16a34a' : '#666' }}>
                        {payment.paid ? '✓ Zaplaceno' : 'Nezaplaceno'}
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ backgroundColor: '#f0f4f8' }}>
                  <td colSpan={2} style={{ padding: '6px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '9px', verticalAlign: 'middle' }}>Celkem k úhradě:</td>
                  <td style={{ padding: '6px 6px', fontWeight: 'bold', textAlign: 'right', fontSize: '11px', verticalAlign: 'middle' }}>
                    {formatPrice(payments.reduce((sum, p) => sum + (p.amount || 0), 0), true, currency)}
                  </td>
                  <td style={{ padding: '6px 6px', textAlign: 'center', fontSize: '7px', color: '#666', verticalAlign: 'middle' }}>
                    {payments.filter(p => p.paid).length}/{payments.length} zaplaceno
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Platební údaje + QR kódy vedle sebe */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                {isCzk ? (
                  <div style={{ padding: '4px 6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '8px' }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '8px' }}>Platební údaje</p>
                    <p style={{ margin: '1px 0' }}>Číslo účtu: <strong>{bankAccount}</strong></p>
                    <p style={{ margin: '1px 0' }}>IBAN: <strong>{iban}</strong></p>
                    <p style={{ margin: '1px 0' }}>Variabilní symbol: <strong>{variableSymbol}</strong></p>
                  </div>
                ) : (
                  <div style={{ padding: '4px 6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', fontSize: '8px' }}>
                    <p style={{ margin: '0 0 2px', fontWeight: 'bold', fontSize: '8px' }}>Platební údaje</p>
                    <p style={{ margin: '1px 0' }}>Příjemce: <strong>YARO s.r.o.</strong></p>
                    <p style={{ margin: '1px 0' }}>IBAN: <strong>DE89202208000051200891</strong> · SWIFT: <strong>SXPYDEHH</strong></p>
                    <p style={{ margin: '1px 0' }}>Banka: <strong>BANKING CIRCLE S.A.</strong> <span style={{ fontSize: '7px', color: '#666' }}>(Maximilanstr 54, München, 80538, Germany)</span></p>
                    <p style={{ margin: '1px 0' }}>Variabilní symbol: <strong>{variableSymbol}</strong></p>
                  </div>
                )}
              </div>

              {/* QR kódy vedle sebe – only for CZK */}
              {isCzk && unpaidPayments.length > 0 && Object.keys(paymentQrUrls).length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  {unpaidPayments.map((p) => {
                    const url = paymentQrUrls[p.id];
                    if (!url) return null;
                    const typeLabels: Record<string, string> = {
                      deposit: 'Záloha', deposit_1: '1. záloha', deposit_2: '2. záloha', deposit_3: '3. záloha',
                      final: 'Doplatek', installment: 'Splátka',
                    };
                    return (
                      <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <img src={url} alt="QR platba" style={{ width: '70px', height: '70px' }} />
                        <p style={{ fontSize: '6px', color: '#666', marginTop: '1px', textAlign: 'center', lineHeight: '1.2', margin: '1px 0 0' }}>
                          {typeLabels[p.payment_type] || p.payment_type}
                        </p>
                        <p style={{ fontSize: '7px', fontWeight: 'bold', color: '#0066cc', margin: '0', textAlign: 'center' }}>
                          {formatPrice(p.amount, true, currency)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== OSTATNÍ INFORMACE A POŽADAVKY ===== */}
        {(contract as any).tee_times?.length > 0 && (
          <div style={{ marginBottom: '6px' }}>
            <h2 style={sectionTitle}>Ostatní informace a požadavky</h2>
            <p style={{ fontSize: '8px', fontWeight: 'bold', color: '#333', margin: '0 0 3px' }}>Startovací časy (Tee Times)</p>
            <div style={{ fontSize: '9px', lineHeight: '1.5' }}>
              {(contract as any).tee_times.map((tt: any, idx: number) => {
                const dateStr = tt.date ? (() => { const d = parseDateSafe(tt.date); return d ? format(d, "dd.MM.yy") : tt.date; })() : '-';
                return (
                  <p key={idx} style={{ margin: '1px 0' }}>
                    {dateStr} – {tt.club} – {tt.time || '-'}
                  </p>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== PRÁVNÍ PODMÍNKY ===== */}
        <div style={{ marginBottom: '6px' }}>
          <h2 style={sectionTitle}>Právní podmínky</h2>
          <div style={{ fontSize: '7px', color: '#444', lineHeight: 1.3, textAlign: 'justify' }}>
            <p style={{ margin: '0 0 3px' }}>
              Tato Smlouva o zájezdu má náležitosti a nahrazuje potvrzení o zájezdu ve smyslu ustanovení par. 2525 a násl. OZ. Pořadatel zájezdu se zavazuje, že zákazníkovi poskytne zájezd a zákazník se zavazuje zaplatit smluvenou cenu. Zákazník se zavazuje uhradit smluvenou cenu zájezdu na účet zprostředkovatele s tím, že zprostředkovatel je k tomu inkasu zmocněn pořadatelem zájezdu.
            </p>
            <p style={{ margin: '0 0 3px' }}>
              Zákazník prohlašuje, že uzavírá tuto cestovní smlouvu i ve prospěch následujících osob (cestujících), které ho k jejich přihlášení a účasti pověřili. Zákazník se zavazuje zajistit, aby všichni cestující řádně dodržovali všechny povinnosti vyplývající pro ně z jejich účasti na zájezdu.
            </p>
            <p style={{ margin: '0 0 3px' }}>
              Zákazník tímto potvrzuje, (a) že mu byly současně s návrhem této smlouvy zaslány všeobecné smluvní podmínky pořadatele zájezdu, s kterými se podrobně seznámil, bez výhrady s nimi souhlasí a bere na vědomí, že tyto podmínky tvoří nedílnou součást této smlouvy, (b) že mu byly před uzavřením této smlouvy předány informace (ve formě katalogu, katalogového listu, dodatečné nabídky či jiným vhodným způsobem) s podrobným vymezením zájezdu, zejména ohledně ubytování, jeho polohy, kategorie, stupně vybavenosti a hlavní charakteristické znaky, dále druhu, charakteristiky a kategorie dopravního prostředku a údajů o trase cesty, pasových a vízových požadavcích a zdravotních formalitách, které jsou nutné pro cestu a pobyt, a dále způsobu a rozsahu stravování (pokud je součástí zájezdu), případně ohledně dalších služeb, pokud jsou součástí zájezdu, a bere na vědomí, že tyto informace tvoří součást této smlouvy, (c) že mu byl předán doklad, který obsahuje informace o uzavřeném pojištění proti úpadku cestovní kanceláře, zejména označení pojišťovny, podmínky pojištění a způsob oznámení pojistné události, (d) že se seznámil s pojistnými podmínkami cestovního pojištění.
            </p>
            <p style={{ margin: '0 0 3px' }}>
              Zákazník tímto uděluje souhlas pořadateli zájezdu a zprostředkovateli ke shromažďování, uchování a zpracování jeho osobních údajů a osobních údajů dalších cestujících. Tento souhlas uděluje pro všechny údaje uvedené v cestovní smlouvě a v dokumentech s ní souvisejících, a to výhradně za účelem zajištění cestovních služeb a dále nabízení výrobků a služeb.
            </p>
            <p style={{ margin: 0 }}>
              Cestovní smlouva je uzavřena okamžikem, kdy zprostředkovatel oznámí zákazníkovi, že pořadatel akceptoval zákazníkem doručený a podepsaný návrh cestovní smlouvy. Podepsaný návrh cestovní smlouvy je zákazník povinen doručit zprostředkovateli na jeho shora uvedenou adresu. Doručení jiné osobě není přípustné.
            </p>
          </div>
        </div>

        {/* ===== DATUM + PODPISY (drží pohromadě) ===== */}
        <div style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
          <p style={{ fontSize: '9px', margin: '8px 0 6px', color: '#333' }}>
            V Pardubicích dne {(() => { const d = parseDateSafe(contract.contract_date); return d ? format(d, "d. M. yyyy", { locale: cs }) : contract.contract_date; })()}
          </p>

          <div data-pdf-section="signatures" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', paddingTop: '6px' }}>
            <div style={{ width: '44%', textAlign: 'center' }}>
              <p style={{ fontSize: '8px', color: '#666', margin: '0 0 3px' }}>Dodavatel:</p>
              <div style={{ textAlign: 'center', marginTop: '4px' }}>
                <img src={radekPodpis} alt="Podpis" style={{ height: '60px', margin: '0 auto 2px', imageRendering: 'auto' }} />
              </div>
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px' }}>
                <p style={{ fontWeight: 'bold', margin: 0, lineHeight: 1.3 }}>Radek Jaroměřský</p>
                <p style={{ color: '#666', fontSize: '7px', margin: '1px 0 0' }}>{(contract as any).agency_name || 'YARO s.r.o.'}</p>
              </div>
            </div>
            <div style={{ width: '44%', textAlign: 'center' }}>
              <p style={{ fontSize: '8px', color: '#666', margin: '0 0 3px' }}>Zákazník:</p>
              {contract.signature_url ? (
                <div style={{ textAlign: 'center', marginTop: '4px' }}>
                  <img src={contract.signature_url} alt="Podpis zákazníka" style={{ height: '40px', margin: '0 auto 2px' }} />
                </div>
              ) : null}
              <div style={{ borderTop: '1px solid #000', paddingTop: '4px', marginTop: contract.signature_url ? '0' : '22px' }}>
                <p style={{ fontWeight: 'bold', margin: 0, lineHeight: 1.3 }}>{contract.client?.first_name} {contract.client?.last_name}</p>
                {!contract.signature_url && <p style={{ color: '#666', fontSize: '7px', margin: '1px 0 0' }}>(podpis zákazníka)</p>}
              </div>
            </div>
          </div>
          {/* Spacer to prevent footer clipping */}
          <div style={{ height: '20px' }}></div>
        </div>
      </div>
    );
  }
);

ContractPdfTemplate.displayName = "ContractPdfTemplate";
