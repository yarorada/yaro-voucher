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
        className="p-8 shadow-[var(--shadow-strong)] bg-card print:shadow-none"
      >
        {/* Header */}
        <div className="border-b-4 border-primary pb-6 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <img src={yaroLogo} alt="YARO Travel" className="h-16 mb-2" />
              <p className="text-sm text-muted-foreground">Your Journey, Our Passion</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{voucherCode}</div>
              <p className="text-sm text-muted-foreground mt-1">Travel Voucher</p>
            </div>
          </div>
          
          {/* Provider Contact */}
          {supplierName && (
            <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
              <h3 className="text-sm font-semibold text-foreground mb-3">Dodavatel služeb:</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div>
                  <p className="font-medium text-foreground mb-1">Název:</p>
                  <p className="text-muted-foreground">{supplierName}</p>
                </div>
                {supplierAddress && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Adresa:</p>
                    <p className="text-muted-foreground">{supplierAddress}</p>
                  </div>
                )}
                {supplierEmail && (
                  <div>
                    <p className="font-medium text-foreground mb-1">Email:</p>
                    <p className="text-muted-foreground">{supplierEmail}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Client Information */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-3 border-l-4 border-accent pl-3">
            Client Information
          </h2>
          <div className="bg-muted p-4 rounded-lg">
            <div className="mb-2">
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
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground mb-3 border-l-4 border-accent pl-3">
            Service Overview
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="p-3 text-left">PAX</th>
                  <th className="p-3 text-left">Qtd.</th>
                  <th className="p-3 text-left">Service</th>
                  <th className="p-3 text-left">Date From</th>
                  <th className="p-3 text-left">Date To</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <tr 
                    key={index} 
                    className={index % 2 === 0 ? "bg-muted" : "bg-card"}
                  >
                    <td className="p-3 text-muted-foreground">
                      {service.pax || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {service.qty || "—"}
                    </td>
                    <td className="p-3 font-medium text-foreground">{service.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {formatServiceDate(service.dateFrom)}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {formatServiceDate(service.dateTo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Voucher Details */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Issue Date</p>
            <p className="font-semibold text-foreground">{formatDate(issueDate)}</p>
          </div>
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Expiration Date</p>
            <p className="font-semibold text-foreground">
              {expirationDate ? formatDate(expirationDate) : "No Expiration"}
            </p>
          </div>
        </div>

        {/* Company Information Footer */}
        <div className="border-t-2 border-border pt-6">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg">
            <h3 className="font-bold text-foreground mb-2">YARO Travel</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
              <div>
                <p className="font-semibold text-foreground">Address:</p>
                <p>Bratrancu Veverkowych 680</p>
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
                <p className="mt-2 text-xs">Available 24/7 for your travel needs</p>
              </div>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="mt-6 text-xs text-muted-foreground">
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
