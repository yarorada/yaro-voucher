import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, Merge, X, Loader2, CheckCircle2 } from "lucide-react";
import { removeDiacritics, capitalizeWords } from "@/lib/utils";
import { format } from "date-fns";
import { cs } from "date-fns/locale";

interface Client {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  email: string | null;
  phone: string | null;
  passport_number: string | null;
  id_card_number: string | null;
}

interface DuplicateGroup {
  key: string;
  clients: Client[];
}

interface DuplicateClientCheckerProps {
  onComplete: () => void;
}

export function DuplicateClientChecker({ onComplete }: DuplicateClientCheckerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [processing, setProcessing] = useState(false);

  const checkForDuplicates = async () => {
    setLoading(true);
    try {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name, date_of_birth, email, phone, passport_number, id_card_number")
        .order("last_name", { ascending: true });

      if (error) throw error;

      // Group by normalized name (ignoring diacritics)
      const groups = new Map<string, Client[]>();
      
      for (const client of clients as Client[]) {
        const normalizedName = `${removeDiacritics(client.first_name.toLowerCase().trim())}|${removeDiacritics(client.last_name.toLowerCase().trim())}`;
        
        if (!groups.has(normalizedName)) {
          groups.set(normalizedName, []);
        }
        groups.get(normalizedName)!.push(client);
      }

      // Filter only groups with duplicates (2+ clients with same normalized name)
      const duplicates: DuplicateGroup[] = [];
      for (const [key, clientList] of groups) {
        if (clientList.length > 1) {
          duplicates.push({ key, clients: clientList });
        }
      }

      if (duplicates.length === 0) {
        toast.success("Žádné duplicity nebyly nalezeny");
        setIsOpen(false);
      } else {
        setDuplicateGroups(duplicates);
        setCurrentGroupIndex(0);
        setIsOpen(true);
      }
    } catch (error) {
      console.error("Error checking duplicates:", error);
      toast.error("Chyba při kontrole duplicit");
    } finally {
      setLoading(false);
    }
  };

  const handleMerge = async (primaryId: string, duplicateIds: string[]) => {
    setProcessing(true);
    try {
      // Get full data of primary client
      const { data: primaryClient } = await supabase
        .from("clients")
        .select("*")
        .eq("id", primaryId)
        .single();

      // Get full data of duplicates
      const { data: duplicateClients } = await supabase
        .from("clients")
        .select("*")
        .in("id", duplicateIds);

      if (!primaryClient || !duplicateClients) throw new Error("Nepodařilo se načíst klienty");

      // Merge data - fill in missing fields from duplicates
      const mergedData: Record<string, any> = {};
      const fields = ["email", "phone", "address", "notes", "passport_number", "passport_expiry", 
                      "id_card_number", "id_card_expiry", "title", "company_name", "ico", "dic", "date_of_birth"];
      
      for (const field of fields) {
        if (!primaryClient[field]) {
          for (const dup of duplicateClients) {
            if (dup[field]) {
              mergedData[field] = dup[field];
              break;
            }
          }
        }
      }

      // Merge document_urls
      let documentUrls: any[] = Array.isArray(primaryClient.document_urls) ? [...primaryClient.document_urls] : [];
      for (const dup of duplicateClients) {
        if (dup.document_urls && Array.isArray(dup.document_urls)) {
          documentUrls = [...documentUrls, ...dup.document_urls];
        }
      }
      if (documentUrls.length > 0) {
        mergedData.document_urls = documentUrls;
      }

      // Merge notes
      const allNotes = [primaryClient.notes, ...duplicateClients.map(d => d.notes)].filter(Boolean);
      if (allNotes.length > 1) {
        mergedData.notes = allNotes.join("\n---\n");
      }

      // Update primary client
      if (Object.keys(mergedData).length > 0) {
        await supabase
          .from("clients")
          .update(mergedData)
          .eq("id", primaryId);
      }

      // Update all references to point to primary client
      for (const dupId of duplicateIds) {
        await supabase.from("voucher_travelers").update({ client_id: primaryId }).eq("client_id", dupId);
        await supabase.from("deal_travelers").update({ client_id: primaryId }).eq("client_id", dupId);
        await supabase.from("contract_service_travelers").update({ client_id: primaryId }).eq("client_id", dupId);
        await supabase.from("travel_contracts").update({ client_id: primaryId }).eq("client_id", dupId);
        await supabase.from("vouchers").update({ client_id: primaryId }).eq("client_id", dupId);
        
        // Delete duplicate
        await supabase.from("clients").delete().eq("id", dupId);
      }

      toast.success("Klienti byli sloučeni");
      moveToNextGroup();
    } catch (error) {
      console.error("Error merging clients:", error);
      toast.error("Chyba při slučování klientů");
    } finally {
      setProcessing(false);
    }
  };

  const handleKeepSeparate = () => {
    moveToNextGroup();
  };

  const moveToNextGroup = () => {
    if (currentGroupIndex < duplicateGroups.length - 1) {
      setCurrentGroupIndex(prev => prev + 1);
    } else {
      setIsOpen(false);
      setDuplicateGroups([]);
      setCurrentGroupIndex(0);
      onComplete();
      toast.success("Kontrola duplicit dokončena");
    }
  };

  const currentGroup = duplicateGroups[currentGroupIndex];

  const formatDOB = (dob: string | null) => {
    if (!dob) return "neuvedeno";
    try {
      return format(new Date(dob), "d. MMMM yyyy", { locale: cs });
    } catch {
      return dob;
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        className="w-full justify-start text-sm"
        onClick={checkForDuplicates}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Users className="h-4 w-4 mr-2" />
        )}
        Kontrola duplicit
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Možná duplicita klienta</DialogTitle>
            <DialogDescription>
              Nalezeno {duplicateGroups.length} skupin možných duplicit. 
              Zpracováváte {currentGroupIndex + 1}. z {duplicateGroups.length}.
            </DialogDescription>
          </DialogHeader>

          {currentGroup && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Následující klienti mají stejné jméno (bez ohledu na diakritiku). 
                Chcete je sloučit nebo ponechat jako samostatné?
              </p>

              <div className="grid gap-3">
                {currentGroup.clients.map((client, index) => (
                  <Card key={client.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-semibold text-lg">
                          {capitalizeWords(client.first_name)} {capitalizeWords(client.last_name)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          <span className="font-medium">Datum narození:</span>{" "}
                          {formatDOB(client.date_of_birth)}
                        </div>
                        {client.email && (
                          <div className="text-sm text-muted-foreground">
                            📧 {client.email}
                          </div>
                        )}
                        {client.passport_number && (
                          <div className="text-sm text-muted-foreground">
                            🛂 {client.passport_number}
                          </div>
                        )}
                        {client.id_card_number && (
                          <div className="text-sm text-muted-foreground">
                            🆔 {client.id_card_number}
                          </div>
                        )}
                      </div>
                      {index === 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                          Primární
                        </span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>

              <div className="bg-muted/50 p-3 rounded-lg text-sm">
                <p className="font-medium mb-1">Při sloučení:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1">
                  <li>První klient bude zachován jako primární</li>
                  <li>Data z ostatních budou doplněna (pokud chybí)</li>
                  <li>Všechny reference (vouchery, dealy, smlouvy) budou přesměrovány</li>
                  <li>Duplicitní záznamy budou smazány</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={handleKeepSeparate}
              disabled={processing}
            >
              <X className="h-4 w-4 mr-2" />
              Ponechat odděleně
            </Button>
            <Button
              onClick={() => {
                if (currentGroup) {
                  const [primary, ...duplicates] = currentGroup.clients;
                  handleMerge(primary.id, duplicates.map(d => d.id));
                }
              }}
              disabled={processing}
            >
              {processing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Merge className="h-4 w-4 mr-2" />
              )}
              Sloučit klienty
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
