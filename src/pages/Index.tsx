import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FileText, Plus, List, Plane, LogOut, Building2, Users, Briefcase, MapPin, FileSignature } from "lucide-react";
import { useNavigate } from "react-router-dom";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-12 px-4">
        {/* Hero Section */}
        <header className="text-center mb-16">
          <div className="flex justify-end mb-4">
            <Button variant="outline" onClick={signOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              Odhlásit
            </Button>
          </div>
          <img src={yaroLogo} alt="YARO Travel" className="h-20 mx-auto mb-6" />
          <h1 className="text-5xl font-bold text-foreground mb-4">Evidence obchodních případů YARO</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Vytvářejte profesionální PDF cestovní vouchery pro své klienty s automatickým sledováním a bezpečným
            uložením
          </p>
        </header>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card
            className="p-8 hover:shadow-[var(--shadow-strong)] transition-shadow cursor-pointer group"
            onClick={() => navigate("/create")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Plus className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">Nový voucher</h2>
                <p className="text-muted-foreground">Vygeneruje nový voucher</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-[var(--shadow-strong)] transition-shadow cursor-pointer group"
            onClick={() => navigate("/vouchers")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <List className="h-8 w-8 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">Všechny vouchery</h2>
                <p className="text-muted-foreground">Vytvořené vouchery</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-[var(--shadow-strong)] transition-shadow cursor-pointer group"
            onClick={() => navigate("/suppliers")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">Dodavatelé</h2>
                <p className="text-muted-foreground">Spravovat dodavatele služeb</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-[var(--shadow-strong)] transition-shadow cursor-pointer group"
            onClick={() => navigate("/clients")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <Users className="h-8 w-8 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">Klienti</h2>
                <p className="text-muted-foreground">Spravovat klienty a cestující</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-[var(--shadow-strong)] transition-shadow cursor-pointer group"
            onClick={() => navigate("/deals")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Briefcase className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">Obchodní případy</h2>
                <p className="text-muted-foreground">Správa obchodních příležitostí</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-[var(--shadow-strong)] transition-shadow cursor-pointer group"
            onClick={() => navigate("/destinations")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <MapPin className="h-8 w-8 text-accent-foreground" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">Destinace</h2>
                <p className="text-muted-foreground">Správa zemí a destinací</p>
              </div>
            </div>
          </Card>

          <Card
            className="p-8 hover:shadow-[var(--shadow-strong)] transition-shadow cursor-pointer group"
            onClick={() => navigate("/contracts")}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <FileSignature className="h-8 w-8 text-primary" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">Cestovní smlouvy</h2>
                <p className="text-muted-foreground">Smlouvy podle §2521 OZ</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Features Section */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-foreground text-center mb-8">Funkce</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="p-6 text-center shadow-[var(--shadow-medium)]">
              <div className="inline-flex p-3 rounded-full bg-primary/10 mb-4">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Automaticky generované kódy</h3>
              <p className="text-sm text-muted-foreground">
                Unikátní kódy voucherů (YT-25001, YT-25002...) automaticky generované a sledované
              </p>
            </Card>

            <Card className="p-6 text-center shadow-[var(--shadow-medium)]">
              <div className="inline-flex p-3 rounded-full bg-accent/10 mb-4">
                <Plane className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Profesionální design</h3>
              <p className="text-sm text-muted-foreground">
                Čistý, moderní vzhled ideální pro tisk nebo odeslání emailem klientům
              </p>
            </Card>

            <Card className="p-6 text-center shadow-[var(--shadow-medium)]">
              <div className="inline-flex p-3 rounded-full bg-primary/10 mb-4">
                <List className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-bold text-foreground mb-2">Bezpečné úložiště</h3>
              <p className="text-sm text-muted-foreground">
                Všechny vouchery bezpečně uložené s kompletní historií a snadným získáním
              </p>
            </Card>
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Button
            size="lg"
            onClick={() => navigate("/create")}
            className="bg-[var(--gradient-primary)] hover:opacity-90 text-lg px-8 py-6"
          >
            <Plus className="h-5 w-5 mr-2" />
            Vytvořte svůj první voucher
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
