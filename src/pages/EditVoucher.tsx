import { useEffect, useState } from "react";
import { VoucherForm } from "@/components/VoucherForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const EditVoucher = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(true);
  const [initialData, setInitialData] = useState<any>(null);

  useEffect(() => {
    if (id) {
      fetchVoucherData();
    }
  }, [id]);

  const fetchVoucherData = async () => {
    try {
      // Fetch voucher
      const { data: voucherData, error: voucherError } = await supabase
        .from('vouchers')
        .select('*')
        .eq('id', id)
        .single();

      if (voucherError) throw voucherError;

      // Fetch travelers
      const { data: travelersData, error: travelersError } = await supabase
        .from('voucher_travelers')
        .select('client_id, is_main_client')
        .eq('voucher_id', id);

      if (travelersError) throw travelersError;

      const mainClient = travelersData.find(t => t.is_main_client);
      const otherTravelers = travelersData.filter(t => !t.is_main_client);

      const voucherDataAny = voucherData as any;

      setInitialData({
        clientId: mainClient?.client_id || "",
        supplierId: voucherDataAny.supplier_id || "",
        otherTravelerIds: otherTravelers.map(t => t.client_id),
        expirationDate: voucherDataAny.expiration_date || "",
        services: voucherDataAny.services || [],
        hotelName: voucherDataAny.hotel_name || "",
      });
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

  if (!initialData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/vouchers")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Zpět
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
          <h1 className="text-4xl font-bold text-foreground">Upravit voucher</h1>
          <p className="text-muted-foreground mt-2">
            Upravte informace o voucheru
          </p>
        </header>

        <VoucherForm voucherId={id} initialData={initialData} />
      </div>
    </div>
  );
};

export default EditVoucher;
