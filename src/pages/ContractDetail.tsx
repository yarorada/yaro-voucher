import { useState, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Send, FileSignature, Pencil, Loader2, Copy, ExternalLink, CheckCircle2, ChevronDown } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { ContractAgencyInfo } from "@/components/ContractAgencyInfo";
import { ContractPaymentSchedule } from "@/components/ContractPaymentSchedule";
import { CreateVoucherFromContract } from "@/components/CreateVoucherFromContract";
import { SendContractEmail } from "@/components/SendContractEmail";
import { EditContractDialog } from "@/components/EditContractDialog";
import { ContractPdfTemplate } from "@/components/ContractPdfTemplate";
import { ContractTeeTimesEditor } from "@/components/ContractTeeTimesEditor";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { formatPrice, parseDateSafe } from "@/lib/utils";
import { getServiceTotal } from "@/lib/servicePrice";
import html2pdf from "html2pdf.js";
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

  // Sort travelers: main client first
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


  const statusOptions: { value: string; variant: "default" | "secondary" | "destructive" | "outline"; label: string }[] = [
    { value: "draft", variant: "secondary", label: "Koncept" },
    { value: "sent", variant: "default", label: "Odesláno" },
    { value: "signed", variant: "outline", label: "Podepsáno" },
    { value: "cancelled", variant: "destructive", label: "Zrušeno" },
  ];

  const getStatusBadge = (status: string, interactive = false) => {
    const config = statusOptions.find((s) => s.value === status) || statusOptions[0];
    const badge = <Badge variant={config.variant} className={interactive ? "cursor-pointer" : ""}>{config.label}{interactive && <ChevronDown className="h-3 w-3 ml-1" />}</Badge>;
    if (!interactive) return badge;
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{badge}</DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {statusOptions.map((opt) => (
            <DropdownMenuItem
              key={opt.value}
              onClick={() => handleStatusChange(opt.value)}
              className={opt.value === status ? "font-bold" : ""}
            >
              <Badge variant={opt.variant} className="mr-2">{opt.label}</Badge>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const handleStatusChange = async (newStatus: string) => {
    const { error } = await supabase
      .from("travel_contracts")
      .update({ status: newStatus } as any)
      .eq("id", id);
    if (error) {
      toast.error("Nepodařilo se změnit status");
    } else {
      toast.success(`Status změněn na "${statusOptions.find(s => s.value === newStatus)?.label}"`);
      refetch();
    }
  };

  const handleDownloadPdf = async () => {
    const element = pdfContentRef.current;
    if (!element) return;

    setIsGeneratingPdf(true);
    try {
      // Wait for QR codes to be ready (up to 5 seconds)
      await new Promise<void>((resolve) => {
        const check = () => {
          if (element?.getAttribute('data-qr-ready') === 'true') {
            resolve();
          } else {
            setTimeout(check, 200);
          }
        };
        setTimeout(resolve, 5000);
        check();
      });

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

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    contract ? (
      <>
        <CreateVoucherFromContract 
          contractId={contract.id} 
          contractStatus={contract.status} 
        />
        <SendContractEmail
          contract={contract}
          pdfContentRef={pdfContentRef}
          onSent={refetch}
        />
        <Button variant="outline" size="sm" className={toolbarButtonClass} onClick={() => {
            const signToken = (contract as any).sign_token;
            if (signToken) {
              const url = `${window.location.origin}/sign-contract?token=${signToken}`;
              navigator.clipboard.writeText(url);
              toast.success("Odkaz pro podpis zkopírován");
            } else {
              toast.error("Smlouva nemá podpisový token");
            }
          }}>
          {contract.status === 'signed' ? (
            <><CheckCircle2 className="h-4 w-4 mr-1 text-primary" /><span className="hidden sm:inline">Podepsáno</span></>
          ) : (
            <><Copy className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Odkaz pro podpis</span></>
          )}
        </Button>
        {contract.status === 'signed' && (contract as any).signature_url && (
          <Button variant="ghost" size="sm" className={toolbarButtonClass} asChild>
            <a href={(contract as any).signature_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" /> Podpis
            </a>
          </Button>
        )}
        <Button size="sm" className={toolbarButtonClass} onClick={handleDownloadPdf} disabled={isGeneratingPdf}>
          {isGeneratingPdf ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
          <span className="hidden sm:inline">{isGeneratingPdf ? 'Generuji...' : 'PDF'}</span>
          <span className="sm:hidden">PDF</span>
        </Button>
      </>
    ) : null,
    [contract, isGeneratingPdf, editDialogOpen]
  );

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
          <h2 className="text-heading-2 text-foreground mb-2">Chyba při načítání smlouvy</h2>
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
          <h2 className="text-heading-2 text-foreground mb-2">Smlouva nenalezena</h2>
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
            <h1 className="text-heading-1 text-foreground">{contract.contract_number}</h1>
            {getStatusBadge(contract.status, true)}
          </div>
          <p className="text-muted-foreground">
            Obchodní případ: {contract.deal?.name || contract.deal?.destination?.name || contract.deal?.deal_number}
          </p>
        </div>



        <div className="grid gap-6">
          {/* Základní informace */}
          <Card className="p-4 md:p-6">
            <h2 className="text-heading-2 text-foreground mb-4">Základní informace</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Číslo smlouvy</p>
                <p className="font-medium text-foreground">{contract.contract_number}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status</p>
                {getStatusBadge(contract.status, true)}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Termín zájezdu</p>
                <p className="font-medium text-foreground">
                  {contract.deal?.start_date && contract.deal?.end_date
                    ? `${(() => { const d = parseDateSafe(contract.deal.start_date); return d ? format(d, "d. M. yyyy") : ''; })()} – ${(() => { const d = parseDateSafe(contract.deal.end_date); return d ? format(d, "d. M. yyyy") : ''; })()}`
                    : contract.deal?.start_date
                      ? (() => { const d = parseDateSafe(contract.deal.start_date); return d ? format(d, "d. M. yyyy") : '-'; })()
                      : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Destinace</p>
                <p className="font-medium text-foreground">
                  {contract.deal?.destination?.name
                    ? `${contract.deal.destination.name}${contract.deal.destination.country?.name ? `, ${contract.deal.destination.country.name}` : ''}`
                    : '-'}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Hotel</p>
                <p className="font-medium text-foreground">
                  {(() => {
                    const hotelService = contract.deal?.services?.find((s: any) => s.service_type === 'hotel');
                    return hotelService ? hotelService.service_name : '-';
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Doprava</p>
                <p className="font-medium text-foreground">
                  {(() => {
                    const hasFlights = contract.deal?.services?.some((s: any) => s.service_type === 'flight');
                    const hasTransfer = contract.deal?.services?.some((s: any) => s.service_type === 'transfer');
                    if (hasFlights && hasTransfer) return 'Letecky + transfer';
                    if (hasFlights) return 'Letecky';
                    if (hasTransfer) return 'Transfer';
                    return 'Vlastní';
                  })()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Vytvořeno</p>
                <p className="font-medium text-foreground">
                  {(() => { const d = parseDateSafe(contract.created_at); return d ? format(d, "d. MMMM yyyy", { locale: cs }) : contract.created_at; })()}
                </p>
              </div>
              {contract.signed_at && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Podepsáno</p>
                  <p className="font-medium text-foreground">
                    {(() => { const d = parseDateSafe(contract.signed_at); return d ? format(d, "d. MMMM yyyy HH:mm", { locale: cs }) : contract.signed_at; })()}
                  </p>
                  {(contract as any).signed_ip && (
                    <p className="text-xs text-muted-foreground">IP: {(contract as any).signed_ip}</p>
                  )}
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
              <h2 className="text-heading-2 text-foreground mb-4">Zákazník</h2>
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
                      {(() => { const d = parseDateSafe(contract.client.date_of_birth); return d ? format(d, "d. MMMM yyyy", { locale: cs }) : '-'; })()}
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
              <h2 className="text-heading-2 text-foreground mb-4">Cestující</h2>
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
                        <td className="py-2 text-center font-medium text-foreground">
                          {idx + 1}
                        </td>
                        <td className="py-2 font-medium text-foreground">
                          {t.client?.title ? `${t.client.title} ` : ''}{t.client?.first_name} {t.client?.last_name}
                        </td>
                        <td className="py-2 text-foreground">
                          {t.client?.date_of_birth ? (() => { const d = parseDateSafe(t.client.date_of_birth); return d ? format(d, "d. M. yyyy") : '-'; })() : '-'}
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
              <h2 className="text-heading-2 text-foreground mb-4">Služby</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-muted-foreground font-medium">Služba</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Termín</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">Osoby</th>
                      
                      <th className="text-right py-2 text-muted-foreground font-medium">Cena</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contract.deal.services
                      .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
                      .map((service: any) => (
                          <tr key={service.id} className="border-b last:border-0">
                            <td className="py-2 text-foreground">
                              <span className="font-medium">{service.service_name}</span>
                              {service.description && (
                                <span className="block text-xs text-muted-foreground">{service.description}</span>
                              )}
                            </td>
                            <td className="py-2 text-foreground whitespace-nowrap">
                              {service.start_date ? (() => { const d = parseDateSafe(service.start_date); return d ? format(d, "d.M.") : ''; })() : ''}
                              {service.end_date ? ` – ${(() => { const d = parseDateSafe(service.end_date); return d ? format(d, "d.M.") : ''; })()}` : ''}
                            </td>
                            <td className="py-2 text-center text-foreground">{service.person_count || '-'}</td>
                            <td className="py-2 text-right font-medium text-foreground">
                              {formatPrice(getServiceTotal(service), true, contract.deal?.currency || (contract as any).currency || "CZK")}
                            </td>
                          </tr>
                        ))}
                    <tr className="bg-muted/50">
                      <td colSpan={3} className="py-2 text-right font-bold text-foreground">Celkem:</td>
                      <td className="py-2 text-right font-bold text-foreground">{formatPrice(contract.deal?.total_price, true, contract.deal?.currency || (contract as any).currency || "CZK")}</td>
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
            currency={contract.deal?.currency || (contract as any).currency || "CZK"}
          />


          {/* Ostatní informace a požadavky - tee times */}
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-heading-2 text-foreground">Ostatní informace a požadavky</h2>
              <ContractTeeTimesEditor
                contractId={contract.id}
                teeTimes={(contract as any).tee_times || []}
                onUpdate={refetch}
              />
            </div>
            {(contract as any).tee_times?.length > 0 ? (
              <>
                <h3 className="text-title text-foreground mb-2">Startovací časy (Tee Times)</h3>
                <div className="space-y-1">
                  {(contract as any).tee_times.map((tt: any, idx: number) => {
                    const dateStr = tt.date ? (() => { const d = parseDateSafe(tt.date); return d ? format(d, "dd.MM.yy") : tt.date; })() : '-';
                    return (
                      <p key={idx} className="text-sm text-foreground">
                        {dateStr} – {tt.club} – {tt.time || '-'}
                      </p>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Žádné startovací časy</p>
            )}
          </Card>

          {/* Právní podmínky */}
          <Card className="p-4 md:p-6">
            <h2 className="text-heading-2 text-foreground mb-4">Právní podmínky</h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground">
                Tato smlouva je uzavřena podle §2521 a násl. zákona č. 89/2012 Sb., občanský zákoník, v účinném znění.
              </p>
              <h3 className="text-title text-foreground mt-4 mb-2">Storno podmínky (§2531-2533 OZ)</h3>
              <p className="text-muted-foreground mb-2">Zákazník může od smlouvy odstoupit:</p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-1">
                <li>Kdykoliv před zahájením zájezdu za storno poplatek dle sazebníku</li>
                <li>Bez storno poplatku při podstatné změně podmínek zájezdu</li>
                <li>Bez storno poplatku při zrušení zájezdu cestovní kanceláří</li>
              </ul>
              <h3 className="text-title text-foreground mt-4 mb-2">Pojištění (§2534 OZ)</h3>
              <p className="text-muted-foreground">
                Cestovní kancelář je pojištěna pro případ úpadku v souladu se zákonem.
              </p>
              <h3 className="text-title text-foreground mt-4 mb-2">Reklamace (§2536 OZ)</h3>
              <p className="text-muted-foreground">
                Zákazník má právo reklamovat vady plnění. Reklamaci je nutné uplatnit bez zbytečného odkladu.
              </p>
            </div>
          </Card>
        </div>
      </div>

      {/* Hidden PDF content */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <ContractPdfTemplate ref={pdfContentRef} contract={contract} />
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
