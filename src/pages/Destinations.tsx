import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Trash2, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SmartSearchInput } from "@/components/SmartSearchInput";
import { guessCountryFromDestination } from "@/lib/destinationCountryMap";

interface Country {
  id: string;
  name: string;
  iso_code: string;
  currency: string | null;
}

interface Destination {
  id: string;
  name: string;
  country_id?: string;
  countries: { name: string } | null;
}

const Destinations = () => {
  const [countries, setCountries] = useState<Country[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [searchText, setSearchText] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newDest, setNewDest] = useState({ name: "", country_id: "" });
  const [editingDestination, setEditingDestination] = useState<{ id: string; name: string; country_id: string } | null>(null);
  const [autoGuessedCountryName, setAutoGuessedCountryName] = useState<string | null>(null);

  useEffect(() => {
    fetchCountries();
    fetchDestinations();
  }, []);

  // toolbar set below after filtered/handleAddNew are declared

  const fetchCountries = async () => {
    const { data, error } = await supabase.from("countries").select("*").order("name");
    if (!error) setCountries(data || []);
  };

  const fetchDestinations = async () => {
    const { data, error } = await supabase
      .from("destinations")
      .select(`id, name, country_id, countries:country_id (name)`)
      .order("name");
    if (!error) setDestinations((data as unknown as Destination[]) || []);
  };

  const handleAddDestination = async () => {
    if (!newDest.name.trim() || !newDest.country_id) {
      toast.error("Vyplňte název destinace a vyberte zemi");
      return;
    }
    const { error } = await supabase.from("destinations").insert({
      name: newDest.name.trim(),
      country_id: newDest.country_id,
    });
    if (error) {
      toast.error("Chyba při přidávání destinace");
    } else {
      toast.success("Destinace přidána");
      setNewDest({ name: "", country_id: "" });
      setAutoGuessedCountryName(null);
      setIsAddOpen(false);
      setSearchText("");
      fetchDestinations();
    }
  };

  const handleDeleteDestination = async (id: string) => {
    const { error } = await supabase.from("destinations").delete().eq("id", id);
    if (error) {
      toast.error("Chyba při mazání destinace");
    } else {
      toast.success("Destinace smazána");
      fetchDestinations();
    }
  };

  const handleUpdateDestination = async () => {
    if (!editingDestination) return;
    if (!editingDestination.name.trim() || !editingDestination.country_id) {
      toast.error("Vyplňte název destinace a vyberte zemi");
      return;
    }
    const { error } = await supabase
      .from("destinations")
      .update({ name: editingDestination.name.trim(), country_id: editingDestination.country_id })
      .eq("id", editingDestination.id);
    if (error) {
      toast.error("Chyba při úpravě destinace");
    } else {
      toast.success("Destinace upravena");
      setEditingDestination(null);
      fetchDestinations();
    }
  };

  const filtered = useMemo(() => {
    if (!searchText.trim()) return destinations;
    const q = searchText.toLowerCase();
    return destinations.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.countries?.name?.toLowerCase().includes(q)
    );
  }, [destinations, searchText]);

  const handleAddNew = (text: string) => {
    const guessedCountryName = guessCountryFromDestination(text);
    let countryId = "";
    if (guessedCountryName) {
      const match = countries.find(
        (c) => c.name.toLowerCase() === guessedCountryName.toLowerCase()
      );
      countryId = match?.id || "";
    }
    setNewDest({ name: text, country_id: countryId });
    setAutoGuessedCountryName(guessedCountryName && countryId ? guessedCountryName : null);
    setIsAddOpen(true);
  };

  usePageToolbar(
    <SmartSearchInput
      value={searchText}
      onChange={setSearchText}
      noResults={filtered.length === 0 && searchText.trim().length > 0}
      addLabel={`destinaci „{text}"`}
      onAddNew={handleAddNew}
      placeholder="Hledat destinaci nebo zemi…"
      className="w-48 md:w-64"
      inputClassName="h-8 text-xs"
    />,
    [searchText, filtered.length]
  );

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-5xl mx-auto py-6 px-4 space-y-4">

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-1/2">Destinace</TableHead>
                <TableHead>Země</TableHead>
                <TableHead className="w-24 text-right">Akce</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-10">
                    {searchText ? "Žádné výsledky" : "Zatím žádné destinace"}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((dest) => (
                  <TableRow key={dest.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{dest.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <Globe className="h-3.5 w-3.5 shrink-0" />
                        {dest.countries?.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() =>
                            setEditingDestination({
                              id: dest.id,
                              name: dest.name,
                              country_id: dest.country_id || "",
                            })
                          }
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteDestination(dest.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t text-xs text-muted-foreground">
              {filtered.length} destinací
            </div>
          )}
        </div>
      </div>

      {/* Add Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Nová destinace</DialogTitle>
            <DialogDescription>
              {newDest.country_id
                ? "Automaticky jsme navrhli zemi – můžete ji změnit."
                : "Přidejte novou destinaci a vyberte zemi."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Název destinace *</Label>
              <Input
                placeholder="např. Antalya"
                value={newDest.name}
                onChange={(e) => {
                  const text = e.target.value;
                  const guessedCountryName = guessCountryFromDestination(text);
                  let countryId = newDest.country_id;
                  if (guessedCountryName) {
                    const match = countries.find(
                      (c) => c.name.toLowerCase() === guessedCountryName.toLowerCase()
                    );
                    if (match) {
                      countryId = match.id;
                      setAutoGuessedCountryName(match.name);
                    } else {
                      setAutoGuessedCountryName(null);
                    }
                  } else {
                    setAutoGuessedCountryName(null);
                  }
                  setNewDest({ ...newDest, name: text, country_id: countryId });
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAddDestination()}
              />
              {autoGuessedCountryName && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <span>🌍</span>
                  <span>Navrhujeme zemi: <strong>{autoGuessedCountryName}</strong> – můžete ji níže změnit.</span>
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Země *</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={newDest.country_id}
                onChange={(e) => setNewDest({ ...newDest, country_id: e.target.value })}
              >
                <option value="">Vyberte zemi…</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>Zrušit</Button>
            <Button onClick={handleAddDestination}>Přidat</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingDestination} onOpenChange={(open) => !open && setEditingDestination(null)}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Upravit destinaci</DialogTitle>
          </DialogHeader>
          {editingDestination && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Název destinace *</Label>
                <Input
                  value={editingDestination.name}
                  onChange={(e) => setEditingDestination({ ...editingDestination, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Země *</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={editingDestination.country_id}
                  onChange={(e) => setEditingDestination({ ...editingDestination, country_id: e.target.value })}
                >
                  <option value="">Vyberte zemi…</option>
                  {countries.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDestination(null)}>Zrušit</Button>
            <Button onClick={handleUpdateDestination}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Destinations;
