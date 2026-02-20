import { useState, useEffect } from "react";
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

// Country name → { iso3, currency } lookup
const COUNTRY_DATA: Record<string, { iso: string; currency: string }> = {
  "afghánistán": { iso: "AFG", currency: "AFN" },
  "albánie": { iso: "ALB", currency: "ALL" },
  "alžírsko": { iso: "DZA", currency: "DZD" },
  "andorra": { iso: "AND", currency: "EUR" },
  "angola": { iso: "AGO", currency: "AOA" },
  "argentina": { iso: "ARG", currency: "ARS" },
  "arménie": { iso: "ARM", currency: "AMD" },
  "austrálie": { iso: "AUS", currency: "AUD" },
  "ázerbájdžán": { iso: "AZE", currency: "AZN" },
  "bahamy": { iso: "BHS", currency: "BSD" },
  "bahrajn": { iso: "BHR", currency: "BHD" },
  "bangladéš": { iso: "BGD", currency: "BDT" },
  "barbados": { iso: "BRB", currency: "BBD" },
  "belgie": { iso: "BEL", currency: "EUR" },
  "belize": { iso: "BLZ", currency: "BZD" },
  "bělorusko": { iso: "BLR", currency: "BYN" },
  "bolívie": { iso: "BOL", currency: "BOB" },
  "bosna a hercegovina": { iso: "BIH", currency: "BAM" },
  "botswana": { iso: "BWA", currency: "BWP" },
  "brazílie": { iso: "BRA", currency: "BRL" },
  "brunej": { iso: "BRN", currency: "BND" },
  "bulharsko": { iso: "BGR", currency: "BGN" },
  "burkina faso": { iso: "BFA", currency: "XOF" },
  "burundi": { iso: "BDI", currency: "BIF" },
  "čad": { iso: "TCD", currency: "XAF" },
  "česko": { iso: "CZE", currency: "CZK" },
  "česká republika": { iso: "CZE", currency: "CZK" },
  "čína": { iso: "CHN", currency: "CNY" },
  "dánsko": { iso: "DNK", currency: "DKK" },
  "dominikánská republika": { iso: "DOM", currency: "DOP" },
  "egypt": { iso: "EGY", currency: "EGP" },
  "ekvádor": { iso: "ECU", currency: "USD" },
  "eritrea": { iso: "ERI", currency: "ERN" },
  "estonsko": { iso: "EST", currency: "EUR" },
  "etiopie": { iso: "ETH", currency: "ETB" },
  "filipíny": { iso: "PHL", currency: "PHP" },
  "finsko": { iso: "FIN", currency: "EUR" },
  "francie": { iso: "FRA", currency: "EUR" },
  "gambie": { iso: "GMB", currency: "GMD" },
  "ghana": { iso: "GHA", currency: "GHS" },
  "gruzie": { iso: "GEO", currency: "GEL" },
  "guatemala": { iso: "GTM", currency: "GTQ" },
  "honduras": { iso: "HND", currency: "HNL" },
  "chile": { iso: "CHL", currency: "CLP" },
  "chorvatsko": { iso: "HRV", currency: "EUR" },
  "indie": { iso: "IND", currency: "INR" },
  "indonésie": { iso: "IDN", currency: "IDR" },
  "irák": { iso: "IRQ", currency: "IQD" },
  "írán": { iso: "IRN", currency: "IRR" },
  "irsko": { iso: "IRL", currency: "EUR" },
  "island": { iso: "ISL", currency: "ISK" },
  "itálie": { iso: "ITA", currency: "EUR" },
  "izrael": { iso: "ISR", currency: "ILS" },
  "jamajka": { iso: "JAM", currency: "JMD" },
  "japonsko": { iso: "JPN", currency: "JPY" },
  "jemen": { iso: "YEM", currency: "YER" },
  "jihoafrická republika": { iso: "ZAF", currency: "ZAR" },
  "jižní korea": { iso: "KOR", currency: "KRW" },
  "jordánsko": { iso: "JOR", currency: "JOD" },
  "kambodža": { iso: "KHM", currency: "KHR" },
  "kamerun": { iso: "CMR", currency: "XAF" },
  "kanada": { iso: "CAN", currency: "CAD" },
  "kapverdy": { iso: "CPV", currency: "CVE" },
  "katar": { iso: "QAT", currency: "QAR" },
  "kazachstán": { iso: "KAZ", currency: "KZT" },
  "keňa": { iso: "KEN", currency: "KES" },
  "kolumbie": { iso: "COL", currency: "COP" },
  "kostarika": { iso: "CRI", currency: "CRC" },
  "kuba": { iso: "CUB", currency: "CUP" },
  "kuvajt": { iso: "KWT", currency: "KWD" },
  "kypr": { iso: "CYP", currency: "EUR" },
  "kyrgyzstán": { iso: "KGZ", currency: "KGS" },
  "laos": { iso: "LAO", currency: "LAK" },
  "libanon": { iso: "LBN", currency: "LBP" },
  "libye": { iso: "LBY", currency: "LYD" },
  "lichtenštejnsko": { iso: "LIE", currency: "CHF" },
  "litva": { iso: "LTU", currency: "EUR" },
  "lotyšsko": { iso: "LVA", currency: "EUR" },
  "lucembursko": { iso: "LUX", currency: "EUR" },
  "madagaskar": { iso: "MDG", currency: "MGA" },
  "maďarsko": { iso: "HUN", currency: "HUF" },
  "malajsie": { iso: "MYS", currency: "MYR" },
  "maledivy": { iso: "MDV", currency: "MVR" },
  "malta": { iso: "MLT", currency: "EUR" },
  "maroko": { iso: "MAR", currency: "MAD" },
  "mauricius": { iso: "MUS", currency: "MUR" },
  "mauritánie": { iso: "MRT", currency: "MRU" },
  "mexiko": { iso: "MEX", currency: "MXN" },
  "moldavsko": { iso: "MDA", currency: "MDL" },
  "monako": { iso: "MCO", currency: "EUR" },
  "mongolsko": { iso: "MNG", currency: "MNT" },
  "mosambik": { iso: "MOZ", currency: "MZN" },
  "myanmar": { iso: "MMR", currency: "MMK" },
  "namibie": { iso: "NAM", currency: "NAD" },
  "německo": { iso: "DEU", currency: "EUR" },
  "nepál": { iso: "NPL", currency: "NPR" },
  "nigérie": { iso: "NGA", currency: "NGN" },
  "nikaragua": { iso: "NIC", currency: "NIO" },
  "nizozemsko": { iso: "NLD", currency: "EUR" },
  "norsko": { iso: "NOR", currency: "NOK" },
  "nový zéland": { iso: "NZL", currency: "NZD" },
  "omán": { iso: "OMN", currency: "OMR" },
  "pákistán": { iso: "PAK", currency: "PKR" },
  "panama": { iso: "PAN", currency: "PAB" },
  "paraguay": { iso: "PRY", currency: "PYG" },
  "peru": { iso: "PER", currency: "PEN" },
  "pobřeží slonoviny": { iso: "CIV", currency: "XOF" },
  "polsko": { iso: "POL", currency: "PLN" },
  "portoriko": { iso: "PRI", currency: "USD" },
  "portugalsko": { iso: "PRT", currency: "EUR" },
  "rakousko": { iso: "AUT", currency: "EUR" },
  "rumunsko": { iso: "ROU", currency: "RON" },
  "rusko": { iso: "RUS", currency: "RUB" },
  "řecko": { iso: "GRC", currency: "EUR" },
  "salvador": { iso: "SLV", currency: "USD" },
  "saúdská arábie": { iso: "SAU", currency: "SAR" },
  "senegal": { iso: "SEN", currency: "XOF" },
  "severní makedonie": { iso: "MKD", currency: "MKD" },
  "singapur": { iso: "SGP", currency: "SGD" },
  "slovensko": { iso: "SVK", currency: "EUR" },
  "slovinsko": { iso: "SVN", currency: "EUR" },
  "spojené arabské emiráty": { iso: "ARE", currency: "AED" },
  "spojené státy": { iso: "USA", currency: "USD" },
  "spojené státy americké": { iso: "USA", currency: "USD" },
  "srbsko": { iso: "SRB", currency: "RSD" },
  "srí lanka": { iso: "LKA", currency: "LKR" },
  "středoafrická republika": { iso: "CAF", currency: "XAF" },
  "súdán": { iso: "SDN", currency: "SDG" },
  "surinam": { iso: "SUR", currency: "SRD" },
  "svazijsko": { iso: "SWZ", currency: "SZL" },
  "eswatini": { iso: "SWZ", currency: "SZL" },
  "sýrie": { iso: "SYR", currency: "SYP" },
  "šikmooký": { iso: "ESP", currency: "EUR" },
  "španělsko": { iso: "ESP", currency: "EUR" },
  "švédsko": { iso: "SWE", currency: "SEK" },
  "švýcarsko": { iso: "CHE", currency: "CHF" },
  "tádžikistán": { iso: "TJK", currency: "TJS" },
  "tanzanie": { iso: "TZA", currency: "TZS" },
  "thajsko": { iso: "THA", currency: "THB" },
  "tchaj-wan": { iso: "TWN", currency: "TWD" },
  "togo": { iso: "TGO", currency: "XOF" },
  "trinidad a tobago": { iso: "TTO", currency: "TTD" },
  "tunisko": { iso: "TUN", currency: "TND" },
  "turecko": { iso: "TUR", currency: "TRY" },
  "turkmenistán": { iso: "TKM", currency: "TMT" },
  "uganda": { iso: "UGA", currency: "UGX" },
  "ukrajina": { iso: "UKR", currency: "UAH" },
  "uruguay": { iso: "URY", currency: "UYU" },
  "uzbekistán": { iso: "UZB", currency: "UZS" },
  "venezuela": { iso: "VEN", currency: "VES" },
  "vietnam": { iso: "VNM", currency: "VND" },
  "zambie": { iso: "ZMB", currency: "ZMW" },
  "zimbabwe": { iso: "ZWE", currency: "ZWL" },
  "černá hora": { iso: "MNE", currency: "EUR" },
  "kosovo": { iso: "XKX", currency: "EUR" },
  "seychely": { iso: "SYC", currency: "SCR" },
  "fidži": { iso: "FJI", currency: "FJD" },
  "cookovy ostrovy": { iso: "COK", currency: "NZD" },
  "dominika": { iso: "DMA", currency: "XCD" },
  "antigua a barbuda": { iso: "ATG", currency: "XCD" },
};

