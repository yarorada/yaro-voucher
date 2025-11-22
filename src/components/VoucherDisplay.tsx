import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Mail, Settings, Monitor, FileText } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
import html2pdf from "html2pdf.js";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

// Airport lookup data
const airportCities: Record<string, string> = {
  "PRG": "Praha", "BRQ": "Brno", "OSR": "Ostrava", "PED": "Pardubice",
  "IST": "Istanbul", "SAW": "Istanbul", "AYT": "Antalya", "DLM": "Dalaman",
  "BJV": "Bodrum", "ESB": "Ankara", "ADB": "Izmir", "GZT": "Gaziantep",
  "ASR": "Kayseri", "TZX": "Trabzon", "LCA": "Larnaca", "PFO": "Paphos",
  "ECN": "Ercan", "ATH": "Athens", "HER": "Heraklion", "RHO": "Rhodes",
  "SKG": "Thessaloniki", "CFU": "Corfu", "CHQ": "Chania", "JMK": "Mykonos",
  "JTR": "Santorini", "KGS": "Kos", "ZTH": "Zakynthos", "DXB": "Dubai",
  "AUH": "Abu Dhabi", "DOH": "Doha", "BEY": "Beirut", "TLV": "Tel Aviv",
  "AMM": "Amman", "CAI": "Cairo", "SSH": "Sharm El Sheikh", "HRG": "Hurghada",
  "RMF": "Marsa Alam", "VIE": "Vienna", "MUC": "Munich", "FRA": "Frankfurt",
  "BER": "Berlin", "HAM": "Hamburg", "DUS": "Düsseldorf", "STR": "Stuttgart",
  "CGN": "Cologne", "ZRH": "Zurich", "GVA": "Geneva", "BUD": "Budapest",
  "WAW": "Warsaw", "KRK": "Krakow", "BTS": "Bratislava", "CDG": "Paris",
  "ORY": "Paris", "LHR": "London", "LGW": "London", "STN": "London",
  "LTN": "London", "MAN": "Manchester", "EDI": "Edinburgh", "AMS": "Amsterdam",
  "BRU": "Brussels", "LUX": "Luxembourg", "FCO": "Rome", "MXP": "Milan",
  "LIN": "Milan", "VCE": "Venice", "NAP": "Naples", "PSA": "Pisa",
  "BCN": "Barcelona", "MAD": "Madrid", "AGP": "Malaga", "PMI": "Palma de Mallorca",
  "VLC": "Valencia", "SVQ": "Seville", "LIS": "Lisbon", "OPO": "Porto",
  "FAO": "Faro", "CPH": "Copenhagen", "OSL": "Oslo", "ARN": "Stockholm",
  "HEL": "Helsinki", "SVO": "Moscow", "DME": "Moscow", "LED": "St. Petersburg",
  "KBP": "Kyiv", "OTP": "Bucharest", "SOF": "Sofia", "BEG": "Belgrade",
  "ZAG": "Zagreb", "DBV": "Dubrovnik", "SPU": "Split", "LJU": "Ljubljana",
  "TIA": "Tirana", "SKP": "Skopje", "PRN": "Pristina", "SJJ": "Sarajevo",
  "TGD": "Podgorica", "JFK": "New York", "EWR": "Newark", "LGA": "New York",
  "ORD": "Chicago", "LAX": "Los Angeles", "MIA": "Miami", "SFO": "San Francisco",
  "YYZ": "Toronto", "YUL": "Montreal", "YVR": "Vancouver", "HKG": "Hong Kong",
  "SIN": "Singapore", "BKK": "Bangkok", "NRT": "Tokyo", "HND": "Tokyo",
  "ICN": "Seoul", "PEK": "Beijing", "PVG": "Shanghai", "DEL": "New Delhi",
  "BOM": "Mumbai", "JNB": "Johannesburg", "CPT": "Cape Town", "ADD": "Addis Ababa",
  "NBO": "Nairobi", "CMN": "Casablanca", "TUN": "Tunis", "GRU": "São Paulo",
  "GIG": "Rio de Janeiro", "EZE": "Buenos Aires", "BOG": "Bogotá", "LIM": "Lima",
  "SYD": "Sydney", "MEL": "Melbourne", "BNE": "Brisbane", "AKL": "Auckland"
};

