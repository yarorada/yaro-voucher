import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, FileText, Edit, Copy, Search, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  expiration_date: string | null;
  creator_email?: string;
  clients?: {
    first_name: string;
    last_name: string;
  };
}

const VouchersList = () => {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [filteredVouchers, setFilteredVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState<string | null>(null);

  useEffect(() => {
    fetchVouchers();
  }, []);

  useEffect(() => {
    filterVouchers();
  }, [searchQuery, vouchers]);

  const fetchVouchers = async () => {
    try {
      // Fetch vouchers
      const { data: vouchersData, error: vouchersError } = await supabase
        .from("vouchers")
        .select(
          `
          *,
          clients:client_id (
            first_name,
            last_name
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (vouchersError) throw vouchersError;

      // Fetch profiles to get creator emails
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email");

      if (profilesError) throw profilesError;

      // Create a map of user_id to email
      const emailMap = new Map(profilesData?.map(p => [p.id, p.email]) || []);

      // Combine data
      const transformedData = vouchersData?.map((voucher: any) => ({
        ...voucher,
        creator_email: emailMap.get(voucher.user_id)
      }));

      setVouchers(transformedData || []);
      setFilteredVouchers(transformedData || []);
    } catch (error) {
      console.error("Error fetching vouchers:", error);
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
    const filtered = vouchers.filter((voucher) => {
      const clientName = voucher.clients
        ? `${voucher.clients.first_name} ${voucher.clients.last_name}`.toLowerCase()
        : voucher.client_name.toLowerCase();
      const hotelName = (voucher.hotel_name || "").toLowerCase();
      const voucherCode = voucher.voucher_code.toLowerCase();

      return clientName.includes(query) || hotelName.includes(query) || voucherCode.includes(query);
    });

    setFilteredVouchers(filtered);
  };

  const handleDeleteClick = (voucherId: string) => {
    setVoucherToDelete(voucherId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!voucherToDelete) return;

    try {
      setLoading(true);

      // Get the voucher to be deleted to know its year
      const voucherToRemove = vouchers.find(v => v.id === voucherToDelete);
      if (!voucherToRemove) return;

      const year = new Date(voucherToRemove.issue_date).getFullYear();

      // Delete voucher_travelers first (foreign key constraint)
      await supabase.from("voucher_travelers").delete().eq("voucher_id", voucherToDelete);

      // Delete voucher
      const { error } = await supabase.from("vouchers").delete().eq("id", voucherToDelete);

      if (error) throw error;

      // Renumber remaining vouchers for this year
      await renumberVouchersForYear(year);

      toast.success("Voucher úspěšně smazán a čísla aktualizována!");
      setDeleteDialogOpen(false);
      setVoucherToDelete(null);
      fetchVouchers();
    } catch (error) {
      console.error("Error deleting voucher:", error);
      toast.error("Nepodařilo se smazat voucher");
    } finally {
      setLoading(false);
    }
  };

  const renumberVouchersForYear = async (year: number) => {
    try {
      // Get all vouchers for the year, ordered by created_at
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year}-12-31`;
      
      const { data: yearVouchers, error: fetchError } = await supabase
        .from("vouchers")
        .select("id, issue_date, created_at")
        .gte("issue_date", startOfYear)
        .lte("issue_date", endOfYear)
        .order("created_at", { ascending: true });

      if (fetchError) throw fetchError;

      // Update each voucher with new sequential number
      for (let i = 0; i < (yearVouchers?.length || 0); i++) {
        const voucher = yearVouchers![i];
        const newNumber = i + 1;
        const newCode = `${year}${String(newNumber).padStart(3, "0")}`;

        await supabase
          .from("vouchers")
          .update({ 
            voucher_number: newNumber, 
            voucher_code: newCode 
          })
          .eq("id", voucher.id);
      }

      // Update the counter table
      await supabase
        .from("voucher_counters")
        .upsert({ year, last_number: yearVouchers?.length || 0 });

    } catch (error) {
      console.error("Error renumbering vouchers:", error);
    }
  };

  const handleDuplicate = async (voucherId: string) => {
    try {
      setLoading(true);

      // Fetch the voucher to duplicate
      const { data: originalVoucher, error: fetchError } = await supabase
        .from("vouchers")
        .select("*, voucher_travelers(*)")
        .eq("id", voucherId)
        .single();

      if (fetchError) throw fetchError;

      // Create new voucher (voucher_code will be auto-generated by trigger)
      const { data: newVoucher, error: insertError } = await supabase
        .from("vouchers")
        .insert({
          client_id: originalVoucher.client_id,
          client_name: originalVoucher.client_name,
          hotel_name: originalVoucher.hotel_name,
          services: originalVoucher.services,
          expiration_date: originalVoucher.expiration_date,
          voucher_number: 0, // Temporary value
        } as any)
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

        await supabase.from("voucher_travelers").insert(travelersToInsert);
      }

      toast.success("Voucher úspěšně duplikován!");
      fetchVouchers();
    } catch (error) {
      console.error("Error duplicating voucher:", error);
      toast.error("Nepodařilo se duplikovat voucher");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-6xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Vouchery</h1>
              <p className="text-muted-foreground mt-2">Správa a prohlížení všech cestovních voucherů</p>
            </div>
            <Button onClick={() => navigate("/create")} variant="premium" className="gap-2">
              <Plus className="h-4 w-4" />
              Vytvořit voucher
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
            <p className="text-muted-foreground mb-6">Vytvořte svůj první cestovní voucher</p>
            <Button onClick={() => navigate("/create")} variant="premium">
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
              filteredVouchers.map((voucher, index) => {
                const displayName = voucher.clients
                  ? `${voucher.clients.first_name} ${voucher.clients.last_name}`
                  : voucher.client_name;
                const title = voucher.hotel_name ? `${displayName} - ${voucher.hotel_name}` : displayName;
                
                // Check if voucher is expired
                const isExpired = voucher.expiration_date 
                  ? new Date(voucher.expiration_date) < new Date() 
                  : false;

                return (
                  <Card 
                    key={voucher.id} 
                    className={`p-6 hover:shadow-[var(--shadow-medium)] transition-shadow ${
                      isExpired ? 'bg-muted/50 opacity-75' : ''
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex-1 cursor-pointer" onClick={() => navigate(`/voucher/${voucher.id}`)}>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-sm font-medium text-muted-foreground min-w-[24px]">
                            {index + 1}.
                          </span>
                          <Badge 
                            variant="outline" 
                            className={`font-mono ${
                              isExpired 
                                ? 'text-muted-foreground border-muted-foreground' 
                                : 'text-primary border-primary'
                            }`}
                          >
                            {voucher.voucher_code}
                          </Badge>
                          <h3 className={`text-xl font-bold ${isExpired ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {title}
                          </h3>
                          {isExpired && (
                            <Badge variant="secondary" className="text-xs">
                              Využitý
                            </Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                          <span>
                            <span className="font-semibold text-foreground">Služby:</span> {voucher.services.length}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Datum vydání:</span>{" "}
                            {formatDate(voucher.issue_date)}
                          </span>
                          <span>
                            <span className="font-semibold text-foreground">Vytvořeno:</span>{" "}
                            {formatDate(voucher.created_at)}
                          </span>
                          {voucher.creator_email && (
                            <span>
                              <span className="font-semibold text-foreground">Autor:</span>{" "}
                              {voucher.creator_email}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDuplicate(voucher.id);
                          }}
                          disabled={loading}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/edit/${voucher.id}`);
                          }}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="icon" onClick={() => navigate(`/voucher/${voucher.id}`)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteClick(voucher.id);
                          }}
                          className="hover:bg-destructive hover:text-destructive-foreground"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu chcete smazat tento voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Voucher bude trvale odstraněn z databáze.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VouchersList;
