import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Download, Mail, Loader2 } from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { VoucherDisplay, VoucherDisplayRef } from "@/components/VoucherDisplay";
import { removeDiacritics, translateTitleToEnglish } from "@/lib/utils";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
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
  sent_at: string | null;
  created_at: string;
  clients?: { first_name: string; last_name: string };
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
    email: string | null;
    phone: string | null;
  };
}

const formatDate = (d: string | null) => {
  if (!d) return "—";
  const date = new Date(d + (d.includes("T") ? "" : "T00:00:00"));
  return format(date, "d. MMMM yyyy", { locale: cs });
};

const formatDateShort = (d: string | null) => {
  if (!d) return "—";
  const date = new Date(d + (d.includes("T") ? "" : "T00:00:00"));
  return format(date, "d.M.yyyy");
};

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
    if (id) fetchVoucher();
  }, [id]);

  useEffect(() => {
    if (!loading && voucher) forceUpdate(n => n + 1);
  }, [loading, voucher]);

  const handleDelete = async () => {
    try {
      await supabase.from("voucher_travelers").delete().eq("voucher_id", id);
      const { error } = await supabase.from("vouchers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Voucher úspěšně smazán!");
      navigate("/vouchers");
    } catch (error) {
      console.error("Error deleting voucher:", error);
      toast.error("Nepodařilo se smazat voucher");
    }
  };

  const fetchVoucher = async () => {
    try {
      const { data, error } = await supabase
        .from("vouchers")
        .select("*, clients(first_name, last_name)")
        .eq("id", id)
        .single();
      if (error) throw error;
      const voucherData = data as any;
      setVoucher(voucherData);

      if (voucherData?.supplier_id) {
        const { data: supplierData, error: supplierError } = await supabase
          .from("suppliers")
          .select("name, contact_person, email, phone, address, notes")
          .eq("id", voucherData.supplier_id)
          .single();
        if (!supplierError && supplierData) setSupplier(supplierData);
      }

      const { data: travelersData, error: travelersError } = await supabase
        .from("voucher_travelers")
        .select("client_id, is_main_client, clients(first_name, last_name, title, date_of_birth, passport_number, passport_expiry, email, phone)")
        .eq("voucher_id", id)
        .order("is_main_client", { ascending: false });
      if (travelersError) throw travelersError;
      setTravelers((travelersData || []) as any);
    } catch (error) {
      console.error("Error fetching voucher:", error);
      toast.error("Nepodařilo se načíst voucher");
      navigate("/vouchers");
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
          disabled={voucherDisplayRef.current?.isGeneratingPdf}
          className={toolbarButtonClass}
        >
          {voucherDisplayRef.current?.isGeneratingPdf ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">PDF</span>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => voucherDisplayRef.current?.handleSendEmail()}
          disabled={voucherDisplayRef.current?.isSendingEmail}
          className={toolbarButtonClass}
        >
          {voucherDisplayRef.current?.isSendingEmail ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Mail className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">Odeslat</span>
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Načítám voucher...</p>
      </div>
    );
  }

  if (!voucher) return null;

  const mainTraveler = travelers.find(t => t.is_main_client);
  const otherTravelers = travelers.filter(t => !t.is_main_client);
  const services: any[] = Array.isArray(voucher.services) ? voucher.services : [];
  const teeTimes: any[] = Array.isArray(voucher.tee_times) ? voucher.tee_times : [];
  const flights: any[] = Array.isArray(voucher.flights) ? voucher.flights : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-5xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
            <h1 className="text-heading-1 text-foreground">{voucher.voucher_code}</h1>
            {voucher.sent_at ? (
              <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">Odesláno</Badge>
            ) : (
              <Badge variant="secondary">Neodesláno</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            Vydáno: {formatDate(voucher.issue_date)}
            {voucher.expiration_date && ` · Platnost do: ${formatDate(voucher.expiration_date)}`}
          </p>
        </div>

        <div className="grid gap-6">
          {/* Základní informace */}
          <Card className="p-4 md:p-6">
            <h2 className="text-heading-2 text-foreground mb-4">Základní informace</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Kód voucheru</p>
                <p className="font-medium text-foreground">{voucher.voucher_code}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Status odeslání</p>
                {voucher.sent_at ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">Odesláno</Badge>
                ) : (
                  <Badge variant="secondary">Neodesláno</Badge>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Datum vydání</p>
                <p className="font-medium text-foreground">{formatDate(voucher.issue_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Platnost do</p>
                <p className="font-medium text-foreground">
                  {voucher.expiration_date ? formatDate(voucher.expiration_date) : "Bez expirace"}
                </p>
              </div>
              {voucher.hotel_name && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Hotel</p>
                  <p className="font-medium text-foreground">{voucher.hotel_name}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground mb-1">Vytvořeno</p>
                <p className="font-medium text-foreground">{formatDate(voucher.created_at)}</p>
              </div>
            </div>
          </Card>

          {/* Cestující */}
          {travelers.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-heading-2 text-foreground mb-4">Cestující</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center py-2 text-muted-foreground font-medium w-10">#</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Jméno</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Datum narození</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Číslo pasu</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Kontakt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {travelers.map((t, idx) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 text-center font-medium text-foreground">{idx + 1}</td>
                        <td className="py-2 font-medium text-foreground">
                          {t.clients.title ? `${t.clients.title} ` : ""}
                          {t.clients.first_name} {t.clients.last_name}
                          {t.is_main_client && (
                            <Badge variant="outline" className="ml-2 text-xs">Hlavní</Badge>
                          )}
                        </td>
                        <td className="py-2 text-foreground">
                          {t.clients.date_of_birth ? formatDateShort(t.clients.date_of_birth) : "—"}
                        </td>
                        <td className="py-2 text-foreground">{t.clients.passport_number || "—"}</td>
                        <td className="py-2 text-foreground">
                          {[t.clients.email, t.clients.phone].filter(Boolean).join(", ") || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Dodavatel */}
          {supplier && (
            <Card className="p-4 md:p-6">
              <h2 className="text-heading-2 text-foreground mb-4">Dodavatel</h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Název</p>
                  <p className="font-medium text-foreground">{supplier.name}</p>
                </div>
                {supplier.contact_person && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Kontaktní osoba</p>
                    <p className="font-medium text-foreground">{supplier.contact_person}</p>
                  </div>
                )}
                {supplier.email && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Email</p>
                    <p className="font-medium text-foreground">{supplier.email}</p>
                  </div>
                )}
                {supplier.phone && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Telefon</p>
                    <p className="font-medium text-foreground">{supplier.phone}</p>
                  </div>
                )}
                {supplier.address && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Adresa</p>
                    <p className="font-medium text-foreground">{supplier.address}</p>
                  </div>
                )}
                {supplier.notes && (
                  <div className="md:col-span-2">
                    <p className="text-sm text-muted-foreground mb-1">Poznámky</p>
                    <p className="font-medium text-foreground">{supplier.notes}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Služby */}
          {services.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-heading-2 text-foreground mb-4">Služby</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 text-muted-foreground font-medium">Služba</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Od</th>
                      <th className="text-left py-2 text-muted-foreground font-medium">Do</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">Počet</th>
                      <th className="text-center py-2 text-muted-foreground font-medium">Osoby</th>
                    </tr>
                  </thead>
                  <tbody>
                    {services.map((service: any, idx: number) => (
                      <tr key={idx} className="border-b last:border-0">
                        <td className="py-2 font-medium text-foreground">{service.name}</td>
                        <td className="py-2 text-foreground">{service.dateFrom ? formatDateShort(service.dateFrom) : "—"}</td>
                        <td className="py-2 text-foreground">{service.dateTo ? formatDateShort(service.dateTo) : "—"}</td>
                        <td className="py-2 text-center text-foreground">{service.qty || "—"}</td>
                        <td className="py-2 text-center text-foreground">{service.pax || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Lety */}
          {flights.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-heading-2 text-foreground mb-4">Lety</h2>
              <div className="space-y-3">
                {flights.map((flight: any, idx: number) => (
                  <div key={idx} className="flex flex-wrap gap-3 text-sm p-3 bg-muted rounded-lg">
                    <span className="font-medium text-foreground">{flight.date ? formatDateShort(flight.date) : "—"}</span>
                    <span className="text-foreground font-medium">{flight.airlineCode}{flight.flightNumber ? ` ${flight.flightNumber}` : ""}</span>
                    <span className="text-foreground">{flight.fromIata || flight.from} → {flight.toIata || flight.to}</span>
                    {flight.departureTime && <span className="text-muted-foreground">odlet {flight.departureTime}</span>}
                    {flight.arrivalTime && <span className="text-muted-foreground">přílet {flight.arrivalTime}</span>}
                    {flight.pax && <span className="text-muted-foreground">{flight.pax} os.</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Tee Times */}
          {teeTimes.length > 0 && (
            <Card className="p-4 md:p-6">
              <h2 className="text-heading-2 text-foreground mb-4">Startovací časy (Tee Times)</h2>
              <div className="space-y-2">
                {teeTimes.map((tt: any, idx: number) => (
                  <div key={idx} className="flex flex-wrap gap-3 text-sm p-3 bg-muted rounded-lg">
                    <span className="font-medium text-foreground">{tt.date ? formatDateShort(tt.date) : "—"}</span>
                    <span className="text-foreground">{tt.club}</span>
                    {tt.time && <span className="text-muted-foreground">{tt.time}</span>}
                    {(tt.golfers || tt.players) && <span className="text-muted-foreground">{tt.golfers || tt.players} hráčů</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Skrytý VoucherDisplay pro generování PDF a odesílání emailu */}
      <div style={{ position: "absolute", left: "-9999px", top: 0, width: "800px" }}>
        <VoucherDisplay
          ref={voucherDisplayRef}
          voucherCode={voucher.voucher_code}
          clientName={
            mainTraveler
              ? (() => {
                  const title = translateTitleToEnglish(mainTraveler.clients.title);
                  const firstName = removeDiacritics(mainTraveler.clients.first_name);
                  const lastName = removeDiacritics(mainTraveler.clients.last_name);
                  return `1. ${title ? `${title} ` : ""}${firstName} ${lastName}`;
                })()
              : voucher.client_name
          }
          otherTravelers={otherTravelers.map((t, index) => {
            const title = translateTitleToEnglish(t.clients.title);
            const firstName = removeDiacritics(t.clients.first_name);
            const lastName = removeDiacritics(t.clients.last_name);
            return `${index + 2}. ${title ? `${title} ` : ""}${firstName} ${lastName}`;
          })}
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
