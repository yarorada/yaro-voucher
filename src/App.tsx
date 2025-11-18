import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const ProtectedLayout = ({ children }: { children: React.ReactNode }) => (
  <SidebarProvider>
    <div className="min-h-screen flex w-full">
      <AppSidebar />
      <div className="flex-1 flex flex-col">
        <header className="border-b bg-background print:hidden">
          <div className="h-12 flex items-center px-4">
            <SidebarTrigger />
          </div>
          <div className="px-4 pb-3">
            <Breadcrumbs />
          </div>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  </SidebarProvider>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
