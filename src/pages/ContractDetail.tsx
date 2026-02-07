import { useState, useRef, useMemo } from "react";
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
import { ContractPdfTemplate } from "@/components/ContractPdfTemplate";
import { formatPrice } from "@/lib/utils";
import html2pdf from "html2pdf.js";
import { toast } from "sonner";

const CIRCLED_NUMBERS = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];

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
          payments:contract_payments(*),
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

  // Fetch service-traveler assignments
  const { data: serviceAssignments = [] } = useQuery({
    queryKey: ["contract_service_assignments", id],
    queryFn: async () => {
      // @ts-ignore
      const { data, error } = await (supabase as any)
        .from("contract_service_travelers")
        .select("service_type, service_name, client_id")
        .eq("contract_id", id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!id && !!contract,
  });

  // Sort travelers: main client first, then build index map
  const sortedTravelers = useMemo(() => {
    if (!contract?.deal?.travelers) return [];
    return [...contract.deal.travelers].sort((a: any, b: any) => {
      const aIsMain = a.client?.id === contract.client_id;
      const bIsMain = b.client?.id === contract.client_id;
      if (aIsMain && !bIsMain) return -1;
      if (!aIsMain && bIsMain) return 1;
      return 0;
    });
  }, [contract]);

  // Map client_id → circled number
  const travelerNumberMap = useMemo(() => {
    const map: Record<string, string> = {};
    sortedTravelers.forEach((t: any, idx: number) => {
      if (t.client?.id) {
        map[t.client.id] = CIRCLED_NUMBERS[idx] || `(${idx + 1})`;
      }
    });
    return map;
  }, [sortedTravelers]);

  // Get circled numbers for a service
  const getServiceTravelerNumbers = (serviceType: string, serviceName: string) => {
    const assigned = serviceAssignments.filter(
      (a: any) => a.service_type === serviceType && a.service_name === serviceName
    );
    if (assigned.length === 0) return null;
    // If all travelers assigned, no need to show
    if (assigned.length === sortedTravelers.length) return null;
    return assigned
      .map((a: any) => travelerNumberMap[a.client_id])
      .filter(Boolean)
      .join(' ');
  };

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
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'], avoid: ['[data-pdf-section]'] }
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

          {/* Dodavatel + Zákazník vedle sebe */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Dodavatel služeb */}
            <ContractAgencyInfo
              contractId={contract.id}
              agencyName={(contract as any).agency_name}
              agencyAddress={(contract as any).agency_address}
              agencyIco={(contract as any).agency_ico}
              agencyContact={(contract as any).agency_contact}
              agencyBankAccount={(contract as any).agency_bank_account}
              onUpdate={refetch}
            />

            {/* Zákazník */}
            <Card className="p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Zákazník</h2>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-foreground">
                    {contract.client?.first_name} {contract.client?.last_name}
                  </p>
                </div>
                {contract.client?.address && (
                  <div>
                    <p className="text-sm text-muted-foreground">Adresa</p>
                    <p className="text-foreground">{contract.client.address}</p>
                  </div>
                )}
                {contract.client?.date_of_birth && (
                  <div>
                    <p className="text-sm text-muted-foreground">Datum narození</p>
                    <p className="text-foreground">
                      {format(new Date(contract.client.date_of_birth), "d. MMMM yyyy", { locale: cs })}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Kontakt</p>
                  <p className="text-foreground">
                    {[contract.client?.email, contract.client?.phone].filter(Boolean).join(", ") || '-'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Cestující */}
          {sortedTravelers.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Cestující</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center py-2 text-muted-foreground font-medium w-10">#</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Jméno</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Datum narození</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Číslo pasu</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTravelers.map((t: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 text-center text-lg font-semibold text-primary">
                          {CIRCLED_NUMBERS[idx] || `(${idx + 1})`}
                        </td>
                        <td className="py-2 font-medium text-foreground">
                          {t.client?.title ? `${t.client.title} ` : ''}{t.client?.first_name} {t.client?.last_name}
                        </td>
                        <td className="py-2 text-foreground">
                          {t.client?.date_of_birth ? format(new Date(t.client.date_of_birth), "d. M. yyyy") : '-'}
                        </td>
                        <td className="py-2 text-foreground">{t.client?.passport_number || '-'}</td>
                        <td className="py-2 text-foreground">{t.client?.email || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Služby */}
          {contract.deal?.services?.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-xl md:text-2xl font-bold text-foreground mb-4">Služby</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-muted-foreground font-medium">Služba</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Termín</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">Osoby</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">Cestující</th>
                      <th className="text-right py-2 text-muted-foreground font-medium">Cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.deal.services
                      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                      .map((service: any) => {
                        const travelerNums = getServiceTravelerNumbers(service.service_type, service.service_name);
                        return (
                          <tr key={service.id} className="border-b last:border-0">
                            <td className="py-2 text-foreground">
                              <span className="font-medium">{service.service_name}</span>
                              {service.description && (
                                <span className="block text-xs text-muted-foreground">{service.description}</span>
                              )}
                            </td>
                            <td className="py-2 text-foreground whitespace-nowrap">
                              {service.start_date ? format(new Date(service.start_date), "d.M.") : ''}
                              {service.end_date ? ` – ${format(new Date(service.end_date), "d.M.")}` : ''}
                            </td>
                            <td className="py-2 text-center text-foreground">{service.person_count || '-'}</td>
                            <td className="py-2 text-center text-foreground text-base">
                              {travelerNums || <span className="text-xs text-muted-foreground">všichni</span>}
                            </td>
                            <td className="py-2 text-right font-medium text-foreground">
                              {formatPrice((service.price || 0) * (service.person_count || 1))}
                            </td>
                          </tr>
                        );
                      })}
                    <tr className="bg-muted/50">
                      <td colSpan={4} className="py-2 text-right font-bold text-foreground">Celkem:</td>
                      <td className="py-2 text-right font-bold text-foreground">{formatPrice(contract.deal?.total_price)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Platební kalendář */}
          <ContractPaymentSchedule 
            contractId={contract.id} 
            totalPrice={contract.deal?.total_price}
            departureDate={contract.deal?.start_date}
            contractNumber={contract.contract_number}
            bankAccount={(contract as any).agency_bank_account}
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
        <ContractPdfTemplate ref={pdfContentRef} contract={contract} serviceAssignments={serviceAssignments} />
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
