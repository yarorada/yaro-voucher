import yaroLogo from "@/assets/yaro-logo-wide.png";

const Index = () => {
  return (
    <div className="min-h-full bg-[var(--gradient-subtle)] flex items-center justify-center">
      <div className="container max-w-4xl mx-auto py-8 md:py-12 px-4">
        <div className="text-center">
          <img src={yaroLogo} alt="YARO Travel" className="h-16 md:h-24 mx-auto mb-6 md:mb-8 logo-dark-mode" />
          <h1 className="text-2xl md:text-heading-1 text-foreground mb-4 md:mb-6">
            Vítejte v systému YARO
          </h1>
          <p className="text-base md:text-title text-muted-foreground max-w-2xl mx-auto leading-relaxed px-4">
            Komplexní systém pro správu obchodních případů, voucherů a klientů cestovní kanceláře YARO Travel
          </p>
        </div>
      </div>
    </div>
  );
};

export default Index;
