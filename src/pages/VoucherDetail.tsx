import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Edit, Trash2, Download, Mail } from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VoucherDisplay, VoucherDisplayRef } from "@/components/VoucherDisplay";
import { removeDiacritics, translateTitleToEnglish } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Voucher {
  id: string;
  voucher_code: string;
  voucher_number: number;
  client_id: string;
  client_name: string;
  hotel_name: string;
  other_travelers: string[] | null;
  services: any;
  tee_times?: any;
  flights?: any;
  issue_date: string;
  expiration_date: string | null;
  supplier_id: string | null;
  deal_id: string | null;
  clients?: {
    first_name: string;
    last_name: string;
  };
}

interface VoucherTraveler {
  client_id: string;
  is_main_client: boolean;
  clients: {
    first_name: string;
    last_name: string;
    title: string | null;
    date_of_birth: string | null;
    passport_number: string | null;
    passport_expiry: string | null;
  };
}

const VoucherDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [travelers, setTravelers] = useState<VoucherTraveler[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<{
    name: string;
    contact_person: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  } | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const voucherDisplayRef = useRef<VoucherDisplayRef>(null);
  const [, forceUpdate] = useState(0);


  useEffect(() => {
    if (id) {
      fetchVoucher();
    }
  }, [id]);

  // Force re-render after ref is set so toolbar picks up ref methods
  useEffect(() => {
    if (!loading && voucher) {
      forceUpdate(n => n + 1);
    }
  }, [loading, voucher]);

  const handleDelete = async () => {
    try {
      // Delete voucher_travelers first (foreign key constraint)
      await supabase
        .from('voucher_travelers')
        .delete()
        .eq('voucher_id', id);

      // Delete voucher
      const { error } = await supabase
        .from('vouchers')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Voucher úspěšně smazán!");
      navigate('/vouchers');
    } catch (error) {
      console.error('Error deleting voucher:', error);
      toast.error("Nepodařilo se smazat voucher");
    }
  };

  const fetchVoucher = async () => {
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*, clients(first_name, last_name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      
      const voucherData = data as any;
      setVoucher(voucherData);

      // Fetch supplier if exists
      if (voucherData?.supplier_id) {
        const { data: supplierData, error: supplierError } = await supabase
          .from('suppliers')
          .select('name, contact_person, email, phone, address, notes')
          .eq('id', voucherData.supplier_id)
          .single();

        if (!supplierError && supplierData) {
          setSupplier(supplierData);
        }
      }

      // Fetch travelers
      const { data: travelersData, error: travelersError } = await supabase
        .from('voucher_travelers')
        .select('client_id, is_main_client, clients(first_name, last_name, title, date_of_birth, passport_number, passport_expiry)')
        .eq('voucher_id', id)
        .order('is_main_client', { ascending: false });

      if (travelersError) throw travelersError;
      setTravelers(travelersData || []);
    } catch (error) {
      console.error('Error fetching voucher:', error);
      toast.error("Nepodařilo se načíst voucher");
      navigate('/vouchers');
    } finally {
      setLoading(false);
    }
  };

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    !loading && voucher ? (
      <>
        {voucherDisplayRef.current?.settingsDialog}
        <Button
          variant="outline"
          size="sm"
          onClick={() => voucherDisplayRef.current?.handleDownloadPDF()}
          className={toolbarButtonClass}
          disabled={voucherDisplayRef.current?.isGeneratingPdf || voucherDisplayRef.current?.isTranslating}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">PDF</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => voucherDisplayRef.current?.handleSendEmail()}
          className={toolbarButtonClass}
          disabled={voucherDisplayRef.current?.isSendingEmail}
        >
          <Mail className="h-4 w-4" />
          <span className="hidden sm:inline">Email</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate(`/edit/${id}`)}
          className={toolbarButtonClass}
        >
          <Edit className="h-4 w-4" />
          <span className="hidden sm:inline">Upravit</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDeleteDialogOpen(true)}
          className={`${toolbarButtonClass} hover:bg-destructive hover:text-destructive-foreground`}
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden sm:inline">Smazat</span>
        </Button>
      </>
    ) : null,
    [id, loading, voucher, voucherDisplayRef.current]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--gradient-subtle)] flex items-center justify-center">
        <p className="text-muted-foreground">Načítám voucher...</p>
      </div>
    );
  }

  if (!voucher) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[var(--gradient-subtle)]">
      <div className="container max-w-5xl mx-auto py-8 px-4">

        <VoucherDisplay
          ref={voucherDisplayRef}
          voucherCode={voucher.voucher_code}
          clientName={
            travelers.find(t => t.is_main_client)
              ? (() => {
                  const mainClient = travelers.find(t => t.is_main_client)!;
                  const title = translateTitleToEnglish(mainClient.clients.title);
                  const firstName = removeDiacritics(mainClient.clients.first_name);
                  const lastName = removeDiacritics(mainClient.clients.last_name);
                  return `1. ${title ? `${title} ` : ''}${firstName} ${lastName}`;
                })()
              : voucher.client_name
          }
          otherTravelers={
            travelers
              .filter(t => !t.is_main_client)
              .map((t, index) => {
                const title = translateTitleToEnglish(t.clients.title);
                const firstName = removeDiacritics(t.clients.first_name);
                const lastName = removeDiacritics(t.clients.last_name);
                return `${index + 2}. ${title ? `${title} ` : ''}${firstName} ${lastName}`;
              })
          }
          services={voucher.services}
          hotelName={voucher.hotel_name}
          teeTimes={voucher.tee_times}
          flights={voucher.flights}
          issueDate={voucher.issue_date}
          expirationDate={voucher.expiration_date || undefined}
          supplierName={supplier?.name}
          supplierContact={supplier?.contact_person}
          supplierEmail={supplier?.email}
          supplierPhone={supplier?.phone}
          supplierAddress={supplier?.address}
          supplierNotes={supplier?.notes}
          voucherId={voucher.id}
          dealId={voucher.deal_id}
          hideActions
        />
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Opravdu chcete smazat tento voucher?</AlertDialogTitle>
            <AlertDialogDescription>
              Tato akce je nevratná. Voucher bude trvale odstraněn z databáze.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Smazat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VoucherDetail;
