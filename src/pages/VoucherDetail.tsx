import { useEffect, useState, useCallback } from "react";
import { PageShell } from "@/components/PageShell";
import { useParams, useNavigate } from "react-router-dom";
import yaroLogoWide from "@/assets/yaro-logo-wide.png";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Download, Mail, Loader2, User, Users, Building2, ChevronDown, Plus, X } from "lucide-react";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { removeDiacritics } from "@/lib/utils";
import { format } from "date-fns";
import { cs } from "date-fns/locale";
import { jsPDF } from "jspdf";
import { buildVoucherPdfBlob, getLogoBase64ForPdf, fetchBaggageFromDeal, type BaggageAllowance, type LogoInfo } from "@/lib/voucherPdfBuilder";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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

const fmtDatePdf = (d: string) => {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${dt.getFullYear()}`;
};

// buildVoucherPdfBlob, BaggageAllowance, normalizePdfInlineText are imported from @/lib/voucherPdfBuilder

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [baggage, setBaggage] = useState<BaggageAllowance | null>(null);

  // Send dialog state
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendMode, setSendMode] = useState<"client" | "both" | "supplier">("client");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [extraEmails, setExtraEmails] = useState<string[]>([]);
  const [newExtraEmail, setNewExtraEmail] = useState("");

  useEffect(() => {
    if (id) fetchVoucher();
  }, [id]);

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
        .select("*, clients(first_name, last_name), deals:deal_id(destinations:destination_id(name, countries:country_id(iso_code)))")
        .eq("id", id)
        .single();
      if (error) throw error;
      const voucherData = data as any;
      setVoucher(voucherData);

      if (voucherData?.supplier_id) {
        const { data: supplierData } = await supabase
          .from("suppliers")
          .select("name, contact_person, email, phone, address, notes")
          .eq("id", voucherData.supplier_id)
          .single();
        if (supplierData) setSupplier(supplierData as any);
      }

      const { data: travelersData, error: travelersError } = await supabase
        .from("voucher_travelers")
        .select("client_id, is_main_client, clients(first_name, last_name, title, date_of_birth, passport_number, passport_expiry, email, phone)")
        .eq("voucher_id", id)
        .order("is_main_client", { ascending: false });
      if (travelersError) throw travelersError;
      setTravelers((travelersData || []) as any);

      // Fetch baggage from deal_services if voucher is linked to a deal
      if (voucherData?.deal_id) {
        const baggageData = await fetchBaggageFromDeal(supabase, voucherData.deal_id);
        setBaggage(baggageData);
      }
    } catch (error) {
      console.error("Error fetching voucher:", error);
      toast.error("Nepodařilo se načíst voucher");
      navigate("/vouchers");
    } finally {
      setLoading(false);
    }
  };

  const getLogoBase64 = useCallback(async () => {
    return getLogoBase64ForPdf(yaroLogoWide);
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!voucher) return;
    setIsDownloading(true);
    try {
      const logoInfo = await getLogoBase64();
      const blob = buildVoucherPdfBlob(voucher, supplier?.name, supplier, logoInfo, travelers, baggage);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Voucher-${voucher.voucher_code}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("PDF staženo");
    } catch (e) {
      console.error(e);
      toast.error("Chyba při generování PDF");
    } finally {
      setIsDownloading(false);
    }
  }, [voucher, supplier, baggage, travelers]);

  const openSendDialog = (mode: "client" | "both" | "supplier") => {
    const mainTraveler = travelers.find(t => t.is_main_client);
    const name = mainTraveler
      ? `${mainTraveler.clients.first_name} ${mainTraveler.clients.last_name}`
      : voucher?.client_name || "klient";
    setSendMode(mode);
    setEmailSubject(`Cestovní voucher ${voucher?.voucher_code} - YARO Travel`);
    setEmailBody(
      mode === "supplier"
        ? `Dear valued partner,\n\nPlease find attached the travel voucher for your reference.\n\nBest regards,\nYARO Travel\nTel.: +420 602 102 108\nwww.yarotravel.cz`
        : `Vážený/á ${name},\n\nv příloze zasíláme Váš cestovní voucher.\n\nS pozdravem,\nYARO Travel - Váš specialista na dovolenou\nTel.: +420 602 102 108\nwww.yarotravel.cz\nzajezdy@yarotravel.cz`
    );
    setExtraEmails([]);
    setNewExtraEmail("");
    setSendDialogOpen(true);
  };

  const handleSend = async () => {
    if (!voucher) return;

    const mainTraveler = travelers.find(t => t.is_main_client);
    const clientEmail = mainTraveler?.clients.email;
    const supplierEmail = supplier?.email;

    const toEmails: string[] = [];
    if (sendMode === "client" || sendMode === "both") {
      if (!clientEmail) {
        toast.error("Klient nemá zadaný e-mail. Doplňte e-mail v kartě klienta.");
        return;
      }
      toEmails.push(clientEmail);
    }
    if (sendMode === "supplier" || sendMode === "both") {
      if (!supplierEmail) {
        toast.error("Dodavatel nemá zadaný e-mail.");
        return;
      }
      toEmails.push(supplierEmail);
    }
    toEmails.push(...extraEmails.filter(Boolean));

    if (toEmails.length === 0) {
      toast.error("Zadejte alespoň jednoho příjemce");
      return;
    }

    setSending(true);
    try {
      // Generate PDF
      const logoInfo = await getLogoBase64();
      const pdfBlob = buildVoucherPdfBlob(voucher, supplier?.name, supplier, logoInfo, travelers, baggage);
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
      const base64 = btoa(binary);

      // Upload PDF to storage for sending
      const { data: { user } } = await supabase.auth.getUser();
      let pdfPath: string | null = null;
      if (user) {
        const path = `${user.id}/${voucher.voucher_code}-${Date.now()}.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from("voucher-pdfs")
          .upload(path, pdfBlob, { contentType: "application/pdf", upsert: true });
        if (!uploadErr) pdfPath = path;
      }

      const sendToClient = sendMode === "client" || sendMode === "both";
      const sendToSupplier = sendMode === "supplier" || sendMode === "both";

      const { data, error } = await supabase.functions.invoke("send-voucher-email", {
        body: {
          voucherId: voucher.id,
          pdfPath,
          emailCcSupplier: sendToSupplier && !!supplierEmail,
          skipClient: !sendToClient,
          customEmailSubject: emailSubject,
          customEmailBody: emailBody,
          extraEmails: extraEmails.filter(Boolean),
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Chyba při odesílání");

      await supabase.from("vouchers").update({ sent_at: new Date().toISOString() }).eq("id", voucher.id);
      setVoucher(prev => prev ? { ...prev, sent_at: new Date().toISOString() } : prev);

      toast.success(`Voucher odeslán na: ${toEmails.join(", ")}`);
      setSendDialogOpen(false);
    } catch (err: any) {
      console.error("Send error:", err);
      toast.error(err.message || "Nepodařilo se odeslat voucher");
    } finally {
      setSending(false);
    }
  };

  const toolbarButtonClass = "h-8 text-xs bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";

  usePageToolbar(
    !loading && voucher ? (
      <>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadPdf}
          disabled={isDownloading}
          className={toolbarButtonClass}
        >
          {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          <span className="hidden sm:inline">PDF</span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={toolbarButtonClass}>
              <Mail className="h-4 w-4" />
              <span className="hidden sm:inline">Odeslat</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => openSendDialog("client")}>
              <User className="h-4 w-4 mr-2" />
              Odeslat klientovi
            </DropdownMenuItem>
            {supplier?.email && (
              <DropdownMenuItem onClick={() => openSendDialog("both")}>
                <Users className="h-4 w-4 mr-2" />
                Odeslat klientovi a dodavateli
              </DropdownMenuItem>
            )}
            {supplier?.email && (
              <DropdownMenuItem onClick={() => openSendDialog("supplier")}>
                <Building2 className="h-4 w-4 mr-2" />
                Odeslat pouze dodavateli
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => {
              setSendMode("client");
              setEmailSubject(`Cestovní voucher ${voucher?.voucher_code} - YARO Travel`);
              setEmailBody("");
              setExtraEmails([""]);
              setNewExtraEmail("");
              setSendDialogOpen(true);
            }}>
              <Mail className="h-4 w-4 mr-2" />
              Odeslat na jiný e-mail
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
    [id, loading, voucher, supplier, isDownloading, travelers]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Načítám voucher...</p>
      </div>
    );
  }

  if (!voucher) return null;

  const services: any[] = Array.isArray(voucher.services) ? voucher.services : [];
  const teeTimes: any[] = Array.isArray(voucher.tee_times) ? voucher.tee_times : [];
  const flights: any[] = Array.isArray(voucher.flights) ? voucher.flights : [];

  return (
    <PageShell>
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
            {voucher.sent_at ? (
              <Badge className="text-xs shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white border-transparent">Odesláno</Badge>
            ) : (
              <Badge className="text-xs shrink-0 bg-gray-500 hover:bg-gray-600 text-white border-transparent">Neodesláno</Badge>
            )}
            <span className="font-bold text-heading-1 text-foreground">{voucher.voucher_code}</span>
            {(() => {
              const mainT = travelers.find(t => t.is_main_client) || travelers[0];
              const clientName = mainT
                ? `${mainT.clients.first_name} ${mainT.clients.last_name}`
                : voucher.client_name;
              const countryIso = (voucher as any).deals?.destinations?.countries?.iso_code || null;
              const hotelName = voucher.hotel_name ||
                (() => {
                  const servs = Array.isArray(voucher.services) ? voucher.services : [];
                  const hotelSvc = servs.find((s: any) =>
                    s.service_type === "hotel" ||
                    s.type === "hotel" ||
                    (typeof (s.service_name || s.name) === "string" && (s.service_name || s.name || "").toLowerCase().includes("accommodation"))
                  );
                  if (!hotelSvc) return null;
                  const raw = hotelSvc.service_name || hotelSvc.name || "";
                  const match = raw.match(/accommodation in .+ in (.+)/i);
                  return match ? match[1].trim() : raw || null;
                })();
              const servicesArr = Array.isArray(voucher.services) ? voucher.services : [];
              const firstDate = servicesArr
                .map((s: any) => s.dateFrom || s.start_date)
                .filter(Boolean)
                .sort()[0];
              const formatD = (d: string) => {
                const dt = new Date(d + (d.includes("T") ? "" : "T00:00:00"));
                return `${String(dt.getDate()).padStart(2,"0")}-${String(dt.getMonth()+1).padStart(2,"0")}-${String(dt.getFullYear()).slice(-2)}`;
              };
              const parts = [clientName, countryIso, hotelName, firstDate ? formatD(firstDate) : null].filter(Boolean);
              return parts.length > 0 ? <span className="text-foreground">{parts.join(" • ")}</span> : null;
            })()}
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

      {/* Send Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Odeslat voucher {voucher.voucher_code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="mb-2 block">Příjemce</Label>
              <RadioGroup value={sendMode} onValueChange={(v) => setSendMode(v as any)} className="space-y-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="client" id="mode-client" />
                  <Label htmlFor="mode-client" className="cursor-pointer">
                    Klientovi
                    {travelers.find(t => t.is_main_client)?.clients.email && (
                      <span className="text-muted-foreground ml-1 text-xs">({travelers.find(t => t.is_main_client)?.clients.email})</span>
                    )}
                  </Label>
                </div>
                {supplier?.email && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="both" id="mode-both" />
                    <Label htmlFor="mode-both" className="cursor-pointer">Klientovi a dodavateli</Label>
                  </div>
                )}
                {supplier?.email && (
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="supplier" id="mode-supplier" />
                    <Label htmlFor="mode-supplier" className="cursor-pointer">
                      Pouze dodavateli
                      <span className="text-muted-foreground ml-1 text-xs">({supplier.email})</span>
                    </Label>
                  </div>
                )}
              </RadioGroup>
            </div>

            {/* Extra emails */}
            <div>
              <Label className="mb-2 block">Další příjemci</Label>
              <div className="space-y-2">
                {extraEmails.map((email, idx) => (
                  <div key={idx} className="flex gap-2">
                    <Input
                      value={email}
                      onChange={(e) => {
                        const updated = [...extraEmails];
                        updated[idx] = e.target.value;
                        setExtraEmails(updated);
                      }}
                      placeholder="email@priklad.cz"
                      className="flex-1"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setExtraEmails(extraEmails.filter((_, i) => i !== idx))}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setExtraEmails([...extraEmails, ""])}>
                  <Plus className="h-4 w-4 mr-1" /> Přidat e-mail
                </Button>
              </div>
            </div>

            <div>
              <Label htmlFor="email-subject" className="mb-1 block">Předmět</Label>
              <Input id="email-subject" value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="email-body" className="mb-1 block">Text e-mailu</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                rows={6}
              />
            </div>
            <p className="text-xs text-muted-foreground">Voucher bude přiložen jako PDF příloha.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>Zrušit</Button>
            <Button onClick={handleSend} disabled={sending}>
              {sending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Odesílám...</> : <><Mail className="h-4 w-4 mr-2" />Odeslat</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </PageShell>
  );
};

export default VoucherDetail;
