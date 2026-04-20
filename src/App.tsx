import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { NotificationBell } from "@/components/NotificationBell";
import { FloatingTaskButton } from "@/components/FloatingTaskButton";
import { PageToolbarProvider, usePageToolbarContent, useHeaderActionsContent } from "@/hooks/usePageToolbar";
import { GlobalHistoryProvider, useGlobalHistory } from "@/hooks/useGlobalHistory";
import { Menu, Undo2, Redo2, Check, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import yaroLogo from "@/assets/yaro-logo.png";
import Index from "./pages/Index";
import CreateVoucher from "./pages/CreateVoucher";
import EditVoucher from "./pages/EditVoucher";
import VouchersList from "./pages/VouchersList";
import VoucherDetail from "./pages/VoucherDetail";
import Suppliers from "./pages/Suppliers";
import Clients from "./pages/Clients";
import Deals from "./pages/Deals";
import CreateDeal from "./pages/CreateDeal";
import DealDetail from "./pages/DealDetail";
import Destinations from "./pages/Destinations";
import Contracts from "./pages/Contracts";
import ContractDetail from "./pages/ContractDetail";
import CreateContract from "./pages/CreateContract";
import Statistics from "./pages/Statistics";
import Accounting from "./pages/Accounting";
import Invoicing from "./pages/Invoicing";
import EmailTemplates from "./pages/EmailTemplates";
import Hotels from "./pages/Hotels";
import PublicOffer from "./pages/PublicOffer";
import PublicHotels from "./pages/PublicHotels";
import PublicHotelDetail from "./pages/PublicHotelDetail";
import PublicAccounting from "./pages/PublicAccounting";
import SignContract from "./pages/SignContract";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import MfaSetup from "./pages/MfaSetup";
import MfaVerify from "./pages/MfaVerify";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";
import AdminRoles from "./pages/AdminRoles";

const queryClient = new QueryClient();

const SaveIndicator = () => {
  const { isSaving, lastSaved } = useGlobalHistory();
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground min-w-[70px] justify-end">
      {isSaving ? (
        <>
          <Save className="h-3.5 w-3.5 text-destructive animate-pulse" />
          Ukládám…
        </>
      ) : lastSaved ? (
        <>
          <Save className="h-3.5 w-3.5 text-emerald-500" />
          Uloženo
        </>
      ) : null}
    </span>
  );
};

const UndoRedoButtons = () => {
  const { canUndo, canRedo, undo, redo } = useGlobalHistory();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;
      if (isEditable) return; // necháme nativní undo v polích
      if (e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return (
    <div className="flex items-center gap-0.5">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={!canUndo}
        onClick={undo}
        title="Zpět (Ctrl+Z)"
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        disabled={!canRedo}
        onClick={redo}
        title="Vpřed (Ctrl+Shift+Z)"
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  );
};

const LayoutHeader = () => {
  const toolbarContent = usePageToolbarContent();
  const headerActions = useHeaderActionsContent();
  return (
    <header className="border-b bg-background print:hidden overflow-hidden">
      <div className="px-2 sm:px-4 py-2 max-w-full">
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <SidebarTrigger className="-ml-1 h-9 w-9 flex items-center justify-center rounded-lg hover:bg-accent transition-colors shrink-0">
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
          <div className="min-w-0 flex-1 overflow-hidden">
            <Breadcrumbs />
          </div>
          <div className="flex-1 min-w-0 hidden sm:block">
            {toolbarContent && (
              <div className="flex items-center gap-2 justify-end">
                {toolbarContent}
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {headerActions}
            <NotificationBell />
            <UndoRedoButtons />
            <SaveIndicator />
          </div>
        </div>
        {toolbarContent && (
          <div className="flex items-center gap-2 mt-2 sm:hidden min-w-0 w-full overflow-hidden">
            {toolbarContent}
          </div>
        )}
      </div>
    </header>
  );
};

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider defaultOpen={true}>
    <PageToolbarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <LayoutHeader />
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
          <FloatingTaskButton />
        </div>
      </div>
    </PageToolbarProvider>
  </SidebarProvider>
);
const App = () => (
  <QueryClientProvider client={queryClient}>
    <GlobalHistoryProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/mfa-setup" element={<MfaSetup />} />
          <Route path="/mfa-verify" element={<MfaVerify />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Index />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/create"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <CreateVoucher />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/edit/:id"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <EditVoucher />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vouchers"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <VouchersList />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/voucher/:id"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <VoucherDetail />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vouchers/:id"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <VoucherDetail />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Suppliers />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/clients"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Clients />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deals"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Deals />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deals/new"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <CreateDeal />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/deals/:id"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <DealDetail />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/destinations"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Destinations />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Contracts />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/new"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <CreateContract />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/contracts/:id"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <ContractDetail />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/statistics"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Statistics />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/accounting"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Accounting />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/email-templates"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <EmailTemplates />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/invoicing"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Invoicing />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/hotels"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <Hotels />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/roles"
            element={
              <ProtectedRoute>
                <ProtectedLayout>
                  <AdminRoles />
                </ProtectedLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/offer/:token" element={<PublicOffer />} />
          <Route path="/hotely" element={<PublicHotels />} />
          <Route path="/hotely/:slug" element={<PublicHotelDetail />} />
          <Route path="/accounting/share/:token" element={<PublicAccounting />} />
          <Route path="/sign-contract" element={<SignContract />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </GlobalHistoryProvider>
  </QueryClientProvider>
);

export default App;
