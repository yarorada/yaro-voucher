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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowRight } from "lucide-react";
import { removeDiacritics } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";

// Czech diacritics correction map – maps "diacritics-free" name patterns to their correct forms
const FIRST_NAME_MAP: Record<string, string> = {
  "jan": "Jan", "jana": "Jana", "jiri": "Jiří", "jitka": "Jitka",
  "petr": "Petr", "petra": "Petra", "pavel": "Pavel", "pavla": "Pavla",
  "martin": "Martin", "martina": "Martina", "tomas": "Tomáš",
  "lukas": "Lukáš", "ondrej": "Ondřej",
  "vaclav": "Václav", "radek": "Radek", "renata": "Renata",
  "zuzana": "Zuzana", "katerina": "Kateřina",
  "lenka": "Lenka", "marketa": "Markéta",
  "miroslav": "Miroslav", "jaroslav": "Jaroslav", "frantisek": "František",
  "michal": "Michal", "michaela": "Michaela",
  "daniel": "Daniel", "daniela": "Daniela", "jakub": "Jakub", "adam": "Adam",
  "eva": "Eva", "marie": "Marie", "milan": "Milan",
  "romana": "Romana", "roman": "Roman", "stanislav": "Stanislav",
  "david": "David", "marek": "Marek", "radka": "Radka", "stepan": "Štěpán",
  "filip": "Filip", "simona": "Simona", "simon": "Šimon",
  "lucie": "Lucie", "lucia": "Lucia", "monika": "Monika",
  "tereza": "Tereza", "karolina": "Karolína",
  "alena": "Alena", "andrea": "Andrea", "anna": "Anna", "bozena": "Božena",
  "denisa": "Denisa", "dominika": "Dominika",
  "eliska": "Eliška", "ivana": "Ivana", "iva": "Iva",
  "jaroslava": "Jaroslava", "jarmila": "Jarmila",
  "libor": "Libor", "lubomir": "Lubomír",
  "vladimir": "Vladimír", "vera": "Věra",
  "zdenek": "Zdeněk", "zbynek": "Zbyněk",
};

const LAST_NAME_MAP: Record<string, string> = {
  "novak": "Novák", "svoboda": "Svoboda", "novotny": "Novotný",
  "dvorak": "Dvořák", "cerny": "Černý", "blaha": "Bláha",
  "prochazka": "Procházka", "krejci": "Krejčí", "kopecky": "Kopecký",
  "nemec": "Němec", "marek": "Marek", "horak": "Horák",
  "pospisil": "Pospíšil", "ruzicka": "Růžička", "fiala": "Fiala",
  "simek": "Šimek", "mares": "Mareš", "benes": "Beneš",
  "sedlacek": "Sedláček", "spacek": "Špaček",
  "vlcek": "Vlček", "kohout": "Kohout", "hajek": "Hájek",
  "kratochvil": "Kratochvíl", "michalek": "Michálek", "kolar": "Kolář",
  "pokorny": "Pokorný", "kalab": "Kaláb",
};

function suggestCorrectName(first: string, last: string): { first: string; last: string } | null {
  const normalizedFirst = removeDiacritics(first.trim().toLowerCase());
  const normalizedLast = removeDiacritics(last.trim().toLowerCase());

  const suggestedFirst = FIRST_NAME_MAP[normalizedFirst] ?? null;
  const suggestedLast = LAST_NAME_MAP[normalizedLast] ?? null;

  // Capitalize as fallback
  const capFirst = first.charAt(0).toUpperCase() + first.slice(1);
  const capLast = last.charAt(0).toUpperCase() + last.slice(1);

  const correctedFirst = suggestedFirst ?? capFirst;
  const correctedLast = suggestedLast ?? capLast;

  if (correctedFirst !== first || correctedLast !== last) {
    return { first: correctedFirst, last: correctedLast };
  }
  return null;
}

interface Change {
  id: string;
  oldFirst: string;
  oldLast: string;
  newFirst: string;
  newLast: string;
  selected: boolean;
}

interface DiacriticsCheckerProps {
  onComplete: () => void;
}

export function DiacriticsChecker({ onComplete }: DiacriticsCheckerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Change[]>([]);

  const findChanges = async () => {
    setLoading(true);
    try {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("id, first_name, last_name")
        .order("last_name");

      if (error) throw error;

      const proposed: Change[] = [];
      for (const c of clients ?? []) {
        const suggestion = suggestCorrectName(c.first_name, c.last_name);
        if (suggestion) {
          proposed.push({
            id: c.id,
            oldFirst: c.first_name,
            oldLast: c.last_name,
            newFirst: suggestion.first,
            newLast: suggestion.last,
            selected: true,
          });
        }
      }

      if (proposed.length === 0) {
        toast.success("Diakritika je v pořádku, žádné změny nejsou potřeba");
      } else {
        setChanges(proposed);
        setIsOpen(true);
      }
    } catch (e) {
      console.error(e);
      toast.error("Chyba při kontrole diakritiky");
    } finally {
      setLoading(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setChanges(prev => prev.map(c => ({ ...c, selected: checked })));
  };

  const toggleOne = (id: string) => {
    setChanges(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c));
  };

  const applyChanges = async () => {
    const selected = changes.filter(c => c.selected);
    if (selected.length === 0) {
      toast.error("Nevybráno žádné jméno ke změně");
      return;
    }
    setSaving(true);
    let ok = 0;
    try {
      for (const c of selected) {
        const { error } = await supabase
          .from("clients")
          .update({ first_name: c.newFirst, last_name: c.newLast })
          .eq("id", c.id);
        if (!error) ok++;
      }
      toast.success(`Opraveno ${ok} jmen`);
      setIsOpen(false);
      setChanges([]);
      onComplete();
    } catch {
      toast.error("Chyba při ukládání změn");
    } finally {
      setSaving(false);
    }
  };

  const allSelected = changes.every(c => c.selected);
  const selectedCount = changes.filter(c => c.selected).length;

  return (
    <>
      <Button variant="ghost" className="w-full justify-start text-sm px-2 py-1.5 h-auto font-normal" onClick={findChanges} disabled={loading}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
        Oprava diakritiky
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Oprava diakritiky jmen</DialogTitle>
            <DialogDescription>
              Nalezeno {changes.length} návrhů oprav. Vyberte, která jména chcete opravit.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 pr-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(v) => toggleAll(!!v)}
                    />
                  </TableHead>
                  <TableHead>Původní jméno</TableHead>
                  <TableHead className="w-6"></TableHead>
                  <TableHead>Navrhovaná oprava</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {changes.map(c => (
                  <TableRow key={c.id} className={c.selected ? "" : "opacity-40"}>
                    <TableCell>
                      <Checkbox checked={c.selected} onCheckedChange={() => toggleOne(c.id)} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.oldFirst} {c.oldLast}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-medium">
                      {c.newFirst !== c.oldFirst
                        ? <span className="text-primary font-semibold">{c.newFirst}</span>
                        : c.newFirst}{" "}
                      {c.newLast !== c.oldLast
                        ? <span className="text-primary font-semibold">{c.newLast}</span>
                        : c.newLast}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)} disabled={saving}>
              Zrušit
            </Button>
            <Button onClick={applyChanges} disabled={saving || selectedCount === 0}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
              Uložit vybrané ({selectedCount})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
