import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";

interface Service {
  pax: string;
  qty: string;
  name: string;
  dateFrom: string;
  dateTo: string;
}

interface Supplier {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

interface VoucherDisplayProps {
  voucherCode: string;
  clientName: string;
  otherTravelers?: string[];
  services: Service[];
  issueDate: string;
  expirationDate?: string;
  supplier?: Supplier;
}

export const VoucherDisplay = ({
  voucherCode,
  clientName,
  otherTravelers,
  services,
  issueDate,
  expirationDate,
  supplier,
}: VoucherDisplayProps) => {
  
  const handleDownloadPDF = () => {
    window.print();
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatServiceDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${day}-${month}-${year}`;
  };

  const formatDateRange = (dateFrom: string, dateTo: string) => {
    if (!dateFrom && !dateTo) return "TBD";
    if (!dateTo) return formatServiceDate(dateFrom);
    if (!dateFrom) return formatServiceDate(dateTo);
    
    const from = formatServiceDate(dateFrom);
    const to = formatServiceDate(dateTo);
    
    if (from === to) return from;
    return `${from} - ${to}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 print:hidden">
        <Button onClick={handleDownloadPDF} className="flex-1">
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        <Button variant="outline" className="flex-1">
          <Mail className="h-4 w-4 mr-2" />
          Email Voucher
        </Button>
      </div>

      <Card 
        id="voucher-content" 
        className="p-8 shadow-[var(--shadow-strong)] bg-card print:shadow-none"
      >
        {/* Header */}
        <div className="border-b-2 border-border pb-4 mb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <img src={yaroLogo} alt="YARO s.r.o." className="h-12 mb-1" />
              <div className="text-xs text-muted-foreground">
                <p>Bratranců Veverkových 680, Pardubice, 530 02</p>
                <p>IČO: 07849290</p>
                <p>Tel.: +420 602102108, www.yarotravel.cz</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">NR. {voucherCode}</div>
            </div>
          </div>
          <h1 className="text-xl font-bold text-center text-foreground">SERVICE VOUCHER</h1>
        </div>

        {/* Supplier Information */}
        {supplier && (
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <p className="text-sm font-semibold text-foreground mb-2">For: {supplier.name}</p>
            {supplier.address && (
              <p className="text-sm text-muted-foreground">{supplier.address}</p>
            )}
            {supplier.phone && (
              <p className="text-sm text-muted-foreground">Phone No.: {supplier.phone}</p>
            )}
            {supplier.notes && (
              <p className="text-sm text-muted-foreground whitespace-pre-line">{supplier.notes}</p>
            )}
            {supplier.email && (
              <p className="text-sm text-muted-foreground">{supplier.email}</p>
            )}
          </div>
        )}

        {/* Client Names */}
        <div className="mb-6">
          <h2 className="text-sm font-bold text-foreground mb-2">Client's Names:</h2>
          <div className="text-sm text-muted-foreground">
            <p className="mb-1">
              <span className="font-semibold text-foreground">Main Client:</span> {clientName}
            </p>
            {otherTravelers && otherTravelers.length > 0 && (
              <p>
                <span className="font-semibold text-foreground">Other Travelers:</span>{" "}
                {otherTravelers.join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Services Table */}
        <div className="mb-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-border">
              <thead>
                <tr className="bg-primary text-primary-foreground">
                  <th className="p-2 text-left border border-border text-sm">PAX</th>
                  <th className="p-2 text-left border border-border text-sm">Qtd.</th>
                  <th className="p-2 text-left border border-border text-sm">Service</th>
                  <th className="p-2 text-left border border-border text-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <tr 
                    key={index} 
                    className={index % 2 === 0 ? "bg-muted" : "bg-card"}
                  >
                    <td className="p-2 text-foreground border border-border text-sm">
                      {service.pax || "—"}
                    </td>
                    <td className="p-2 text-foreground border border-border text-sm">
                      {service.qty || "—"}
                    </td>
                    <td className="p-2 text-foreground border border-border text-sm">
                      {service.name}
                    </td>
                    <td className="p-2 text-foreground border border-border text-sm">
                      {formatDateRange(service.dateFrom, service.dateTo)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Signature Section */}
        <div className="mt-8 border-t border-border pt-4">
          <div className="flex justify-between items-end">
            <div className="text-sm text-muted-foreground">
              <p className="mb-8">_______________________</p>
              <p>Signature</p>
            </div>
            <div className="text-sm text-muted-foreground text-right">
              <p className="mb-2">{formatDate(issueDate)}</p>
              <p>Date</p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
