import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VoucherDisplay } from "@/components/VoucherDisplay";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { useAuth } from "@/hooks/useAuth";

interface Voucher {
  id: string;
  voucher_code: string;
  voucher_number: number;
  client_name: string;
  other_travelers: string[] | null;
  services: any;
  issue_date: string;
  expiration_date: string | null;
}

const VoucherDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchVoucher();
    }
  }, [id]);

  const fetchVoucher = async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setVoucher(data);
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
          clientName={voucher.client_name}
          otherTravelers={voucher.other_travelers || undefined}
          services={voucher.services}
          issueDate={voucher.issue_date}
          expirationDate={voucher.expiration_date || undefined}
        />
      </div>
    </div>
  );
};

export default VoucherDetail;
