import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";

interface Service {
  name: string;
  pax: string;
  qty: string;
  dateFrom: string;
  dateTo: string;
}

interface VoucherDisplayProps {
  voucherCode: string;
  clientName: string;
  otherTravelers?: string[];
  services: Service[];
  issueDate: string;
  expirationDate?: string;
  supplierName?: string;
  supplierContact?: string | null;
  supplierEmail?: string | null;
  supplierPhone?: string | null;
  supplierAddress?: string | null;
  supplierNotes?: string | null;
}

export const VoucherDisplay = ({
  voucherCode,
  clientName,
  otherTravelers,
  services,
  issueDate,
  expirationDate,
  supplierName,
  supplierContact,
  supplierEmail,
  supplierPhone,
  supplierAddress,
  supplierNotes,
}: VoucherDisplayProps) => {
  
  const handleDownloadPDF = () => {
    window.print();
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

  return (
    <div className="space-y-4">
      <div className="flex gap-2 print:hidden">
        <Button onClick={handleDownloadPDF} className="flex-1" size="icon">
          <Download className="h-5 w-5" />
        </Button>
        <Button variant="outline" className="flex-1" size="icon">
          <Mail className="h-5 w-5" />
        </Button>
      </div>

      <Card 
        id="voucher-content" 
        className="p-8 shadow-[var(--shadow-strong)] bg-card print:shadow-none print:p-4 print:text-sm"
      >
        {/* Header */}
        <div className="border-b-4 border-primary pb-6 mb-6 print:pb-3 print:mb-3">
          <div className="flex justify-between items-start mb-6 print:mb-3">
            <div>
              <img src={yaroLogo} alt="YARO Travel" className="h-16 mb-2 print:h-10 print:mb-1" />
              <p className="text-sm text-muted-foreground print:text-xs">Your Journey, Our Passion</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary print:text-2xl">{voucherCode}</div>
              <p className="text-sm text-muted-foreground mt-1 print:text-xs print:mt-0">Travel Voucher</p>
            </div>
          </div>
          
          {/* Service Provider Contact */}
          {supplierName && (
            <div className="bg-muted p-4 rounded-lg border-l-4 border-primary print:p-2 print:text-xs">
              <h3 className="text-sm font-bold text-foreground mb-3 print:text-xs print:mb-1">Service Provider:</h3>
              <div className="text-sm text-muted-foreground space-y-1 print:text-xs print:space-y-0">
                <p>
                  {supplierName}
                  {supplierAddress && ` • ${supplierAddress}`}
                  {supplierEmail && ` • ${supplierEmail}`}
                </p>
                {supplierNotes && (
                  <p className="pt-1 border-t border-border/50 print:pt-0 print:border-t-0 print:mt-0.5">{supplierNotes}</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Client Information */}
        <div className="mb-6 print:mb-3">
          <h2 className="text-xl font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-base print:mb-2 print:pl-2">
            Client Information
          </h2>
          <div className="bg-muted p-4 rounded-lg print:p-2 print:text-xs">
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

        {/* Services Table */}
        <div className="mb-6 print:mb-3">
          <h2 className="text-xl font-bold text-foreground mb-3 border-l-4 border-accent pl-3 print:text-base print:mb-2 print:pl-2">
            Service Overview
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse print:text-xs">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="p-3 text-left print:p-1.5">PAX</th>
                  <th className="p-3 text-left print:p-1.5">Qtd.</th>
                  <th className="p-3 text-left print:p-1.5">Service</th>
                  <th className="p-3 text-left print:p-1.5">Date From</th>
                  <th className="p-3 text-left print:p-1.5">Date To</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <tr 
                    key={index} 
                    className={index % 2 === 0 ? "bg-muted" : "bg-card"}
                  >
                    <td className="p-3 text-muted-foreground print:p-1.5">
                      {service.pax || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground print:p-1.5">
                      {service.qty || "—"}
                    </td>
                    <td className="p-3 font-medium text-foreground print:p-1.5">{service.name}</td>
                    <td className="p-3 text-muted-foreground print:p-1.5">
                      {formatServiceDate(service.dateFrom)}
                    </td>
                    <td className="p-3 text-muted-foreground print:p-1.5">
                      {formatServiceDate(service.dateTo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Voucher Details */}
        <div className="mb-6 grid grid-cols-2 gap-4 print:mb-3 print:gap-2">
          <div className="bg-muted p-4 rounded-lg print:p-2 print:text-xs">
            <p className="text-sm text-muted-foreground mb-1 print:text-xs print:mb-0">Issue Date</p>
            <p className="font-semibold text-foreground">{formatDate(issueDate)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg print:p-2 print:text-xs">
            <p className="text-sm text-muted-foreground mb-1 print:text-xs print:mb-0">Expiration Date</p>
            <p className="font-semibold text-foreground">
              {expirationDate ? formatDate(expirationDate) : "No Expiration"}
            </p>
          </div>
        </div>

        {/* Company Information Footer */}
        <div className="border-t-2 border-border pt-6 print:pt-3">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg print:p-3 print:bg-muted/30">
            <h3 className="font-bold text-foreground mb-2 print:mb-1.5">YARO Travel</h3>
            <div className="text-sm text-muted-foreground print:text-xs print:leading-relaxed">
              <p>Bratrancu Veverkowych 680, Pardubice, 530 02</p>
              <p>Tel.: +420 602 102 108 | Email: zajezdy@yarotravel.cz</p>
              <p>www.yarotravel.cz</p>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="mt-6 text-xs text-muted-foreground print:mt-2">
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
