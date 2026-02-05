import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Download, Send, FileSignature, Pencil } from "lucide-react";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { ContractAgencyInfo } from "@/components/ContractAgencyInfo";
import { ContractPaymentSchedule } from "@/components/ContractPaymentSchedule";
import { ContractServiceAssignment } from "@/components/ContractServiceAssignment";
import { CreateVoucherFromContract } from "@/components/CreateVoucherFromContract";
import { EditContractDialog } from "@/components/EditContractDialog";
import { formatPrice } from "@/lib/utils";

const ContractDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [editDialogOpen, setEditDialogOpen] = useState(false);

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
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-4xl font-bold text-foreground">{contract.contract_number}</h1>
            {getStatusBadge(contract.status)}
          </div>
          <p className="text-muted-foreground">
            Obchodní případ: {contract.deal?.name || contract.deal?.destination?.name || contract.deal?.deal_number}
          </p>
        </div>
        <div className="flex gap-2 mb-8">
          <Button variant="outline" onClick={() => setEditDialogOpen(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Upravit
          </Button>
          <CreateVoucherFromContract 
            contractId={contract.id} 
            contractStatus={contract.status} 
          />
          <Button variant="outline">
            <Send className="h-4 w-4 mr-2" />
            Odeslat
          </Button>
          <Button variant="outline">
            <FileSignature className="h-4 w-4 mr-2" />
            Podepsat
          </Button>
          <Button>
            <Download className="h-4 w-4 mr-2" />
            Stáhnout PDF
          </Button>
        </div>

        <div className="grid gap-6">
          {/* Základní informace */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Základní informace</h2>
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
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Zákazník</h2>
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
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Předmět smlouvy - Zájezd</h2>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
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
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Cestující</h2>
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
            <Card className="p-6">
              <h2 className="text-2xl font-bold text-foreground mb-4">Poskytnuté služby</h2>
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
          <Card className="p-6">
            <h2 className="text-2xl font-bold text-foreground mb-4">Právní podmínky</h2>
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
