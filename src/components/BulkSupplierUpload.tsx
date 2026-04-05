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
import { Upload, Loader2, CheckCircle, Edit2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/phoneFormat";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ExtractedSupplier {
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  street?: string;
  postal_code?: string;
  city?: string;
  country_name?: string;
  website?: string;
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
    if (!inputText.trim()) { toast.error("Vložte text s daty dodavatelů"); return; }
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-bulk-supplier-data", {
        body: { text: inputText },
      });
      if (error) throw error;
      if (data.error) { toast.error(data.error); return; }
      if (data.suppliers?.length > 0) {
        // auto-format phones
        const formatted = data.suppliers.map((s: ExtractedSupplier) => ({
          ...s,
          phone: s.phone ? formatPhone(s.phone) : s.phone,
        }));
        setExtractedSuppliers(formatted);
        toast.success(`Nalezeno ${formatted.length} dodavatelů`);
      } else {
        toast.warning("Nepodařilo se najít žádné dodavatele v textu");
      }
    } catch (error: any) {
      toast.error("Chyba při zpracování dat: " + (error.message || "Neznámá chyba"));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUpdate = (index: number, field: keyof ExtractedSupplier, value: string) => {
    setExtractedSuppliers((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  };

  const handlePhoneBlur = (index: number, value: string) => {
    if (value.trim()) handleUpdate(index, "phone", formatPhone(value));
  };

  const handleRemove = (index: number) => {
    setExtractedSuppliers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleImport = async () => {
    const valid = extractedSuppliers.filter((s) => s.name?.trim());
    if (valid.length === 0) { toast.error("Není co importovat"); return; }
    setIsImporting(true);
    let ok = 0, fail = 0;
    for (const s of valid) {
      try {
        const { error } = await supabase.from("suppliers").insert({
          name: s.name.trim(),
          contact_person: s.contact_person?.trim() || null,
          email: s.email?.trim() || null,
          phone: s.phone?.trim() || null,
          street: s.street?.trim() || null,
          postal_code: s.postal_code?.trim() || null,
          city: s.city?.trim() || null,
          country_name: s.country_name?.trim() || null,
          website: s.website?.trim() || null,
          notes: s.notes?.trim() || null,
        });
        if (error) {
          if (error.code === "23505") toast.warning(`Dodavatel "${s.name}" již existuje`);
          else throw error;
          fail++;
        } else ok++;
      } catch { fail++; }
    }
    setIsImporting(false);
    if (ok > 0) { toast.success(`Úspěšně importováno ${ok} dodavatelů`); onComplete(); handleClose(); }
    if (fail > 0 && ok === 0) toast.error("Import se nezdařil");
  };

  const handleClose = () => {
    setIsOpen(false);
    setInputText("");
    setExtractedSuppliers([]);
    setEditingIndex(null);
  };

  const formatAddressPreview = (s: ExtractedSupplier) => {
    const parts = [s.street, [s.postal_code, s.city].filter(Boolean).join(" "), s.country_name].filter(Boolean);
    return parts.join(", ");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); else setIsOpen(true); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start text-sm px-2 py-1.5 h-auto font-normal gap-2">
          <Upload className="h-4 w-4" />
          Import z textu
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Hromadný import dodavatelů</DialogTitle>
          <DialogDescription>Vložte text s údaji o dodavatelích — AI automaticky extrahuje a rozčlení data</DialogDescription>
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
Adresa: Hlavní 123, 301 00 Praha, ČR
Web: www.paradise.cz

Golf Resort Karlovy Vary
info@golfkv.cz / 777 888 999
Nám. Republiky 5, Karlovy Vary`}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>Zrušit</Button>
                <Button onClick={handleExtract} disabled={isProcessing}>
                  {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Zpracovávám...</> : "Extrahovat data"}
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
                  {extractedSuppliers.map((s, index) => (
                    <Card key={index} className="p-4">
                      {editingIndex === index ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs">Název *</Label>
                              <Input value={s.name || ""} onChange={(e) => handleUpdate(index, "name", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Kontaktní osoba</Label>
                              <Input value={s.contact_person || ""} onChange={(e) => handleUpdate(index, "contact_person", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Email</Label>
                              <Input value={s.email || ""} onChange={(e) => handleUpdate(index, "email", e.target.value)} className="h-8 text-sm" />
                            </div>
                            <div>
                              <Label className="text-xs">Telefon</Label>
                              <Input
                                value={s.phone || ""}
                                onChange={(e) => handleUpdate(index, "phone", e.target.value)}
                                onBlur={(e) => handlePhoneBlur(index, e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-2">
                              <Label className="text-xs">Webová stránka</Label>
                              <Input value={s.website || ""} onChange={(e) => handleUpdate(index, "website", e.target.value)} className="h-8 text-sm" placeholder="https://..." />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-xs font-medium">Adresa</Label>
                            <Input value={s.street || ""} onChange={(e) => handleUpdate(index, "street", e.target.value)} className="h-8 text-sm" placeholder="Ulice a č.p." />
                            <div className="grid grid-cols-3 gap-2">
                              <Input value={s.postal_code || ""} onChange={(e) => handleUpdate(index, "postal_code", e.target.value)} className="h-8 text-sm" placeholder="PSČ" />
                              <Input className="col-span-2 h-8 text-sm" value={s.city || ""} onChange={(e) => handleUpdate(index, "city", e.target.value)} placeholder="Město" />
                            </div>
                            <Input value={s.country_name || ""} onChange={(e) => handleUpdate(index, "country_name", e.target.value)} className="h-8 text-sm" placeholder="Stát" />
                          </div>

                          <div>
                            <Label className="text-xs">Poznámky</Label>
                            <Textarea value={s.notes || ""} onChange={(e) => handleUpdate(index, "notes", e.target.value)} rows={2} className="text-sm" />
                          </div>
                          <Button size="sm" variant="outline" onClick={() => setEditingIndex(null)}>Hotovo</Button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {s.name || <span className="text-destructive">Chybí název</span>}
                            </div>
                            <div className="text-sm text-muted-foreground space-y-0.5 mt-1">
                              {s.contact_person && <div className="truncate">Kontakt: {s.contact_person}</div>}
                              {s.email && <div className="truncate">Email: {s.email}</div>}
                              {s.phone && <div className="truncate">Tel: {s.phone}</div>}
                              {formatAddressPreview(s) && <div className="truncate">Adresa: {formatAddressPreview(s)}</div>}
                              {s.website && <div className="truncate text-primary/80">Web: {s.website}</div>}
                            </div>
                          </div>
                          <div className="flex gap-1 ml-2">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingIndex(index)}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleRemove(index)}>
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
                <Button variant="outline" onClick={() => { setExtractedSuppliers([]); setEditingIndex(null); }}>Zpět na zadání</Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleClose}>Zrušit</Button>
                  <Button onClick={handleImport} disabled={isImporting}>
                    {isImporting
                      ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importuji...</>
                      : <><CheckCircle className="h-4 w-4 mr-2" />Importovat {extractedSuppliers.length} dodavatelů</>}
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
