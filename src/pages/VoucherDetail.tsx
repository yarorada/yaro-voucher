import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VoucherDisplay } from "@/components/VoucherDisplay";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { useAuth } from "@/hooks/useAuth";

interface Voucher {
  id: string;
  voucher_code: string;
  voucher_number: number;
  client_id: string;
  client_name: string;
  other_travelers: string[] | null;
  services: any;
  issue_date: string;
  expiration_date: string | null;
  supplier_id: string | null;
  clients?: {
    first_name: string;
    last_name: string;
  };
}

interface VoucherTraveler {
  client_id: string;
  is_main_client: boolean;
  clients: {
    first_name: string;
    last_name: string;
  };
}

const VoucherDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [travelers, setTravelers] = useState<VoucherTraveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<{
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
  } | null>(null);

  useEffect(() => {
    if (id) {
      fetchVoucher();
    }
  }, [id]);

  const fetchVoucher = async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*, clients(first_name, last_name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const voucherData = data as any;
      setVoucher(voucherData);

      // Fetch supplier if exists
      if (voucherData?.supplier_id) {
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('name, contact_person, email, phone')
          .eq('id', voucherData.supplier_id)
          .single();

        if (!supplierError && supplierData) {
          setSupplier(supplierData);
        }
      }

      // Fetch travelers
      const { data: travelersData, error: travelersError } = await supabase
        .from('voucher_travelers')
        .select('client_id, is_main_client, clients(first_name, last_name)')
        .eq('voucher_id', id)
        .order('is_main_client', { ascending: false });

      if (travelersError) throw travelersError;
      setTravelers(travelersData || []);
    } catch (error) {
      console.error('Error fetching voucher:', error);
      toast.error("Nepodařilo se načíst voucher");
      navigate('/vouchers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center">
        <p className="text-muted-foreground">Načítám voucher...</p>
      </div>
    );
  }

  if (!voucher) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        <header className="mb-8 print:hidden">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/vouchers")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zpět na vouchery
            </Button>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => navigate(`/edit/${id}`)}
                className="gap-2"
              >
                <Edit className="h-4 w-4" />
                Upravit
              </Button>
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
        </header>

        <VoucherDisplay
          voucherCode={voucher.voucher_code}
          clientName={
            travelers.find(t => t.is_main_client)
              ? `${travelers.find(t => t.is_main_client)?.clients.first_name} ${travelers.find(t => t.is_main_client)?.clients.last_name}`
              : voucher.client_name
          }
          otherTravelers={
            travelers
              .filter(t => !t.is_main_client)
              .map(t => `${t.clients.first_name} ${t.clients.last_name}`)
          }
          services={voucher.services}
          issueDate={voucher.issue_date}
          expirationDate={voucher.expiration_date || undefined}
          supplierName={supplier?.name}
          supplierContact={supplier?.contact_person}
          supplierEmail={supplier?.email}
          supplierPhone={supplier?.phone}
        />
      </div>
    </div>
  );
};

export default VoucherDetail;
