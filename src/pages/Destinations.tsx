import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { COUNTRY_DATA, lookupCountryData } from "@/lib/countryData";

interface Country {
  id: string;
  name: string;
  iso_code: string;
  currency: string | null;
}

interface Destination {
  id: string;
  name: string;
  countries: { name: string } | null;
}

const Destinations = () => {
  const navigate = useNavigate();
  const [countries, setCountries] = useState<Country[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [newCountryName, setNewCountryName] = useState("");
  const [newCountrySelected, setNewCountrySelected] = useState<{ name: string; iso: string; currency: string } | null>(null);
  const [newCountryManual, setNewCountryManual] = useState({ iso_code: "", currency: "" });
  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const [newDestination, setNewDestination] = useState({ name: "", country_id: "" });
  const [editingCountry, setEditingCountry] = useState<Country | null>(null);
  const [editingDestination, setEditingDestination] = useState<{ id: string; name: string; country_id: string } | null>(null);

  useEffect(() => {
    fetchCountries();
    fetchDestinations();
  }, []);

  const fetchCountries = async () => {
    const { data, error } = await supabase
      .from("countries")
      .select("*")
      .order("name");
    if (!error) setCountries(data || []);
  };

  const fetchDestinations = async () => {
    const { data, error } = await supabase
      .from("destinations")
      .select(`id, name, countries:country_id (name)`)
      .order("name");
    if (!error) setDestinations(data || []);
  };

  const countrySuggestions = useMemo(() => {
    const q = newCountryName.trim().toLowerCase();
    if (q.length < 3) return [];
    return Object.entries(COUNTRY_DATA)
      .filter(([key]) => key.includes(q))
      .slice(0, 10)
      .map(([key, val]) => ({ name: key.charAt(0).toUpperCase() + key.slice(1), ...val }));
  }, [newCountryName]);

  const handleSelectCountrySuggestion = (item: { name: string; iso: string; currency: string }) => {
    setNewCountryName(item.name);
    setNewCountrySelected(item);
    setNewCountryManual({ iso_code: item.iso, currency: item.currency });
    setShowSuggestions(false);
  };

  const handleCountryNameInput = (name: string) => {
    setNewCountryName(name);
    setNewCountrySelected(null);
    setNewCountryManual({ iso_code: "", currency: "" });
    setShowSuggestions(true);
  };

  const handleConfirmAddCountry = async () => {
    if (!newCountryName.trim() || !newCountryManual.iso_code) {
      toast.error("Vyplňte název a ISO kód země");
      return;
    }

    const { error } = await supabase.from("countries").insert({
      name: newCountryName.trim(),
      iso_code: newCountryManual.iso_code,
      currency: newCountryManual.currency || null,
    });
    if (error) {
      toast.error("Chyba při přidávání země");
      console.error(error);
    } else {
      toast.success("Země přidána");
      setNewCountryName("");
      setNewCountrySelected(null);
      setNewCountryManual({ iso_code: "", currency: "" });
      fetchCountries();
    }
  };

  const handleAddDestination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDestination.name || !newDestination.country_id) {
      toast.error("Vyplňte název destinace a vyberte zemi");
      return;
    }

    const { error } = await supabase.from("destinations").insert(newDestination);
    if (error) {
      toast.error("Chyba při přidávání destinace");
      console.error(error);
    } else {
      toast.success("Destinace přidána");
      setNewDestination({ name: "", country_id: "" });
      fetchDestinations();
    }
  };

  const handleDeleteCountry = async (id: string) => {
    const { error } = await supabase.from("countries").delete().eq("id", id);
    if (error) {
      toast.error("Chyba při mazání země");
    } else {
      toast.success("Země smazána");
      fetchCountries();
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

  const handleUpdateCountry = async () => {
    if (!editingCountry) return;
    if (!editingCountry.name || !editingCountry.iso_code) {
      toast.error("Vyplňte název a ISO kód země");
      return;
    }

    const { error } = await supabase
      .from("countries")
      .update({
        name: editingCountry.name,
        iso_code: editingCountry.iso_code,
        currency: editingCountry.currency,
      })
      .eq("id", editingCountry.id);

    if (error) {
      toast.error("Chyba při úpravě země");
      console.error(error);
    } else {
      toast.success("Země upravena");
      setEditingCountry(null);
      fetchCountries();
      fetchDestinations();
    }
  };

  const handleUpdateDestination = async () => {
    if (!editingDestination) return;
    if (!editingDestination.name || !editingDestination.country_id) {
      toast.error("Vyplňte název destinace a vyberte zemi");
      return;
    }

    const { error } = await supabase
      .from("destinations")
      .update({
        name: editingDestination.name,
        country_id: editingDestination.country_id,
      })
      .eq("id", editingDestination.id);

    if (error) {
      toast.error("Chyba při úpravě destinace");
      console.error(error);
    } else {
      toast.success("Destinace upravena");
      setEditingDestination(null);
      fetchDestinations();
    }
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <Tabs defaultValue="destinations" className="w-full">

          <TabsContent value="destinations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Přidat novou destinaci</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <form onSubmit={handleAddDestination} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="dest-name">Název destinace *</Label>
                      <Input
                        id="dest-name"
                        value={newDestination.name}
                        onChange={(e) =>
                          setNewDestination({ ...newDestination, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dest-country">Země *</Label>
                      <select
                        id="dest-country"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        value={newDestination.country_id}
                        onChange={(e) =>
                          setNewDestination({ ...newDestination, country_id: e.target.value })
                        }
                        required
                      >
                        <option value="">Vyberte zemi...</option>
                        {countries.map((country) => (
                          <option key={country.id} value={country.id}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button type="submit" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Přidat destinaci
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {destinations.map((destination) => (
                <Card key={destination.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{destination.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const dest = destinations.find(d => d.id === destination.id);
                          if (dest) {
                            // Find the country_id from the original data
                            supabase
                              .from("destinations")
                              .select("country_id")
                              .eq("id", destination.id)
                              .single()
                              .then(({ data }) => {
                                if (data) {
                                  setEditingDestination({
                                    id: destination.id,
                                    name: destination.name,
                                    country_id: data.country_id,
                                  });
                                }
                              });
                          }
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteDestination(destination.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                     <p className="text-body text-muted-foreground">
                      {destination.countries?.name}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="countries" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Přidat novou zemi</CardTitle>
              </CardHeader>
              <CardContent className="p-4 md:p-6">
                <div className="space-y-4">
                  <div className="space-y-2 relative">
                    <Label htmlFor="country-name">Název země *</Label>
                    <Input
                      id="country-name"
                      placeholder="Začněte psát název (min. 3 znaky)…"
                      value={newCountryName}
                      onChange={(e) => handleCountryNameInput(e.target.value)}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                      autoComplete="off"
                    />
                    {showSuggestions && countrySuggestions.length > 0 && !newCountrySelected && (
                      <div ref={suggestionsRef} className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                        {countrySuggestions.map((item) => (
                          <button
                            key={item.iso}
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-muted/50 text-sm flex items-center justify-between"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => handleSelectCountrySuggestion(item)}
                          >
                            <span className="font-medium">{item.name}</span>
                            <span className="text-muted-foreground text-xs">{item.iso} • {item.currency}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {newCountrySelected && (
                    <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
                      <p className="text-sm font-medium">
                        {newCountrySelected.name} — <span className="text-muted-foreground">ISO: {newCountryManual.iso_code}, Měna: {newCountryManual.currency}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">ISO kód</Label>
                          <Input
                            value={newCountryManual.iso_code}
                            onChange={(e) => setNewCountryManual({ ...newCountryManual, iso_code: e.target.value })}
                            maxLength={3}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Měna</Label>
                          <Input
                            value={newCountryManual.currency}
                            onChange={(e) => setNewCountryManual({ ...newCountryManual, currency: e.target.value })}
                          />
                        </div>
                      </div>
                      <Button onClick={handleConfirmAddCountry} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Potvrdit a uložit
                      </Button>
                    </div>
                  )}

                  {newCountryName.trim().length >= 3 && !newCountrySelected && countrySuggestions.length === 0 && (
                    <div className="rounded-lg border p-4 space-y-3">
                      <p className="text-sm text-muted-foreground">Země „{newCountryName}" nenalezena – zadejte údaje ručně:</p>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">ISO kód *</Label>
                          <Input
                            value={newCountryManual.iso_code}
                            onChange={(e) => setNewCountryManual({ ...newCountryManual, iso_code: e.target.value })}
                            maxLength={3}
                            placeholder="např. ESP"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Měna</Label>
                          <Input
                            value={newCountryManual.currency}
                            onChange={(e) => setNewCountryManual({ ...newCountryManual, currency: e.target.value })}
                            placeholder="např. EUR"
                          />
                        </div>
                      </div>
                      <Button onClick={handleConfirmAddCountry} className="gap-2" disabled={!newCountryManual.iso_code}>
                        <Plus className="h-4 w-4" />
                        Uložit zemi
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {countries.map((country) => (
                <Card key={country.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{country.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingCountry(country)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteCountry(country.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {country.iso_code}
                      {country.currency && ` • ${country.currency}`}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* Edit Country Dialog */}
        <Dialog open={!!editingCountry} onOpenChange={(open) => !open && setEditingCountry(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upravit zemi</DialogTitle>
              <DialogDescription>
                Upravte informace o zemi
              </DialogDescription>
            </DialogHeader>
            {editingCountry && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-country-name">Název země *</Label>
                  <Input
                    id="edit-country-name"
                    value={editingCountry.name}
                    onChange={(e) =>
                      setEditingCountry({ ...editingCountry, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-iso-code">ISO kód *</Label>
                  <Input
                    id="edit-iso-code"
                    value={editingCountry.iso_code}
                    onChange={(e) =>
                      setEditingCountry({ ...editingCountry, iso_code: e.target.value })
                    }
                    maxLength={2}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-currency">Měna</Label>
                  <Input
                    id="edit-currency"
                    value={editingCountry.currency || ""}
                    onChange={(e) =>
                      setEditingCountry({ ...editingCountry, currency: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingCountry(null)}>
                Zrušit
              </Button>
              <Button onClick={handleUpdateCountry}>
                Uložit změny
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Destination Dialog */}
        <Dialog open={!!editingDestination} onOpenChange={(open) => !open && setEditingDestination(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upravit destinaci</DialogTitle>
              <DialogDescription>
                Upravte informace o destinaci
              </DialogDescription>
            </DialogHeader>
            {editingDestination && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-dest-name">Název destinace *</Label>
                  <Input
                    id="edit-dest-name"
                    value={editingDestination.name}
                    onChange={(e) =>
                      setEditingDestination({ ...editingDestination, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-dest-country">Země *</Label>
                  <select
                    id="edit-dest-country"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={editingDestination.country_id}
                    onChange={(e) =>
                      setEditingDestination({ ...editingDestination, country_id: e.target.value })
                    }
                  >
                    <option value="">Vyberte zemi...</option>
                    {countries.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingDestination(null)}>
                Zrušit
              </Button>
              <Button onClick={handleUpdateDestination}>
                Uložit změny
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default Destinations;
