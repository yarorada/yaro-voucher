import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { removeDiacritics } from "@/lib/utils";
import * as React from "react";

interface ParsedClient {
  title?: string;
  first_name: string;
  last_name: string;
  email?: string;
  date_of_birth?: string;
  passport_number?: string;
  passport_expiry?: string;
  id_card_number?: string;
  id_card_expiry?: string;
}

interface ClientMatch {
  parsed: ParsedClient;
  existingClient: { id: string; first_name: string; last_name: string } | null;
  selected: boolean;
}

interface DealBulkTravelerImportProps {
  dealId: string;
  existingTravelerIds: string[];
  onComplete: () => void;
  trigger?: React.ReactNode;
}

export const DealBulkTravelerImport = ({
  dealId,
  existingTravelerIds,
  onComplete,
  trigger,
}: DealBulkTravelerImportProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [matches, setMatches] = useState<ClientMatch[]>([]);
  const [step, setStep] = useState<"input" | "preview">("input");

  const handleParse = async () => {
    if (!text.trim()) return;
    setParsing(true);

    try {
      const { data, error } = await supabase.functions.invoke("parse-bulk-client-data", {
        body: { text },
      });

      if (error) throw error;
      if (!data?.success || !data.clients?.length) {
        toast({
          title: "Nenalezeni žádní cestující",
          description: "Zkuste zadat text v jiném formátu",
          variant: "destructive",
        });
        setParsing(false);
        return;
      }

      // Fetch all existing clients for duplicate checking
      const { data: allClients } = await supabase
        .from("clients")
        .select("id, first_name, last_name, date_of_birth, passport_number, id_card_number");

      const clientMatches: ClientMatch[] = data.clients.map((parsed: ParsedClient) => {
        let existing: { id: string; first_name: string; last_name: string } | null = null;

        if (allClients) {
          // Check by passport number
          if (parsed.passport_number) {
            const match = allClients.find((c: any) => c.passport_number === parsed.passport_number);
            if (match) existing = match;
          }
          // Check by ID card
          if (!existing && parsed.id_card_number) {
            const match = allClients.find((c: any) => c.id_card_number === parsed.id_card_number);
            if (match) existing = match;
          }
          // Check by name + date of birth
          if (!existing && parsed.first_name && parsed.last_name) {
            const normFirst = removeDiacritics(parsed.first_name.trim().toLowerCase());
            const normLast = removeDiacritics(parsed.last_name.trim().toLowerCase());
            const match = allClients.find((c: any) => {
              const nameMatch =
                removeDiacritics(c.first_name.toLowerCase()) === normFirst &&
                removeDiacritics(c.last_name.toLowerCase()) === normLast;
              if (nameMatch && parsed.date_of_birth && c.date_of_birth) {
                return c.date_of_birth === parsed.date_of_birth;
              }
              return nameMatch;
            });
            if (match) existing = match;
          }
        }

        return { parsed, existingClient: existing, selected: true };
      });

      setMatches(clientMatches);
      setStep("preview");
    } catch (err) {
      console.error("Error parsing travelers:", err);
      toast({
        title: "Chyba",
        description: "Nepodařilo se zpracovat text",
        variant: "destructive",
      });
    } finally {
      setParsing(false);
    }
  };

  const handleSave = async () => {
    const selected = matches.filter((m) => m.selected);
    if (!selected.length) return;
    setSaving(true);

    try {
      let addedCount = 0;
      let updatedCount = 0;
      let newCount = 0;

      for (const match of selected) {
        let clientId: string;

        if (match.existingClient) {
          clientId = match.existingClient.id;
          // Update existing client with any new data
          const updateData: any = {};
          if (match.parsed.passport_number) updateData.passport_number = match.parsed.passport_number;
          if (match.parsed.passport_expiry) updateData.passport_expiry = match.parsed.passport_expiry;
          if (match.parsed.id_card_number) updateData.id_card_number = match.parsed.id_card_number;
          if (match.parsed.id_card_expiry) updateData.id_card_expiry = match.parsed.id_card_expiry;
          if (match.parsed.date_of_birth) updateData.date_of_birth = match.parsed.date_of_birth;
          if (match.parsed.email) updateData.email = match.parsed.email;
          if (match.parsed.title) updateData.title = match.parsed.title;

          if (Object.keys(updateData).length > 0) {
            await supabase.from("clients").update(updateData).eq("id", clientId);
            updatedCount++;
          }
        } else {
          // Create new client
          const clientRecord: any = {
            first_name: match.parsed.first_name,
            last_name: match.parsed.last_name,
          };
          if (match.parsed.title) clientRecord.title = match.parsed.title;
          if (match.parsed.email) clientRecord.email = match.parsed.email;
          if (match.parsed.date_of_birth) clientRecord.date_of_birth = match.parsed.date_of_birth;
          if (match.parsed.passport_number) clientRecord.passport_number = match.parsed.passport_number;
          if (match.parsed.passport_expiry) clientRecord.passport_expiry = match.parsed.passport_expiry;
          if (match.parsed.id_card_number) clientRecord.id_card_number = match.parsed.id_card_number;
          if (match.parsed.id_card_expiry) clientRecord.id_card_expiry = match.parsed.id_card_expiry;

          const { data: newClient, error } = await supabase
            .from("clients")
            .insert(clientRecord)
            .select("id")
            .single();

          if (error) throw error;
          clientId = newClient.id;
          newCount++;
        }

        // Add to deal_travelers if not already there
        if (!existingTravelerIds.includes(clientId)) {
          const { error } = await supabase.from("deal_travelers").insert({
            deal_id: dealId,
            client_id: clientId,
            is_lead_traveler: false,
          });
          if (error && !error.message.includes("duplicate")) throw error;
          addedCount++;
        }
      }

      const parts = [];
      if (newCount) parts.push(`${newCount} nových klientů vytvořeno`);
      if (updatedCount) parts.push(`${updatedCount} klientů aktualizováno`);
      if (addedCount) parts.push(`${addedCount} cestujících přidáno`);

      toast({
        title: "Import dokončen",
        description: parts.join(", ") || "Žádné změny",
      });

      setOpen(false);
      setStep("input");
      setText("");
      setMatches([]);
      onComplete();
    } catch (err) {
      console.error("Error saving travelers:", err);
      toast({
        title: "Chyba",
        description: "Nepodařilo se uložit cestující",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const toggleSelection = (index: number) => {
    setMatches((prev) =>
      prev.map((m, i) => (i === index ? { ...m, selected: !m.selected } : m))
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setStep("input");
          setMatches([]);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" variant="outline">
            <FileText className="h-4 w-4 mr-1" />
            <span className="hidden sm:inline">AI Import</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="bg-background max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI Import cestujících</DialogTitle>
          <DialogDescription>
            Vložte text s údaji cestujících. AI automaticky extrahuje jména, data narození, doklady a porovná s databází.
          </DialogDescription>
        </DialogHeader>

        {step === "input" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Text s údaji cestujících</Label>
              <Textarea
                placeholder={"Jan Novák, nar. 15.3.1985, pas č. 123456789\nJana Nováková, nar. 20.7.1990, OP 987654321"}
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Zrušit
              </Button>
              <Button onClick={handleParse} disabled={parsing || !text.trim()}>
                {parsing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Zpracovávám...
                  </>
                ) : (
                  "Zpracovat"
                )}
              </Button>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Jméno</TableHead>
                  <TableHead>Datum narození</TableHead>
                  <TableHead>Doklady</TableHead>
                  <TableHead>Stav</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((match, idx) => {
                  const alreadyInDeal =
                    match.existingClient &&
                    existingTravelerIds.includes(match.existingClient.id);
                  return (
                    <TableRow
                      key={idx}
                      className={!match.selected ? "opacity-50" : ""}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={match.selected && !alreadyInDeal}
                          disabled={!!alreadyInDeal}
                          onChange={() => toggleSelection(idx)}
                          className="rounded"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-sm">
                        {match.parsed.title && (
                          <span className="text-muted-foreground mr-1">{match.parsed.title}</span>
                        )}
                        {match.parsed.first_name} {match.parsed.last_name}
                      </TableCell>
                      <TableCell className="text-sm">
                        {match.parsed.date_of_birth || "-"}
                      </TableCell>
                      <TableCell className="text-xs space-y-0.5">
                        {match.parsed.passport_number && (
                          <div>Pas: {match.parsed.passport_number}</div>
                        )}
                        {match.parsed.id_card_number && (
                          <div>OP: {match.parsed.id_card_number}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {alreadyInDeal ? (
                          <Badge variant="secondary" className="text-xs">
                            Již přidán
                          </Badge>
                        ) : match.existingClient ? (
                          <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Existuje
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-green-500 text-green-600">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Nový
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={() => setStep("input")}>
                ← Zpět
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Zrušit
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={saving || !matches.some((m) => m.selected && !(m.existingClient && existingTravelerIds.includes(m.existingClient.id)))}
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Ukládám...
                    </>
                  ) : (
                    `Importovat (${matches.filter((m) => m.selected && !(m.existingClient && existingTravelerIds.includes(m.existingClient.id))).length})`
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
