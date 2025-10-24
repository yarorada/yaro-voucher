import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, FileText, ArrowLeft, LogOut, Edit, Copy, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { useAuth } from "@/hooks/useAuth";

interface Voucher {
  id: string;
  voucher_code: string;
  voucher_number: number;
  client_name: string;
  hotel_name: string;
  services: any;
  issue_date: string;
  created_at: string;
  client_id: string;
  clients?: {
    first_name: string;
    last_name: string;
  };
}

const VouchersList = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filteredVouchers, setFilteredVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchVouchers();
  }, []);

  useEffect(() => {
    filterVouchers();
  }, [searchQuery, vouchers]);

  const fetchVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select(`
          *,
          clients:client_id (
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVouchers(data || []);
      setFilteredVouchers(data || []);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      toast.error("Nepodařilo se načíst vouchery");
    } finally {
      setLoading(false);
    }
  };

  const filterVouchers = () => {
    if (!searchQuery.trim()) {
      setFilteredVouchers(vouchers);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = vouchers.filter(voucher => {
      const clientName = voucher.clients 
        ? `${voucher.clients.first_name} ${voucher.clients.last_name}`.toLowerCase()
        : voucher.client_name.toLowerCase();
      const hotelName = (voucher.hotel_name || '').toLowerCase();
      const voucherCode = voucher.voucher_code.toLowerCase();
      
      return clientName.includes(query) || 
             hotelName.includes(query) || 
             voucherCode.includes(query);
    });

    setFilteredVouchers(filtered);
  };

  const handleDuplicate = async (voucherId: string) => {
    try {
      setLoading(true);
      
      // Fetch the voucher to duplicate
      const { data: originalVoucher, error: fetchError } = await supabase
        .from('vouchers')
        .select('*, voucher_travelers(*)')
        .eq('id', voucherId)
        .single();

      if (fetchError) throw fetchError;

      // Generate new voucher code
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_voucher_code');

      if (codeError) throw codeError;

      const voucherNumber = parseInt(codeData.split('-')[1]);

      // Create new voucher
      const { data: newVoucher, error: insertError } = await supabase
        .from('vouchers')
        .insert({
          voucher_code: codeData,
          voucher_number: voucherNumber,
          client_id: originalVoucher.client_id,
          client_name: originalVoucher.client_name,
          hotel_name: originalVoucher.hotel_name,
          services: originalVoucher.services,
          expiration_date: originalVoucher.expiration_date,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Copy travelers
      if (originalVoucher.voucher_travelers && originalVoucher.voucher_travelers.length > 0) {
        const travelersToInsert = originalVoucher.voucher_travelers.map((traveler: any) => ({
          voucher_id: newVoucher.id,
          client_id: traveler.client_id,
          is_main_client: traveler.is_main_client,
        }));

        await supabase.from('voucher_travelers').insert(travelersToInsert);
      }

      toast.success("Voucher úspěšně duplikován!");
      fetchVouchers();
    } catch (error) {
      console.error('Error duplicating voucher:', error);
      toast.error("Nepodařilo se duplikovat voucher");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
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
              Domů
            </Button>
            <div className="flex items-center gap-4">
              <img src={yaroLogo} alt="YARO Travel" className="h-12" />
              <Button
                variant="outline"
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Odhlásit
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Vouchery</h1>
              <p className="text-muted-foreground mt-2">
                Správa a prohlížení všech cestovních voucherů
              </p>
            </div>
            <Button
              onClick={() => navigate("/create")}
              className="bg-[var(--gradient-primary)] hover:opacity-90 gap-2"
            >
              <Plus className="h-4 w-4" />
              Vytvořit nový voucher
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Načítám vouchery...</p>
          </div>
        ) : vouchers.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Zatím žádné vouchery</h2>
            <p className="text-muted-foreground mb-6">
              Vytvořte svůj první cestovní voucher
            </p>
            <Button
              onClick={() => navigate("/create")}
              className="bg-[var(--gradient-primary)] hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Vytvořit první voucher
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-4">
              <p className="text-sm text-muted-foreground">
                Celkem voucherů: <span className="font-semibold text-foreground">{vouchers.length}</span>
                {searchQuery && filteredVouchers.length !== vouchers.length && (
                  <span className="ml-2">
                    (zobrazeno: <span className="font-semibold text-foreground">{filteredVouchers.length}</span>)
                  </span>
                )}
              </p>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Hledat podle jména, hotelu nebo kódu..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {filteredVouchers.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">Nenalezeny žádné vouchery odpovídající vašemu hledání</p>
              </Card>
            ) : (
              filteredVouchers.map((voucher) => {
                const displayName = voucher.clients 
                  ? `${voucher.clients.first_name} ${voucher.clients.last_name}`
                  : voucher.client_name;
                const title = voucher.hotel_name 
                  ? `${displayName} - ${voucher.hotel_name}`
                  : displayName;

                return (
                  <Card
                    key={voucher.id}
                    className="p-6 hover:shadow-[var(--shadow-medium)] transition-shadow"
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/voucher/${voucher.id}`)}>
                        <div className="flex items-center gap-3 mb-2">
                          <Badge variant="outline" className="text-primary border-primary font-mono">
                            {voucher.voucher_code}
                          </Badge>
                          <h3 className="text-xl font-bold text-foreground">
                            {title}
                          </h3>
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>
                            <span className="font-semibold text-foreground">Služby:</span>{" "}
                            {voucher.services.length}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Datum vydání:</span>{" "}
                            {formatDate(voucher.issue_date)}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Vytvořeno:</span>{" "}
                            {formatDate(voucher.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(voucher.id);
                          }}
                          disabled={loading}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplikovat
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/edit/${voucher.id}`);
                          }}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Upravit
                        </Button>
                        <Button 
                          variant="outline"
                          onClick={() => navigate(`/voucher/${voucher.id}`)}
                        >
                          Zobrazit detail
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default VouchersList;
