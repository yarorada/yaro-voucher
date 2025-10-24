import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, Mail } from "lucide-react";
import yaroLogo from "@/assets/yaro-logo-wide.png";

interface Service {
  name: string;
  date: string;
  time: string;
  provider: string;
  price: string;
}

interface VoucherDisplayProps {
  voucherCode: string;
  clientName: string;
  otherTravelers?: string[];
  services: Service[];
  issueDate: string;
  expirationDate?: string;
}

export const VoucherDisplay = ({
  voucherCode,
  clientName,
  otherTravelers,
  services,
  issueDate,
  expirationDate,
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
        <div className="border-b-4 border-primary pb-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <img src={yaroLogo} alt="YARO Travel" className="h-16 mb-2" />
              <p className="text-sm text-muted-foreground">Your Journey, Our Passion</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{voucherCode}</div>
              <p className="text-sm text-muted-foreground mt-1">Travel Voucher</p>
            </div>
          </div>
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
                <span className="font-semibold text-foreground">Other Travelers:</span>
                <ul className="list-disc list-inside ml-4 text-muted-foreground">
                  {otherTravelers.map((traveler, index) => (
                    <li key={index}>{traveler}</li>
                  ))}
                </ul>
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
                  <th className="p-3 text-left">Service</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Time</th>
                  <th className="p-3 text-left">Provider</th>
                  <th className="p-3 text-right">Price</th>
                </tr>
              </thead>
              <tbody>
                {services.map((service, index) => (
                  <tr 
                    key={index} 
                    className={index % 2 === 0 ? "bg-muted" : "bg-card"}
                  >
                    <td className="p-3 font-medium text-foreground">{service.name}</td>
                    <td className="p-3 text-muted-foreground">
                      {service.date ? formatDate(service.date) : "TBD"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {service.time || "TBD"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {service.provider || "—"}
                    </td>
                    <td className="p-3 text-right font-semibold text-foreground">
                      {service.price || "—"}
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
                <p>123 Travel Street</p>
                <p>Tourism City, TC 12345</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Contact:</p>
                <p>Phone: +1 (555) 123-4567</p>
                <p>Email: info@yarotravel.com</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Website:</p>
                <p>www.yarotravel.com</p>
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
