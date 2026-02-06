import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Send, FileSignature, Pencil, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { ContractAgencyInfo } from "@/components/ContractAgencyInfo";
import { ContractPaymentSchedule } from "@/components/ContractPaymentSchedule";
import { ContractServiceAssignment } from "@/components/ContractServiceAssignment";
import { CreateVoucherFromContract } from "@/components/CreateVoucherFromContract";
import { EditContractDialog } from "@/components/EditContractDialog";
import { formatPrice } from "@/lib/utils";
import html2pdf from "html2pdf.js";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { toast } from "sonner";

const ContractDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const pdfContentRef = useRef<HTMLDivElement>(null);
  const { data: contract, isLoading, error: queryError, refetch } = useQuery({
    queryKey: ["travel_contract", id],
    queryFn: async () => {
      console.log("Fetching contract with ID:", id);
      // @ts-ignore - Supabase types not updated after migration
      const { data, error } = await (supabase as any)
        .from("travel_contracts")
        .select(`
          *,
          client:clients(*),
          deal:deals(
            id,
            *,
            destination:destinations(
              name,
              country:countries(name, iso_code)
            ),
            travelers:deal_travelers(
              client:clients(*)
            ),
            services:deal_services(
              *,
              supplier:suppliers(name)
            )
          )
        `)
        .eq("id", id)
        .maybeSingle();

      console.log("Query result:", { data, error });
      if (error) {
        console.error("Error fetching contract:", error);
        throw error;
      }
      return data;
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      draft: { variant: "secondary", label: "Koncept" },
      sent: { variant: "default", label: "Odesláno" },
      signed: { variant: "outline", label: "Podepsáno" },
      cancelled: { variant: "destructive", label: "Zrušeno" },
    };
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleDownloadPdf = async () => {
    const element = pdfContentRef.current;
    if (!element) return;

    setIsGeneratingPdf(true);
    try {
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `Smlouva_${contract?.contract_number || 'export'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          letterRendering: true,
          onclone: (clonedDoc: Document) => {
            clonedDoc.documentElement.classList.remove('dark');
            const clonedElement = clonedDoc.getElementById('contract-pdf-content');
            if (clonedElement) {
              clonedElement.style.backgroundColor = '#ffffff';
              clonedElement.style.color = '#000000';
              clonedElement.style.display = 'block';

              const bgMuted = clonedElement.querySelectorAll('.bg-muted, .bg-muted\\/50');
              bgMuted.forEach(el => { (el as HTMLElement).style.backgroundColor = '#f5f5f5'; });
              const textForeground = clonedElement.querySelectorAll('.text-foreground');
              textForeground.forEach(el => { (el as HTMLElement).style.color = '#000000'; });
              const textMuted = clonedElement.querySelectorAll('.text-muted-foreground');
              textMuted.forEach(el => { (el as HTMLElement).style.color = '#666666'; });
              const logos = clonedElement.querySelectorAll('.logo-dark-mode');
              logos.forEach(el => { (el as HTMLElement).style.filter = 'none'; });
            }
          }
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4' as const,
          orientation: 'portrait' as const
        },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      await html2pdf().set(opt).from(element).save();
      toast.success('PDF úspěšně staženo');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Chyba při generování PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Načítání smlouvy...</p>
      </div>
    );
  }

  if (queryError) {
    console.error("Contract query error:", queryError);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Chyba při načítání smlouvy</h2>
          <p className="text-muted-foreground mb-4">{(queryError as Error).message}</p>
          <Button onClick={() => navigate("/contracts")} className="mt-4">
            Zpět na seznam
          </Button>
        </div>
      </div>
    );
  }

  if (!contract) {
    console.log("Contract not found for ID:", id);
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">Smlouva nenalezena</h2>
          <p className="text-muted-foreground mb-2">ID: {id}</p>
          <Button onClick={() => navigate("/contracts")} className="mt-4">
            Zpět na seznam
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
            <h1 className="text-2xl md:text-4xl font-bold text-foreground">{contract.contract_number}</h1>
            {getStatusBadge(contract.status)}
          </div>
          <p className="text-muted-foreground">
            Obchodní případ: {contract.deal?.name || contract.deal?.destination?.name || contract.deal?.deal_number}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 mb-8">
          <Button variant="outline" size="sm" className="md:size-default" onClick={() => setEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Upravit</span>
          </Button>
          <CreateVoucherFromContract 
            contractId={contract.id} 
            contractStatus={contract.status} 
          />
          <Button variant="outline" size="sm" className="md:size-default">
            <Send className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Odeslat</span>
          </Button>
          <Button variant="outline" size="sm" className="md:size-default">
            <FileSignature className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Podepsat</span>
          </Button>
          <Button size="sm" className="md:size-default" onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
            {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
            <span className="hidden sm:inline">{isGeneratingPdf ? 'Generuji...' : 'Stáhnout PDF'}</span>
            <span className="sm:hidden">PDF</span>
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Základní informace */}
          <Card className="p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Základní informace</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Číslo smlouvy</p>
                <p className="font-medium text-foreground">{contract.contract_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                {getStatusBadge(contract.status)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Vytvořeno</p>
                <p className="font-medium text-foreground">
                  {format(new Date(contract.created_at), "d. MMMM yyyy", { locale: cs })}
                </p>
              </div>
              {contract.signed_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Podepsáno</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(contract.signed_at), "d. MMMM yyyy", { locale: cs })}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Klient */}
          <Card className="p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Zákazník</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Jméno a příjmení</p>
                <p className="font-medium text-foreground">
                  {contract.client?.first_name} {contract.client?.last_name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium text-foreground">
                  {contract.client?.email || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Telefon</p>
                <p className="font-medium text-foreground">
                  {contract.client?.phone || '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Adresa</p>
                <p className="font-medium text-foreground">
                  {contract.client?.address || '-'}
                </p>
              </div>
            </div>
          </Card>

          {/* Zájezd */}
          <Card className="p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Předmět smlouvy - Zájezd</h2>
            <div className="grid md:grid-cols-2 gap-3 md:gap-4 mb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Destinace</p>
                <p className="font-medium text-foreground">
                  {contract.deal?.destination?.name}, {contract.deal?.destination?.country?.name}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Celková cena</p>
                <p className="font-medium text-foreground text-xl">
                  {formatPrice(contract.deal?.total_price)}
                </p>
              </div>
              {contract.deal?.start_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Datum začátku</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(contract.deal.start_date), "d. MMMM yyyy", { locale: cs })}
                  </p>
                </div>
              )}
              {contract.deal?.end_date && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Datum konce</p>
                  <p className="font-medium text-foreground">
                    {format(new Date(contract.deal.end_date), "d. MMMM yyyy", { locale: cs })}
                  </p>
                </div>
              )}
            </div>
            {contract.deal?.notes && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Popis programu</p>
                <p className="text-foreground">{contract.deal.notes}</p>
              </div>
            )}
          </Card>

          {/* Cestující */}
          {contract.deal?.travelers && contract.deal.travelers.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Cestující</h2>
              <div className="space-y-3">
                {contract.deal.travelers.map((traveler: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {traveler.client?.first_name} {traveler.client?.last_name}
                      </p>
                      {traveler.client?.date_of_birth && (
                        <p className="text-sm text-muted-foreground">
                          Datum narození: {format(new Date(traveler.client.date_of_birth), "d. M. yyyy", { locale: cs })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Služby */}
          {contract.deal?.services && contract.deal.services.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Poskytnuté služby</h2>
              <div className="space-y-3">
                {contract.deal.services.map((service: any) => (
                  <div key={service.id} className="p-4 border border-border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <p className="font-medium text-foreground">{service.service_name}</p>
                        <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                          {service.person_count && (
                            <span>👥 {service.person_count} {service.person_count === 1 ? 'osoba' : service.person_count < 5 ? 'osoby' : 'osob'}</span>
                          )}
                          <span>Dodavatel: {service.supplier?.name || "-"}</span>
                        </div>
                      </div>
                      <p className="font-bold text-foreground">
                        {formatPrice(service.price)}
                      </p>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Dodavatel služeb */}
          <ContractAgencyInfo
            contractId={contract.id}
            agencyName={(contract as any).agency_name}
            agencyAddress={(contract as any).agency_address}
            agencyIco={(contract as any).agency_ico}
            agencyContact={(contract as any).agency_contact}
            onUpdate={refetch}
          />

          {/* Platební kalendář */}
          <ContractPaymentSchedule 
            contractId={contract.id} 
            totalPrice={contract.deal?.total_price}
            departureDate={contract.deal?.start_date}
          />

          {/* Přiřazení cestujících ke službám */}
          {contract.deal?.id && (
            <ContractServiceAssignment
              contractId={contract.id}
              dealId={contract.deal.id}
            />
          )}

          {/* Právní podmínky */}
          <Card className="p-4 md:p-6">
            <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Právní podmínky</h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground">
                Tato smlouva je uzavřena podle §2521 a násl. zákona č. 89/2012 Sb., občanský zákoník, v účinném znění.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Storno podmínky (§2531-2533 OZ)</h3>
              <p className="text-muted-foreground mb-2">Zákazník může od smlouvy odstoupit:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Kdykoliv před zahájením zájezdu za storno poplatek dle sazebníku</li>
                <li>Bez storno poplatku při podstatné změně podmínek zájezdu</li>
                <li>Bez storno poplatku při zrušení zájezdu cestovní kanceláří</li>
              </ul>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Pojištění (§2534 OZ)</h3>
              <p className="text-muted-foreground">
                Cestovní kancelář je pojištěna pro případ úpadku v souladu se zákonem.
              </p>
              <h3 className="text-lg font-semibold text-foreground mt-4 mb-2">Reklamace (§2536 OZ)</h3>
              <p className="text-muted-foreground">
                Zákazník má právo reklamovat vady plnění. Reklamaci je nutné uplatnit bez zbytečného odkladu.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Hidden PDF content */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={pdfContentRef} id="contract-pdf-content" style={{ width: '210mm', padding: '15mm', fontFamily: 'Arial, sans-serif', backgroundColor: '#ffffff', color: '#000000' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '2px solid #0066cc', paddingBottom: '15px' }}>
            <div>
              <img src={yaroLogo} alt="YARO Travel" style={{ height: '40px', marginBottom: '8px' }} className="logo-dark-mode" />
              {(contract as any).agency_name && <p style={{ fontSize: '12px', color: '#666' }}>{(contract as any).agency_name}</p>}
              {(contract as any).agency_address && <p style={{ fontSize: '11px', color: '#666' }}>{(contract as any).agency_address}</p>}
              {(contract as any).agency_ico && <p style={{ fontSize: '11px', color: '#666' }}>IČO: {(contract as any).agency_ico}</p>}
            </div>
            <div style={{ textAlign: 'right' }}>
              <h1 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0, color: '#0066cc' }}>CESTOVNÍ SMLOUVA</h1>
              <p style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '4px' }}>{contract.contract_number}</p>
              <p style={{ fontSize: '11px', color: '#666' }}>
                Datum: {format(new Date(contract.contract_date), "d. MMMM yyyy", { locale: cs })}
              </p>
            </div>
          </div>

          {/* Zákazník */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#0066cc', textTransform: 'uppercase' }}>Zákazník</h2>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', width: '30%', color: '#666' }}>Jméno a příjmení:</td>
                  <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>{contract.client?.title ? `${contract.client.title} ` : ''}{contract.client?.first_name} {contract.client?.last_name}</td>
                </tr>
                {contract.client?.date_of_birth && (
                  <tr>
                    <td style={{ padding: '4px 8px', color: '#666' }}>Datum narození:</td>
                    <td style={{ padding: '4px 8px' }}>{format(new Date(contract.client.date_of_birth), "d. M. yyyy")}</td>
                  </tr>
                )}
                {contract.client?.address && (
                  <tr>
                    <td style={{ padding: '4px 8px', color: '#666' }}>Adresa:</td>
                    <td style={{ padding: '4px 8px' }}>{contract.client.address}</td>
                  </tr>
                )}
                {contract.client?.email && (
                  <tr>
                    <td style={{ padding: '4px 8px', color: '#666' }}>Email:</td>
                    <td style={{ padding: '4px 8px' }}>{contract.client.email}</td>
                  </tr>
                )}
                {contract.client?.phone && (
                  <tr>
                    <td style={{ padding: '4px 8px', color: '#666' }}>Telefon:</td>
                    <td style={{ padding: '4px 8px' }}>{contract.client.phone}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Předmět smlouvy */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#0066cc', textTransform: 'uppercase' }}>Předmět smlouvy - Zájezd</h2>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ padding: '4px 8px', width: '30%', color: '#666' }}>Destinace:</td>
                  <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>
                    {contract.deal?.destination?.name}{contract.deal?.destination?.country?.name ? `, ${contract.deal.destination.country.name}` : ''}
                  </td>
                </tr>
                {contract.deal?.start_date && contract.deal?.end_date && (
                  <tr>
                    <td style={{ padding: '4px 8px', color: '#666' }}>Termín:</td>
                    <td style={{ padding: '4px 8px' }}>
                      {format(new Date(contract.deal.start_date), "d. M. yyyy")} – {format(new Date(contract.deal.end_date), "d. M. yyyy")}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '4px 8px', color: '#666' }}>Celková cena:</td>
                  <td style={{ padding: '4px 8px', fontWeight: 'bold', fontSize: '14px' }}>{formatPrice(contract.deal?.total_price)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Cestující */}
          {contract.deal?.travelers && contract.deal.travelers.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#0066cc', textTransform: 'uppercase' }}>Cestující</h2>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Jméno</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Datum narození</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Číslo pasu</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.deal.travelers.map((traveler: any, idx: number) => (
                    <tr key={idx}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>
                        {traveler.client?.title ? `${traveler.client.title} ` : ''}{traveler.client?.first_name} {traveler.client?.last_name}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>
                        {traveler.client?.date_of_birth ? format(new Date(traveler.client.date_of_birth), "d. M. yyyy") : '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>
                        {traveler.client?.passport_number || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Služby */}
          {contract.deal?.services && contract.deal.services.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#0066cc', textTransform: 'uppercase' }}>Poskytnuté služby</h2>
              <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Služba</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid #ddd' }}>Termín</th>
                    <th style={{ padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid #ddd' }}>Osoby</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', borderBottom: '1px solid #ddd' }}>Cena</th>
                  </tr>
                </thead>
                <tbody>
                  {contract.deal.services
                    .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                    .map((service: any) => (
                    <tr key={service.id}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee' }}>
                        {service.service_name}
                        {service.description && <span style={{ display: 'block', fontSize: '10px', color: '#888' }}>{service.description}</span>}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', whiteSpace: 'nowrap' }}>
                        {service.start_date ? format(new Date(service.start_date), "d.M.") : ''}{service.end_date ? ` – ${format(new Date(service.end_date), "d.M.")}` : ''}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', textAlign: 'center' }}>
                        {service.person_count || '-'}
                      </td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid #eee', textAlign: 'right', fontWeight: 'bold' }}>
                        {formatPrice(service.price)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: '#f5f5f5' }}>
                    <td colSpan={3} style={{ padding: '8px', fontWeight: 'bold', textAlign: 'right' }}>Celkem:</td>
                    <td style={{ padding: '8px', fontWeight: 'bold', textAlign: 'right', fontSize: '14px' }}>{formatPrice(contract.deal?.total_price)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Právní podmínky */}
          <div style={{ marginBottom: '20px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#0066cc', textTransform: 'uppercase' }}>Právní podmínky</h2>
            <div style={{ fontSize: '10px', color: '#444', lineHeight: '1.6' }}>
              <p>Tato smlouva je uzavřena podle §2521 a násl. zákona č. 89/2012 Sb., občanský zákoník, v účinném znění.</p>
              <p style={{ fontWeight: 'bold', marginTop: '8px' }}>Storno podmínky (§2531-2533 OZ)</p>
              <p>Zákazník může od smlouvy odstoupit kdykoliv před zahájením zájezdu za storno poplatek dle sazebníku, bez storno poplatku při podstatné změně podmínek zájezdu nebo při zrušení zájezdu cestovní kanceláří.</p>
              <p style={{ fontWeight: 'bold', marginTop: '8px' }}>Pojištění (§2534 OZ)</p>
              <p>Cestovní kancelář je pojištěna pro případ úpadku v souladu se zákonem.</p>
              <p style={{ fontWeight: 'bold', marginTop: '8px' }}>Reklamace (§2536 OZ)</p>
              <p>Zákazník má právo reklamovat vady plnění. Reklamaci je nutné uplatnit bez zbytečného odkladu.</p>
            </div>
          </div>

          {/* Podpisy */}
          <div style={{ marginTop: '40px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <div style={{ width: '45%', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '8px', marginTop: '60px' }}>
                <p style={{ fontWeight: 'bold' }}>{(contract as any).agency_name || 'Cestovní kancelář'}</p>
                <p style={{ color: '#666', fontSize: '10px' }}>(podpis a razítko)</p>
              </div>
            </div>
            <div style={{ width: '45%', textAlign: 'center' }}>
              <div style={{ borderTop: '1px solid #000', paddingTop: '8px', marginTop: '60px' }}>
                <p style={{ fontWeight: 'bold' }}>{contract.client?.first_name} {contract.client?.last_name}</p>
                <p style={{ color: '#666', fontSize: '10px' }}>(podpis zákazníka)</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <EditContractDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        contract={{
          id: contract.id,
          contract_number: contract.contract_number,
          status: contract.status,
          contract_date: contract.contract_date,
          total_price: contract.total_price,
          deposit_amount: contract.deposit_amount,
          terms: contract.terms,
        }}
        onUpdate={refetch}
      />
    </div>
  );
};

export default ContractDetail;
