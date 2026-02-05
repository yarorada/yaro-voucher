import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2, CheckCircle, XCircle, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExtractedSupplier {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

interface BulkSupplierUploadProps {
  onComplete: () => void;
}

export const BulkSupplierUpload = ({ onComplete }: BulkSupplierUploadProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedSuppliers, setExtractedSuppliers] = useState<ExtractedSupplier[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handleExtract = async () => {
    if (!inputText.trim()) {
      toast.error("Vložte text s daty dodavatelů");
      return;
    }

    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-bulk-supplier-data", {
        body: { text: inputText },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return;
      }

      if (data.suppliers && data.suppliers.length > 0) {
        setExtractedSuppliers(data.suppliers);
        toast.success(`Nalezeno ${data.suppliers.length} dodavatelů`);
      } else {
        toast.warning("Nepodařilo se najít žádné dodavatele v textu");
      }
    } catch (error: any) {
      console.error("Error extracting suppliers:", error);
      toast.error("Chyba při zpracování dat: " + (error.message || "Neznámá chyba"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdateSupplier = (index: number, field: keyof ExtractedSupplier, value: string) => {
    setExtractedSuppliers((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const handleRemoveSupplier = (index: number) => {
    setExtractedSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    if (extractedSuppliers.length === 0) {
      toast.error("Není co importovat");
      return;
    }

    const validSuppliers = extractedSuppliers.filter((s) => s.name?.trim());
    if (validSuppliers.length === 0) {
      toast.error("Všichni dodavatelé musí mít název");
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const supplier of validSuppliers) {
      try {
        const { error } = await supabase.from("suppliers").insert({
          name: supplier.name.trim(),
          contact_person: supplier.contact_person?.trim() || null,
          email: supplier.email?.trim() || null,
          phone: supplier.phone?.trim() || null,
          address: supplier.address?.trim() || null,
          notes: supplier.notes?.trim() || null,
        });

        if (error) {
          if (error.code === "23505") {
            toast.warning(`Dodavatel "${supplier.name}" již existuje`);
          } else {
            throw error;
          }
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error("Error importing supplier:", error);
        errorCount++;
      }
    }

    setIsImporting(false);

    if (successCount > 0) {
      toast.success(`Úspěšně importováno ${successCount} dodavatelů`);
      onComplete();
      handleClose();
    }

    if (errorCount > 0 && successCount === 0) {
      toast.error("Import se nezdařil");
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setInputText("");
    setExtractedSuppliers([]);
    setEditingIndex(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      if (!open) handleClose();
      else setIsOpen(true);
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Import z textu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Hromadný import dodavatelů</DialogTitle>
          <DialogDescription>
            Vložte text s údaji o dodavatelích a AI automaticky extrahuje data
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {extractedSuppliers.length === 0 ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="bulk-text">Text s daty dodavatelů</Label>
                <Textarea
                  id="bulk-text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={`Např.:
Hotel Paradise
Kontakt: Jan Novák
Email: jan@paradise.cz
Tel: +420 123 456 789
Adresa: Hlavní 123, Praha

Golf Resort Karlovy Vary
Email: info@golfkv.cz
Telefon: 777 888 999`}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  Zrušit
                </Button>
                <Button onClick={handleExtract} disabled={isProcessing}>
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Zpracovávám...
                    </>
                  ) : (
                    "Extrahovat data"
                  )}
                </Button>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Nalezeno {extractedSuppliers.length} dodavatelů. Zkontrolujte a upravte data před importem.
              </div>
              <ScrollArea className="flex-1 max-h-[400px] pr-4">
                <div className="space-y-3">
                  {extractedSuppliers.map((supplier, index) => (
                    <Card key={index} className="p-4">
                      {editingIndex === index ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Název *</Label>
                              <Input
                                value={supplier.name || ""}
                                onChange={(e) => handleUpdateSupplier(index, "name", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Kontaktní osoba</Label>
                              <Input
                                value={supplier.contact_person || ""}
                                onChange={(e) => handleUpdateSupplier(index, "contact_person", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Email</Label>
                              <Input
                                value={supplier.email || ""}
                                onChange={(e) => handleUpdateSupplier(index, "email", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div>
                              <Label className="text-xs">Telefon</Label>
                              <Input
                                value={supplier.phone || ""}
                                onChange={(e) => handleUpdateSupplier(index, "phone", e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          </div>
                          <div>
                            <Label className="text-xs">Adresa</Label>
                            <Input
                              value={supplier.address || ""}
                              onChange={(e) => handleUpdateSupplier(index, "address", e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <div>
                            <Label className="text-xs">Poznámky</Label>
                            <Textarea
                              value={supplier.notes || ""}
                              onChange={(e) => handleUpdateSupplier(index, "notes", e.target.value)}
                              rows={2}
                              className="text-sm"
                            />
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingIndex(null)}
                          >
                            Hotovo
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {supplier.name || <span className="text-destructive">Chybí název</span>}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
                              {supplier.contact_person && (
                                <div className="truncate">Kontakt: {supplier.contact_person}</div>
                              )}
                              {supplier.email && (
                                <div className="truncate">Email: {supplier.email}</div>
                              )}
                              {supplier.phone && (
                                <div className="truncate">Tel: {supplier.phone}</div>
                              )}
                              {supplier.address && (
                                <div className="truncate">Adresa: {supplier.address}</div>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => setEditingIndex(index)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveSupplier(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex justify-between gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setExtractedSuppliers([]);
                    setEditingIndex(null);
                  }}
                >
                  Zpět na zadání
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>
                    Zrušit
                  </Button>
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Importuji...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Importovat {extractedSuppliers.length} dodavatelů
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
