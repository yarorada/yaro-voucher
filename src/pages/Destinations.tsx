import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, LogOut, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const { signOut } = useAuth();
  const [countries, setCountries] = useState<Country[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [newCountry, setNewCountry] = useState({ name: "", iso_code: "", currency: "" });
  const [newDestination, setNewDestination] = useState({ name: "", country_id: "" });

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

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zpět
            </Button>
            <div className="flex items-center gap-4">
              <img src={yaroLogo} alt="YARO Travel" className="h-12" />
              <Button variant="outline" onClick={signOut} className="gap-2">
                <LogOut className="h-4 w-4" />
                Odhlásit
              </Button>
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground">Destinace</h1>
          <p className="text-muted-foreground mt-2">
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
                <CardTitle>Přidat novou destinaci</CardTitle>
              </CardHeader>
              <CardContent>
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {destinations.map((destination) => (
                <Card key={destination.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{destination.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteDestination(destination.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
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
                <CardTitle>Přidat novou zemi</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddCountry} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="country-name">Název země *</Label>
                      <Input
                        id="country-name"
                        value={newCountry.name}
                        onChange={(e) =>
                          setNewCountry({ ...newCountry, name: e.target.value })
                        }
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
                        maxLength={2}
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {countries.map((country) => (
                <Card key={country.id}>
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <CardTitle className="text-lg">{country.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteCountry(country.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
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
      </div>
    </div>
  );
};

export default Destinations;
