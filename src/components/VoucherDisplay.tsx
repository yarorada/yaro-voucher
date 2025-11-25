import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Mail, Settings } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import html2pdf from "html2pdf.js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

// Airport lookup data
const airportCities: Record<string, string> = {
  "PRG": "Praha",
  "BRQ": "Brno",
  "OSR": "Ostrava",
  "PED": "Pardubice",
  "IST": "Istanbul",
  "SAW": "Istanbul",
  "AYT": "Antalya",
  "DLM": "Dalaman",
  "BJV": "Bodrum",
  "ESB": "Ankara",
  "ADB": "Izmir",
  "GZT": "Gaziantep",
  "ASR": "Kayseri",
  "TZX": "Trabzon",
  "LCA": "Larnaca",
  "PFO": "Paphos",
  "ECN": "Ercan",
  "ATH": "Athens",
  "HER": "Heraklion",
  "RHO": "Rhodes",
  "SKG": "Thessaloniki",
  "CFU": "Corfu",
  "CHQ": "Chania",
  "JMK": "Mykonos",
  "JTR": "Santorini",
  "KGS": "Kos",
  "ZTH": "Zakynthos",
  "DXB": "Dubai",
  "AUH": "Abu Dhabi",
  "DOH": "Doha",
  "BEY": "Beirut",
  "TLV": "Tel Aviv",
  "AMM": "Amman",
  "CAI": "Cairo",
  "SSH": "Sharm El Sheikh",
  "HRG": "Hurghada",
  "RMF": "Marsa Alam",
  "VIE": "Vienna",
  "MUC": "Munich",
  "FRA": "Frankfurt",
  "BER": "Berlin",
  "HAM": "Hamburg",
  "DUS": "Düsseldorf",
  "STR": "Stuttgart",
  "CGN": "Cologne",
  "ZRH": "Zurich",
  "GVA": "Geneva",
  "BUD": "Budapest",
  "WAW": "Warsaw",
  "KRK": "Krakow",
  "BTS": "Bratislava",
  "CDG": "Paris",
  "ORY": "Paris",
  "LHR": "London",
  "LGW": "London",
  "STN": "London",
  "LTN": "London",
  "MAN": "Manchester",
  "EDI": "Edinburgh",
  "AMS": "Amsterdam",
  "BRU": "Brussels",
  "LUX": "Luxembourg",
  "FCO": "Rome",
  "MXP": "Milan",
  "LIN": "Milan",
  "VCE": "Venice",
  "NAP": "Naples",
  "PSA": "Pisa",
  "BCN": "Barcelona",
  "MAD": "Madrid",
  "AGP": "Malaga",
  "PMI": "Palma de Mallorca",
  "VLC": "Valencia",
  "SVQ": "Seville",
  "LIS": "Lisbon",
  "OPO": "Porto",
  "FAO": "Faro",
  "CPH": "Copenhagen",
  "OSL": "Oslo",
  "ARN": "Stockholm",
  "HEL": "Helsinki",
  "SVO": "Moscow",
  "DME": "Moscow",
  "LED": "St. Petersburg",
  "KBP": "Kyiv",
  "OTP": "Bucharest",
  "SOF": "Sofia",
  "BEG": "Belgrade",
  "ZAG": "Zagreb",
  "DBV": "Dubrovnik",
  "SPU": "Split",
  "LJU": "Ljubljana",
  "TIA": "Tirana",
  "SKP": "Skopje",
  "PRN": "Pristina",
  "SJJ": "Sarajevo",
  "TGD": "Podgorica",
  "JFK": "New York",
  "EWR": "Newark",
  "LGA": "New York",
  "ORD": "Chicago",
  "LAX": "Los Angeles",
  "MIA": "Miami",
  "SFO": "San Francisco",
  "YYZ": "Toronto",
  "YUL": "Montreal",
  "YVR": "Vancouver",
  "HKG": "Hong Kong",
  "SIN": "Singapore",
  "BKK": "Bangkok",
  "NRT": "Tokyo",
  "HND": "Tokyo",
  "ICN": "Seoul",
  "PEK": "Beijing",
  "PVG": "Shanghai",
  "DEL": "New Delhi",
  "BOM": "Mumbai",
  "JNB": "Johannesburg",
  "CPT": "Cape Town",
  "ADD": "Addis Ababa",
  "NBO": "Nairobi",
  "CMN": "Casablanca",
  "TUN": "Tunis",
  "GRU": "São Paulo",
  "GIG": "Rio de Janeiro",
  "EZE": "Buenos Aires",
  "BOG": "Bogotá",
  "LIM": "Lima",
  "SYD": "Sydney",
  "MEL": "Melbourne",
  "BNE": "Brisbane",
  "AKL": "Auckland"
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
  voucherId
}: VoucherDisplayProps) => {
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [fontSize, setFontSize] = useState(() => {
    const saved = localStorage.getItem('voucherPdfFontSize');
    return saved ? parseFloat(saved) : 10;
  });
  const [logoSize, setLogoSize] = useState(() => {
    const saved = localStorage.getItem('voucherPdfLogoSize');
    return saved ? parseFloat(saved) : 60;
  });
  const [lineHeight, setLineHeight] = useState(() => {
    const saved = localStorage.getItem('voucherPdfLineHeight');
    return saved ? parseFloat(saved) : 1.1;
  });
  const [headingSize, setHeadingSize] = useState(() => {
    const saved = localStorage.getItem('voucherPdfHeadingSize');
    return saved ? parseFloat(saved) : 17;
  });
  const [sectionSpacing, setSectionSpacing] = useState(() => {
    const saved = localStorage.getItem('voucherPdfSectionSpacing');
    return saved ? parseFloat(saved) : 4;
  });
  const [contentPadding, setContentPadding] = useState(() => {
    const saved = localStorage.getItem('voucherPdfContentPadding');
    return saved ? parseFloat(saved) : 6;
  });

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('voucherPdfFontSize', fontSize.toString());
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('voucherPdfLogoSize', logoSize.toString());
  }, [logoSize]);

  useEffect(() => {
    localStorage.setItem('voucherPdfLineHeight', lineHeight.toString());
  }, [lineHeight]);

  useEffect(() => {
    localStorage.setItem('voucherPdfHeadingSize', headingSize.toString());
  }, [headingSize]);

  useEffect(() => {
    localStorage.setItem('voucherPdfSectionSpacing', sectionSpacing.toString());
  }, [sectionSpacing]);

  useEffect(() => {
    localStorage.setItem('voucherPdfContentPadding', contentPadding.toString());
  }, [contentPadding]);

  const handleDownloadPDF = async () => {
    setIsGeneratingPdf(true);
    try {
      const element = document.getElementById('voucher-content');
      if (!element) {
        toast.error('Chyba: Voucher nebyl nalezen');
        return;
      }
      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: `voucher-${voucherCode}.pdf`,
        image: {
          type: 'jpeg' as const,
          quality: 0.98
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          allowTaint: true,
          letterRendering: true,
          onclone: (clonedDoc: Document) => {
            const clonedElement = clonedDoc.getElementById('voucher-content');
            if (clonedElement) {
              // Force light theme colors for PDF export
              clonedElement.style.backgroundColor = '#ffffff';
              clonedElement.style.color = '#000000';

              // Apply light theme to all child elements
              const bgMuted = clonedElement.querySelectorAll('.bg-muted');
              bgMuted.forEach(el => {
                (el as HTMLElement).style.backgroundColor = '#f5f5f5';
              });
              const textForeground = clonedElement.querySelectorAll('.text-foreground');
              textForeground.forEach(el => {
                (el as HTMLElement).style.color = '#000000';
              });
              const textMuted = clonedElement.querySelectorAll('.text-muted-foreground');
              textMuted.forEach(el => {
                (el as HTMLElement).style.color = '#666666';
              });
              const textPrimary = clonedElement.querySelectorAll('.text-primary');
              textPrimary.forEach(el => {
                (el as HTMLElement).style.color = '#0066cc';
              });
              const borderPrimary = clonedElement.querySelectorAll('.border-primary');
              borderPrimary.forEach(el => {
                (el as HTMLElement).style.borderColor = '#0066cc';
              });
              const borderAccent = clonedElement.querySelectorAll('.border-accent');
              borderAccent.forEach(el => {
                (el as HTMLElement).style.borderColor = '#00aaff';
              });
            }
          }
        },
        jsPDF: {
          unit: 'mm' as const,
          format: 'a4' as const,
          orientation: 'portrait' as const
        },
        pagebreak: {
          mode: ['avoid-all', 'css', 'legacy']
        }
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
      const {
        data,
        error
      } = await supabase.functions.invoke('send-voucher-email', {
        body: {
          voucherId
        }
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
  const headingSizeRem = headingSize / 16;
  return <div className="space-y-4">
      <style>
        {`
          @media print {
            @page {
              margin-top: 1cm;
            }
          }
          
          #voucher-content {
            font-size: ${baseFontRem}rem;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Vertically center text in table rows for PDF */
          #voucher-content table th,
          #voucher-content table td {
            vertical-align: middle !important;
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
            font-size: ${headingSizeRem}rem !important;
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
          
          #voucher-content p,
          #voucher-content div {
            line-height: ${lineHeight} !important;
          }

          #voucher-content img {
            height: ${logoSize}px !important;
          }

          #voucher-content .section-spacing {
            margin-bottom: ${sectionSpacing}px !important;
          }

          #voucher-content .content-padding {
            padding: ${contentPadding}px !important;
          }

          #voucher-content .section-heading::before {
            content: '●';
            color: hsl(var(--accent));
            font-size: ${baseFontRem * 1.2}rem;
            margin-right: 0.5rem;
            vertical-align: middle;
          }

          @media print {
            #voucher-content .section-heading::before {
              font-size: ${baseFontRem * 1.1}rem;
            }
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
              <div className="space-y-2">
                <Label>Velikost fontu: {fontSize}px</Label>
                <Slider value={[fontSize]} onValueChange={([value]) => setFontSize(value)} min={10} max={20} step={1} />
              </div>
              <div className="space-y-2">
                <Label>Velikost nadpisů: {headingSize}px</Label>
                <Slider value={[headingSize]} onValueChange={([value]) => setHeadingSize(value)} min={12} max={24} step={1} />
              </div>
              <div className="space-y-2">
                <Label>Velikost loga: {logoSize}px</Label>
                <Slider value={[logoSize]} onValueChange={([value]) => setLogoSize(value)} min={40} max={200} step={4} />
              </div>
              <div className="space-y-2">
                <Label>Výška řádků: {lineHeight.toFixed(1)}</Label>
                <Slider value={[lineHeight]} onValueChange={([value]) => setLineHeight(value)} min={1.0} max={2.5} step={0.1} />
              </div>
              <div className="space-y-2">
                <Label>Mezery mezi sekcemi: {sectionSpacing}px</Label>
                <Slider value={[sectionSpacing]} onValueChange={([value]) => setSectionSpacing(value)} min={4} max={32} step={2} />
              </div>
              <div className="space-y-2">
                <Label>Padding obsahu: {contentPadding}px</Label>
                <Slider value={[contentPadding]} onValueChange={([value]) => setContentPadding(value)} min={4} max={24} step={2} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <Button onClick={handleDownloadPDF} className="flex-1" size="icon" disabled={isGeneratingPdf}>
          <Download className="h-5 w-5" />
        </Button>
        <Button variant="outline" className="flex-1" size="icon" onClick={handleSendEmail} disabled={isSendingEmail || !voucherId}>
          <Mail className="h-5 w-5" />
        </Button>
      </div>

      <Card id="voucher-content" className="p-8 shadow-[var(--shadow-strong)] bg-card print:shadow-none print:p-3.5 print:text-sm">
        {/* Header */}
        <div className="border-b-4 border-primary pb-4 mb-0 print:pb-2 print:mb-0">
          <div className="flex justify-between items-start mb-4 print:mb-2">
            <div>
              <img 
                src={yaroLogo} 
                alt="YARO Travel" 
                style={{ height: `${logoSize}px` }}
                className="mb-2 print:mb-1" 
              />
              <p className="text-sm text-muted-foreground print:text-xs">Your Journey, Our Passion</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary print:text-2xl">{voucherCode}</div>
              <p className="text-sm text-muted-foreground mt-1 print:text-xs print:mt-0">Travel Voucher</p>
            </div>
          </div>
          {/* Service Provider Contact */}
          {supplierName && <div className="section-spacing">
              <h2 className="section-heading text-lg font-bold text-foreground mb-1.5 print:text-[13px] print:mb-0.5">
                Service Provider
              </h2>
              <div className="bg-muted content-padding rounded-lg print:p-1 print:text-[11px]">
                <div className="space-y-0 print:space-y-0">
                  <p className="text-muted-foreground">
                    {supplierName}
                    {supplierAddress && ` • ${supplierAddress}`}
                    {supplierEmail && ` • ${supplierEmail}`}
                  </p>
                   {supplierNotes && <p className="pt-1 border-t border-border/50 text-muted-foreground print:pt-0 print:border-t-0 print:mt-0.5">{supplierNotes}</p>}
                </div>
              </div>
            </div>}
        </div>

        {/* Client Information */}
        <div className="section-spacing">
          <h2 className="section-heading text-lg font-bold text-foreground mb-1.5 print:text-[13px] print:mb-0.5">
            Client Information
          </h2>
          <div className="bg-muted content-padding rounded-lg print:p-1 print:text-[11px]">
            <div className="mb-1 print:mb-0">
              <span className="font-semibold text-foreground">Main Client:</span>{" "}
              <span className="text-muted-foreground">{clientName}</span>
            </div>
            {otherTravelers && otherTravelers.length > 0 && <div className="mt-1 print:mt-0.5">
                <span className="font-semibold text-foreground">Other Travelers:</span>{" "}
                <span className="text-muted-foreground">{otherTravelers.join(", ")}</span>
              </div>}
          </div>
        </div>

        {/* Hotel Accommodation */}
        {hotelName && <div className="section-spacing">
            <h2 className="section-heading text-lg font-bold text-foreground mb-1.5 print:text-[13px] print:mb-0.5">
              Hotel Accommodation
            </h2>
            <div className="bg-muted content-padding rounded-lg print:p-1 print:text-[11px]">
              <div>
                <span className="font-semibold text-foreground">Hotel:</span>{" "}
                <span className="text-muted-foreground">{hotelName}</span>
              </div>
            </div>
          </div>}

        {/* Services Table */}
        <div className="section-spacing">
          <h2 className="section-heading text-lg font-bold text-foreground mb-1.5 print:text-[13px] print:mb-0.5">
            Service Overview
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse print:text-[11px]">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="p-2 text-left print:p-0.5">PAX</th>
                  <th className="p-2 text-left print:p-0.5">Qtd.</th>
                  <th className="p-2 text-left print:p-0.5">Service</th>
                  <th className="p-2 text-left print:p-0.5">Date From</th>
                  <th className="p-2 text-left print:p-0.5">Date To</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => <tr key={index} className={index % 2 === 0 ? "bg-muted" : "bg-card"}>
                    <td className="p-2 text-muted-foreground print:p-0.5">
                      {service.pax || "—"}
                    </td>
                    <td className="p-2 text-muted-foreground print:p-0.5">
                      {service.qty || "—"}
                    </td>
                    <td className="p-2 font-medium text-foreground print:p-0.5">{service.name}</td>
                    <td className="p-2 text-muted-foreground print:p-0.5">
                      {formatServiceDate(service.dateFrom)}
                    </td>
                    <td className="p-2 text-muted-foreground print:p-0.5">
                      {formatServiceDate(service.dateTo)}
                    </td>
                  </tr>)}
              </tbody>
            </table>
          </div>
        </div>

        {/* Flight Details Section */}
        {flights && flights.length > 0 && <div className="section-spacing">
            <h2 className="section-heading text-lg font-bold text-foreground mb-1.5 print:text-[13px] print:mb-0.5">
              Flight Details
            </h2>
            <div className="bg-muted content-padding rounded-lg print:p-1 print:text-[11px]">
              <ul className="space-y-0.5 print:space-y-0">
                {flights.map((flight, index) => {
              const fromCity = flight.fromCity || getCityName(flight.fromIata);
              const toCity = flight.toCity || getCityName(flight.toIata);
              const mainFlights = flights.filter(f => !f.isVariant);
              const flightNumber = flight.isVariant ? mainFlights.length + 1 : mainFlights.filter((f, i) => i < flights.indexOf(flight)).length + 1;
              const flightLabel = flightNumber === 1 ? "Let TAM" : flightNumber === 2 ? "Let ZPĚT" : `Let ${flightNumber}`;
              const showSeparator = flight.isVariant && index > 0 && !flights[index - 1].isVariant;
              return <li key={index}>
                      {showSeparator && <div className="border-t-2 border-primary my-3 print:my-2" />}
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
                    </li>;
            })}
              </ul>
            </div>
          </div>}

        {/* Tee Time Section */}
        {teeTimes && teeTimes.length > 0 && <div className="section-spacing">
            <h2 className="section-heading text-lg font-bold text-foreground mb-1.5 print:text-[13px] print:mb-0.5">
              Confirmed Tee Times
            </h2>
            <div className="bg-muted content-padding rounded-lg print:p-1 print:text-[11px]">
              <ul className="space-y-0.5 print:space-y-0">
                {teeTimes.map((teeTime, index) => <li key={index} className="text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDate(teeTime.date)}</span> {teeTime.club} at <span className="font-semibold text-foreground">{teeTime.time}</span> ({teeTime.golfers} golfers)
                  </li>)}
              </ul>
            </div>
          </div>}

        {/* Voucher Details */}
        <div className="section-spacing grid grid-cols-2 gap-3 print:gap-1.5">
          <div className="bg-muted content-padding rounded-lg print:p-1 print:text-[11px]">
            <p className="text-sm text-muted-foreground mb-0.5 print:text-[11px] print:mb-0">Issue Date</p>
            <p className="font-semibold text-foreground">{formatDate(issueDate)}</p>
          </div>
          <div className="bg-muted content-padding rounded-lg print:p-1 print:text-[11px]">
            <p className="text-sm text-muted-foreground mb-0.5 print:text-[11px] print:mb-0">Expiration Date</p>
            <p className="font-semibold text-foreground">
              {expirationDate ? formatDate(expirationDate) : "No Expiration"}
            </p>
          </div>
        </div>

        {/* Company Information Footer */}
        <div className="border-t-2 border-border pt-4 print:pt-2">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-3 rounded-lg print:p-2 print:bg-muted/30">
            {/* Web version - 3 columns */}
            <div className="print:hidden">
              <h3 className="font-bold text-foreground mb-1.5">YARO Travel</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5 text-xs text-muted-foreground">
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
                  <p>Available 24/7 for your travel needs</p>
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
        <div className="mt-4 text-xs text-muted-foreground print:mt-2 print:text-[11px]">
          <p className="font-semibold text-foreground mb-0.5 print:mb-0">Terms & Conditions:</p>
          <p className="mt-0.5 print:mt-0.5">
            This voucher is valid for the services listed above. Please present this voucher
            to service providers. Changes or cancellations must be made 48 hours in advance.
            For assistance, contact YARO Travel support.
          </p>
        </div>
      </Card>
    </div>;
};