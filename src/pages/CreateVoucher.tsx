import { VoucherForm } from "@/components/VoucherForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import yaroLogo from "@/assets/yaro-logo.png";
import { useAuth } from "@/hooks/useAuth";

const CreateVoucher = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
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
          <h1 className="text-4xl font-bold text-foreground">Create New Voucher</h1>
          <p className="text-muted-foreground mt-2">
            Generate a professional travel voucher for your client
          </p>
        </header>

        <VoucherForm />
      </div>
    </div>
  );
};

export default CreateVoucher;
