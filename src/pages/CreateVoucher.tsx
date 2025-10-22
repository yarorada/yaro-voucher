import { VoucherForm } from "@/components/VoucherForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import yaroLogo from "@/assets/yaro-logo.png";

const CreateVoucher = () => {
  const navigate = useNavigate();

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
            <img src={yaroLogo} alt="YARO Travel" className="h-12" />
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