const lookupCountryData = (name: string) => {
  const key = name.trim().toLowerCase();
  return COUNTRY_DATA[key] || null;
};

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
  const [newCountry, setNewCountry] = useState({ name: "", iso_code: "", currency: "" });
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
      .select(`
        id,
        name,
        countries:country_id (name)
      `)
      .order("name");
    if (!error) setDestinations(data || []);
  };

  const handleAddCountry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountry.name || !newCountry.iso_code) {
      toast.error("Vyplňte název a ISO kód země");
      return;
    }

    const { error } = await supabase.from("countries").insert(newCountry);
    if (error) {
      toast.error("Chyba při přidávání země");
      console.error(error);
    } else {
      toast.success("Země přidána");
      setNewCountry({ name: "", iso_code: "", currency: "" });
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
        <header className="mb-8">
          <h1 className="text-2xl md:text-heading-1 text-foreground">Destinace</h1>
          <p className="text-body text-muted-foreground mt-2">
            Správa zemí a destinací
          </p>
        </header>

        <Tabs defaultValue="destinations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="destinations">Destinace</TabsTrigger>
            <TabsTrigger value="countries">Země</TabsTrigger>
          </TabsList>

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
                <form onSubmit={handleAddCountry} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country-name">Název země *</Label>
                      <Input
                        id="country-name"
                        value={newCountry.name}
                        onChange={(e) => {
                          const name = e.target.value;
                          const match = lookupCountryData(name);
                          setNewCountry({
                            name,
                            iso_code: match?.iso || newCountry.iso_code,
                            currency: match?.currency || newCountry.currency,
                          });
                        }}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="iso-code">ISO kód *</Label>
                      <Input
                        id="iso-code"
                        value={newCountry.iso_code}
                        onChange={(e) =>
                          setNewCountry({ ...newCountry, iso_code: e.target.value })
                        }
                        maxLength={3}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Měna</Label>
                      <Input
                        id="currency"
                        value={newCountry.currency}
                        onChange={(e) =>
                          setNewCountry({ ...newCountry, currency: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <Button type="submit" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Přidat zemi
                  </Button>
                </form>
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
