import { VoucherForm } from "@/components/VoucherForm";
import { useNavigate } from "react-router-dom";
import yaroLogo from "@/assets/yaro-logo-wide.png";

const CreateVoucher = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-4xl mx-auto py-8 px-4">
        <header className="mb-8">
          <h1 className="text-heading-1 text-foreground">Nový voucher</h1>
          <p className="text-body text-muted-foreground mt-2">Vygenerujte profesionální cestovní voucher pro svého klienta</p>
        </header>

        <VoucherForm />
      </div>
    </div>
  );
};

export default CreateVoucher;