const getCityName = (iataCode: string): string => {
  return airportCities[iataCode] || iataCode;
};

interface Service {
  name: string;
  pax: string;
  qty: string;
  dateFrom: string;
  dateTo: string;
}

interface TeeTime {
  date: string;
  club: string;
  time: string;
  golfers: string;
}

interface Flight {
  date: string;
  airlineCode: string;
  airlineName: string;
  flightNumber: string;
  fromIata: string;
  fromCity?: string;
  toIata: string;
  toCity?: string;
  departureTime: string;
  arrivalTime: string;
  isVariant?: boolean;
  pax: string;
}

interface VoucherDisplayProps {
  voucherCode: string;
  clientName: string;
  otherTravelers?: string[];
  services: Service[];
  hotelName?: string;
  teeTimes?: TeeTime[];
  flights?: Flight[];
  issueDate: string;
  expirationDate?: string;
  supplierName?: string;
  supplierContact?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierAddress?: string | null;
  supplierNotes?: string | null;
  voucherId?: string;
}

export const VoucherDisplay = ({
  voucherCode,
  clientName,
  otherTravelers,
  services,
  hotelName,
  teeTimes,
  flights,
  issueDate,
  expirationDate,
  supplierName,
  supplierContact,
  supplierEmail,
  supplierPhone,
  supplierAddress,
  supplierNotes,
  voucherId,
}: VoucherDisplayProps) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [autoScale, setAutoScale] = useState(true);
  const [manualFontSize, setManualFontSize] = useState(14); // Base font size in px
  const [manualSpacing, setManualSpacing] = useState(12); // Spacing/padding in px
  const [previewMode, setPreviewMode] = useState<'web' | 'pdf'>('web');
  
  // Calculate optimal scaling based on content
  const calculateAutoScale = () => {
    let contentScore = 0;
    
    // Count content items
    contentScore += services.length * 3; // Services are most dense
    contentScore += (flights?.length || 0) * 2;
    contentScore += (teeTimes?.length || 0) * 2;
    contentScore += (otherTravelers?.length || 0) * 0.5;
    contentScore += hotelName ? 1 : 0;
    contentScore += supplierNotes ? 2 : 0;
    
    // More aggressive scaling for PDF fit
    if (contentScore <= 12) {
      return { fontSize: 13, spacing: 10 };
    } else if (contentScore <= 20) {
      return { fontSize: 11.5, spacing: 8 };
    } else if (contentScore <= 30) {
      return { fontSize: 10.5, spacing: 7 };
    } else if (contentScore <= 40) {
      return { fontSize: 9.5, spacing: 6 };
    } else {
      return { fontSize: 9, spacing: 5.5 };
    }
  };
  
  const autoScaleValues = calculateAutoScale();
  const fontSize = autoScale ? autoScaleValues.fontSize : manualFontSize;
  const spacing = autoScale ? autoScaleValues.spacing : manualSpacing;
  
  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const element = document.getElementById('voucher-content');
      if (!element) {
        toast.error('Chyba: Voucher nebyl nalezen');
        return;
      }

      const opt = {
        margin: [15, 8, 8, 8] as [number, number, number, number], // top: 1.5cm, others: 0.8cm
        filename: `voucher-${voucherCode}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { 
          scale: 1.3,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          letterRendering: true,
          windowHeight: 2000,
          onclone: (clonedDoc: Document) => {
            const clonedElement = clonedDoc.getElementById('voucher-content');
            if (clonedElement) {
              // Force light theme colors for PDF export
              clonedElement.style.backgroundColor = '#ffffff';
              clonedElement.style.color = '#000000';
              
              // Apply light theme to all child elements
              const bgMuted = clonedElement.querySelectorAll('.bg-muted');
              bgMuted.forEach((el) => {
                (el as HTMLElement).style.backgroundColor = '#f5f5f5';
              });
              
              const textForeground = clonedElement.querySelectorAll('.text-foreground');
              textForeground.forEach((el) => {
                (el as HTMLElement).style.color = '#000000';
              });
              
              const textMuted = clonedElement.querySelectorAll('.text-muted-foreground');
              textMuted.forEach((el) => {
                (el as HTMLElement).style.color = '#666666';
              });
              
              const textPrimary = clonedElement.querySelectorAll('.text-primary');
              textPrimary.forEach((el) => {
                (el as HTMLElement).style.color = '#0066cc';
              });
              
              const borderPrimary = clonedElement.querySelectorAll('.border-primary');
              borderPrimary.forEach((el) => {
                (el as HTMLElement).style.borderColor = '#0066cc';
              });
              
              const borderAccent = clonedElement.querySelectorAll('.border-accent');
              borderAccent.forEach((el) => {
                (el as HTMLElement).style.borderColor = '#00aaff';
              });
              
              // Compact single-page layout
              clonedElement.style.minHeight = 'auto';
              clonedElement.style.height = 'auto';
              clonedElement.style.display = 'block';
              clonedElement.style.padding = `${spacingRem * 0.6}rem`;
              clonedElement.style.maxHeight = 'none';
              
              // Reduce all spacing
              const allDivs = clonedElement.querySelectorAll('div');
              allDivs.forEach((div) => {
                const el = div as HTMLElement;
                const currentPadding = window.getComputedStyle(el).paddingBottom;
                if (currentPadding && parseFloat(currentPadding) > 0) {
                  el.style.paddingBottom = `${parseFloat(currentPadding) * 0.6}px`;
                  el.style.marginBottom = `${parseFloat(currentPadding) * 0.6}px`;
                }
              });
            }
          }
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
        pagebreak: { mode: 'avoid-all' }
      };

      await html2pdf().set(opt).from(element).save();
      toast.success('PDF úspěšně stažen');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Chyba při generování PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSendEmail = async () => {
    if (!voucherId) {
      toast.error("Chyba: ID voucheru nebylo nalezeno");
      return;
    }

    setIsSendingEmail(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('send-voucher-email', {
        body: { voucherId }
      });

      if (error) throw error;

      if (data?.success) {
        toast.success(`Email úspěšně odeslán na: ${data.recipients.join(', ')}`);
      } else {
        throw new Error(data?.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      toast.error(`Chyba při odesílání emailu: ${error.message}`);
    } finally {
      setIsSendingEmail(false);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  const formatServiceDate = (dateString: string) => {
    if (!dateString) return "TBD";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  };

  const baseFontRem = fontSize / 16; // Convert px to rem
  const spacingRem = spacing / 16;

  return (
    <div className="space-y-4">
      <style>
        {`
          @media print {
            @page {
              margin-top: 1cm;
            }
          }
          
          #voucher-content {
            font-size: ${baseFontRem}rem;
            padding: ${spacingRem}rem !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* PDF Preview Mode - Force Light Theme */
          #voucher-content.pdf-preview-mode {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          
          #voucher-content.pdf-preview-mode .bg-muted {
            background-color: #f5f5f5 !important;
          }
          
          #voucher-content.pdf-preview-mode .bg-card {
            background-color: #ffffff !important;
          }
          
          #voucher-content.pdf-preview-mode .text-foreground {
            color: #000000 !important;
          }
          
          #voucher-content.pdf-preview-mode .text-muted-foreground {
            color: #666666 !important;
          }
          
          #voucher-content.pdf-preview-mode .text-primary {
            color: #0066cc !important;
          }
          
          #voucher-content.pdf-preview-mode .border-primary {
            border-color: #0066cc !important;
          }
          
          #voucher-content.pdf-preview-mode .border-accent {
            border-color: #00aaff !important;
          }

          #voucher-content .bg-muted {
            background-color: hsl(var(--muted)) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          #voucher-content .border-accent {
            border-color: hsl(var(--accent)) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          #voucher-content .border-primary {
            border-color: hsl(var(--primary)) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          #voucher-content .text-primary {
            color: hsl(var(--primary)) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          #voucher-content .text-foreground {
            color: hsl(var(--foreground)) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          #voucher-content .text-muted-foreground {
            color: hsl(var(--muted-foreground)) !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          #voucher-content .bg-gradient-to-r {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          
          #voucher-content h1,
          #voucher-content h2,
          #voucher-content h3 {
            font-size: 0.9em;
            margin-bottom: ${spacingRem * 0.5}rem !important;
            padding-left: ${spacingRem * 0.5}rem !important;
          }
          
          #voucher-content .text-3xl {
            font-size: ${baseFontRem * 1.71}rem !important;
          }
          
          #voucher-content .text-2xl {
            font-size: ${baseFontRem * 1.43}rem !important;
          }
          
          #voucher-content .text-lg {
            font-size: ${baseFontRem * 1.07}rem !important;
          }
          
          #voucher-content .text-sm {
            font-size: ${baseFontRem * 0.86}rem !important;
          }
          
          #voucher-content .text-xs {
            font-size: ${baseFontRem * 0.71}rem !important;
          }
          
          #voucher-content {
            min-height: auto !important;
            display: block !important;
            padding-top: ${spacingRem}rem !important;
            padding-bottom: ${spacingRem}rem !important;
          }
          
          #voucher-content > div {
            padding-bottom: ${spacingRem * 0.5}rem !important;
            margin-bottom: ${spacingRem * 0.5}rem !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          
          #voucher-content p,
          #voucher-content div {
            line-height: 1.4 !important;
          }
          
          #voucher-content .bg-muted,
          #voucher-content .bg-gradient-to-r {
            padding: ${spacingRem * 0.5}rem !important;
          }
          
          #voucher-content table th,
          #voucher-content table td {
            padding: ${spacingRem * 0.25}rem !important;
          }
          
          #voucher-content img {
            height: ${spacingRem * 5}rem !important;
            margin-bottom: ${spacingRem * 0.25}rem !important;
          }
          
          #voucher-content .grid {
            gap: ${spacingRem * 0.5}rem !important;
          }
          
          #voucher-content ul {
            margin: ${spacingRem * 0.25}rem 0 !important;
          }
          
          #voucher-content ul li {
            margin-bottom: ${spacingRem * 0.25}rem !important;
          }
        `}
      </style>
      <div className="flex gap-2 print:hidden">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="icon">
              <Settings className="h-5 w-5" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nastavení PDF</DialogTitle>
              <DialogDescription>
                Upravte velikost fontu a mezer před exportem PDF
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Automatické škálování</Label>
                  <p className="text-sm text-muted-foreground">
                    Přizpůsobit velikost podle množství obsahu
                  </p>
                </div>
                <Switch
                  checked={autoScale}
                  onCheckedChange={setAutoScale}
                />
              </div>
              {!autoScale && (
                <>
                  <div className="space-y-2">
                    <Label>Velikost fontu: {manualFontSize}px</Label>
                    <Slider
                      value={[manualFontSize]}
                      onValueChange={([value]) => setManualFontSize(value)}
                      min={10}
                      max={20}
                      step={1}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Mezery a padding: {manualSpacing}px</Label>
                    <Slider
                      value={[manualSpacing]}
                      onValueChange={([value]) => setManualSpacing(value)}
                      min={6}
                      max={20}
                      step={1}
                    />
                  </div>
                </>
              )}
              {autoScale && (
                <div className="bg-muted p-3 rounded-md">
                  <p className="text-sm text-muted-foreground">
                    Aktuální automatické nastavení:
                  </p>
                  <p className="text-sm font-medium mt-1">
                    Font: {fontSize}px, Mezery: {spacing}px
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        <div className="flex items-center rounded-md border border-border bg-background p-1">
          <Button
            variant={previewMode === 'web' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setPreviewMode('web')}
            className="gap-1.5 h-8"
          >
            <Monitor className="h-3.5 w-3.5" />
            <span className="text-xs">Web</span>
          </Button>
          <Button
            variant={previewMode === 'pdf' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setPreviewMode('pdf')}
            className="gap-1.5 h-8"
          >
            <FileText className="h-3.5 w-3.5" />
            <span className="text-xs">PDF</span>
          </Button>
        </div>
        <Button 
          onClick={handleDownloadPDF} 
          className="flex-1" 
          size="icon"
          disabled={isGeneratingPdf}
        >
          <Download className="h-5 w-5" />
        </Button>
        <Button 
          variant="outline" 
          className="flex-1" 
          size="icon"
          onClick={handleSendEmail}
          disabled={isSendingEmail || !voucherId}
        >
          <Mail className="h-5 w-5" />
        </Button>
      </div>

      <Card
        id="voucher-content" 
        className={`p-8 shadow-[var(--shadow-strong)] bg-card print:shadow-none print:p-3.5 print:text-sm ${previewMode === 'pdf' ? 'pdf-preview-mode' : ''}`}
      >
        {/* Header */}
        <div className="border-b-4 border-primary pb-6 mb-6 print:pb-3 print:mb-3">
          <div className="flex justify-between items-start mb-6 print:mb-3">
            <div>
              <img src={yaroLogo} alt="YARO Travel" className="h-32 mb-2 print:h-20 print:mb-1" />
              <p className="text-sm text-muted-foreground print:text-xs">Your Journey, Our Passion</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary print:text-2xl">{voucherCode}</div>
              <p className="text-sm text-muted-foreground mt-1 print:text-xs print:mt-0">Travel Voucher</p>
            </div>
          </div>
          
          {/* Service Provider Contact */}
          {supplierName && (
            <div className="mb-6 print:mb-3">
              <h2 className="text-lg font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-[13px] print:mb-2 print:pl-2">
                Service Provider
              </h2>
              <div className="bg-muted p-4 rounded-lg print:p-2 print:text-[11px]">
                <div className="space-y-1">
                  <p className="text-muted-foreground">
                    {supplierName}
                    {supplierAddress && ` • ${supplierAddress}`}
                    {supplierEmail && ` • ${supplierEmail}`}
                  </p>
                  {supplierNotes && (
                    <p className="pt-1 border-t border-border/50 text-muted-foreground print:pt-0 print:border-t-0 print:mt-0.5">{supplierNotes}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Client Information */}
        <div className="mb-6 print:mb-3">
          <h2 className="text-lg font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-[13px] print:mb-2 print:pl-2">
            Client Information
          </h2>
          <div className="bg-muted p-4 rounded-lg print:p-2 print:text-[11px]">
            <div className="mb-2 print:mb-1">
              <span className="font-semibold text-foreground">Main Client:</span>{" "}
              <span className="text-muted-foreground">{clientName}</span>
            </div>
            {otherTravelers && otherTravelers.length > 0 && (
              <div>
                <span className="font-semibold text-foreground">Other Travelers:</span>{" "}
                <span className="text-muted-foreground">{otherTravelers.join(", ")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Hotel Accommodation */}
        {hotelName && (
          <div className="mb-6 print:mb-3">
            <h2 className="text-lg font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-[13px] print:mb-2 print:pl-2">
              Hotel Accommodation
            </h2>
            <div className="bg-muted p-4 rounded-lg print:p-2 print:text-[11px]">
              <div>
                <span className="font-semibold text-foreground">Hotel:</span>{" "}
                <span className="text-muted-foreground">{hotelName}</span>
              </div>
            </div>
          </div>
        )}

        {/* Services Table */}
        <div className="mb-6 print:mb-3">
          <h2 className="text-lg font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-[13px] print:mb-2 print:pl-2">
            Service Overview
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse print:text-[11px]">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="p-3 text-left print:p-0.5">PAX</th>
                  <th className="p-3 text-left print:p-0.5">Qtd.</th>
                  <th className="p-3 text-left print:p-0.5">Service</th>
                  <th className="p-3 text-left print:p-0.5">Date From</th>
                  <th className="p-3 text-left print:p-0.5">Date To</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <tr 
                    key={index} 
                    className={index % 2 === 0 ? "bg-muted" : "bg-card"}
                  >
                    <td className="p-3 text-muted-foreground print:p-0.5">
                      {service.pax || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground print:p-0.5">
                      {service.qty || "—"}
                    </td>
                    <td className="p-3 font-medium text-foreground print:p-0.5">{service.name}</td>
                    <td className="p-3 text-muted-foreground print:p-0.5">
                      {formatServiceDate(service.dateFrom)}
                    </td>
                    <td className="p-3 text-muted-foreground print:p-0.5">
                      {formatServiceDate(service.dateTo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Flight Details Section */}
        {flights && flights.length > 0 && (
          <div className="mb-6 print:mb-3">
            <h2 className="text-lg font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-[13px] print:mb-2 print:pl-2">
              Flight Details
            </h2>
            <div className="bg-muted p-4 rounded-lg print:p-2 print:text-[11px]">
              <ul className="space-y-3 print:space-y-0.5">
                {flights.map((flight, index) => {
                  const fromCity = flight.fromCity || getCityName(flight.fromIata);
                  const toCity = flight.toCity || getCityName(flight.toIata);
                  const mainFlights = flights.filter(f => !f.isVariant);
                  const flightNumber = flight.isVariant ? 
                    mainFlights.length + 1 : 
                    mainFlights.filter((f, i) => i < flights.indexOf(flight)).length + 1;
                  const flightLabel = flightNumber === 1 ? "Let TAM" : flightNumber === 2 ? "Let ZPĚT" : `Let ${flightNumber}`;
                  
                  const showSeparator = flight.isVariant && index > 0 && !flights[index - 1].isVariant;
                  
                  return (
                    <li key={index}>
                      {showSeparator && (
                        <div className="border-t-2 border-primary my-3 print:my-2" />
                      )}
                      <div>
                        <div className="text-muted-foreground">
                          <span className="font-semibold text-foreground">{formatDate(flight.date)}</span> • 
                          <span className="font-semibold text-foreground">{flight.airlineCode}{flight.flightNumber}</span> {flight.airlineName} • 
                          {fromCity} → {toCity} • 
                          Departure: <span className="font-semibold text-foreground">{flight.departureTime}</span> • 
                          Arrival: <span className="font-semibold text-foreground">{flight.arrivalTime}</span> • 
                          PAX: <span className="font-semibold text-foreground">{flight.pax}</span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        {/* Tee Time Section */}
        {teeTimes && teeTimes.length > 0 && (
          <div className="mb-6 print:mb-3">
            <h2 className="text-lg font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-[13px] print:mb-2 print:pl-2">
              Confirmed Tee Times
            </h2>
            <div className="bg-muted p-4 rounded-lg print:p-2 print:text-[11px]">
              <ul className="space-y-2 print:space-y-0">
                {teeTimes.map((teeTime, index) => (
                  <li key={index} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDate(teeTime.date)}</span> {teeTime.club} at <span className="font-semibold text-foreground">{teeTime.time}</span> ({teeTime.golfers} golfers)
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Voucher Details */}
        <div className="mb-6 grid grid-cols-2 gap-4 print:mb-3 print:gap-2">
          <div className="bg-muted p-4 rounded-lg print:p-2 print:text-[11px]">
            <p className="text-sm text-muted-foreground mb-1 print:text-[11px] print:mb-0">Issue Date</p>
            <p className="font-semibold text-foreground">{formatDate(issueDate)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg print:p-2 print:text-[11px]">
            <p className="text-sm text-muted-foreground mb-1 print:text-[11px] print:mb-0">Expiration Date</p>
            <p className="font-semibold text-foreground">
              {expirationDate ? formatDate(expirationDate) : "No Expiration"}
            </p>
          </div>
        </div>

        {/* Company Information Footer */}
        <div className="border-t-2 border-border pt-6 print:pt-3">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg print:p-3 print:bg-muted/30">
            {/* Web version - 3 columns */}
            <div className="print:hidden">
              <h3 className="font-bold text-foreground mb-2">YARO Travel</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <p className="font-semibold text-foreground">Address:</p>
                  <p>Bratrancu Veverkovych 680</p>
                  <p>Pardubice, 530 02</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Contact:</p>
                  <p>Tel.: +420 602 102 108</p>
                  <p>Email: zajezdy@yarotravel.cz</p>
                </div>
                <div>
                  <p className="font-semibold text-foreground">Website:</p>
                  <p>www.yarotravel.cz</p>
                  <p className="mt-2 text-[10px]">Available 24/7 for your travel needs</p>
                </div>
              </div>
            </div>
            {/* Print version - compact */}
            <div className="hidden print:block">
              <h3 className="font-bold text-foreground mb-1.5">YARO Travel</h3>
              <div className="text-[8px] text-muted-foreground">
                <p>Bratrancu Veverkovych 680, Pardubice, 530 02 | Tel.: +420 602 102 108 | Email: zajezdy@yarotravel.cz | www.yarotravel.cz</p>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="mt-6 text-xs text-muted-foreground print:mt-2 print:text-[11px]">
          <p className="font-semibold text-foreground mb-1">Terms & Conditions:</p>
          <p>
            This voucher is valid for the services listed above. Please present this voucher
            to service providers. Changes or cancellations must be made 48 hours in advance.
            For assistance, contact YARO Travel support.
          </p>
        </div>
      </Card>
    </div>
  );
};
