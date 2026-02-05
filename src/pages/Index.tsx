import yaroLogo from "@/assets/yaro-logo-wide.png";
import { TasksCard } from "@/components/dashboard/TasksCard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { RecentDealsCard } from "@/components/dashboard/RecentDealsCard";
import { RecentVouchersCard } from "@/components/dashboard/RecentVouchersCard";
import { RecentContractsCard } from "@/components/dashboard/RecentContractsCard";

const Index = () => {
  return (
    <div className="min-h-full bg-[var(--gradient-subtle)]">
      <div className="container max-w-7xl mx-auto py-6 px-4 space-y-6">
        {/* Header */}
        <div className="text-center pb-2">
          <img 
            src={yaroLogo} 
            alt="YARO Travel" 
            className="h-12 md:h-16 mx-auto mb-4 logo-dark-mode" 
          />
          <h1 className="text-xl md:text-2xl font-semibold text-foreground">
            Vítejte v systému YARO
          </h1>
        </div>

        {/* Main dashboard grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tasks card - spans full width on mobile, left column on desktop */}
          <TasksCard />
          
          {/* Stats card */}
          <StatsCard />
        </div>

        {/* Recent items grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <RecentDealsCard />
          <RecentVouchersCard />
          <RecentContractsCard />
        </div>
      </div>
    </div>
  );
};

export default Index;
