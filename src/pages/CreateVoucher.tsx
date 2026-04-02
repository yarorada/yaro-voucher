import { PageShell } from "@/components/PageShell";
import { VoucherForm } from "@/components/VoucherForm";
import { useNavigate } from "react-router-dom";
import yaroLogo from "@/assets/yaro-logo-wide.png";

const CreateVoucher = () => {
  const navigate = useNavigate();

  return (
    <PageShell maxWidth="narrow">
        <header className="mb-8">
          <h1 className="text-2xl md:text-heading-1 text-foreground">Nový voucher</h1>
          <p className="text-body text-muted-foreground mt-2">Vygenerujte profesionální cestovní voucher pro svého klienta</p>
        </header>

        <VoucherForm />
    </PageShell>
  );
};

export default CreateVoucher;
