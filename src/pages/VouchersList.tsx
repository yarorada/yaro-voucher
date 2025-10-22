import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FileText, ArrowLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import yaroLogo from "@/assets/yaro-logo.png";
import { useAuth } from "@/hooks/useAuth";

interface Voucher {
  id: string;
  voucher_code: string;
  voucher_number: number;
  client_name: string;
  services: any;
  issue_date: string;
  created_at: string;
}

const VouchersList = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVouchers(data || []);
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      toast.error("Failed to load vouchers");
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
              Home
            </Button>
            <div className="flex items-center gap-4">
              <img src={yaroLogo} alt="YARO Travel" className="h-12" />
              <Button
                variant="outline"
                onClick={signOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </Button>
            </div>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold text-foreground">Vouchers</h1>
              <p className="text-muted-foreground mt-2">
                Manage and view all travel vouchers
              </p>
            </div>
            <Button
              onClick={() => navigate("/create")}
              className="bg-[var(--gradient-primary)] hover:opacity-90 gap-2"
            >
              <Plus className="h-4 w-4" />
              Create New Voucher
            </Button>
          </div>
        </header>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading vouchers...</p>
          </div>
        ) : vouchers.length === 0 ? (
          <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold text-foreground mb-2">No Vouchers Yet</h2>
            <p className="text-muted-foreground mb-6">
              Create your first travel voucher to get started
            </p>
            <Button
              onClick={() => navigate("/create")}
              className="bg-[var(--gradient-primary)] hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create First Voucher
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-muted-foreground">
                Total Vouchers: <span className="font-semibold text-foreground">{vouchers.length}</span>
              </p>
            </div>

            {vouchers.map((voucher) => (
              <Card
                key={voucher.id}
                className="p-6 hover:shadow-[var(--shadow-medium)] transition-shadow cursor-pointer"
                onClick={() => navigate(`/voucher/${voucher.id}`)}
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <Badge variant="outline" className="text-primary border-primary font-mono">
                        {voucher.voucher_code}
                      </Badge>
                      <h3 className="text-xl font-bold text-foreground">
                        {voucher.client_name}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                      <span>
                        <span className="font-semibold text-foreground">Services:</span>{" "}
                        {voucher.services.length}
                      </span>
                      <span>
                        <span className="font-semibold text-foreground">Issue Date:</span>{" "}
                        {formatDate(voucher.issue_date)}
                      </span>
                      <span>
                        <span className="font-semibold text-foreground">Created:</span>{" "}
                        {formatDate(voucher.created_at)}
                      </span>
                    </div>
                  </div>
                  <Button variant="outline">
                    View Details
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default VouchersList;
