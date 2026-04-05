import { useEffect, useState } from "react";
import { PageShell } from "@/components/PageShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Edit, MoreHorizontal, AlertTriangle, Check, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { removeDiacritics } from "@/lib/utils";
import { formatPhone } from "@/lib/phoneFormat";
import { checkSupplierDuplicates, DuplicateSupplier } from "@/lib/supplierDuplicates";
import { toast } from "sonner";
import { usePageToolbar } from "@/hooks/usePageToolbar";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useGlobalHistory } from "@/hooks/useGlobalHistory";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BulkSupplierUpload } from "@/components/BulkSupplierUpload";
import { SmartSearchInput } from "@/components/SmartSearchInput";

interface Supplier {
  id: string;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country_name: string | null;
  website: string | null;
  notes: string | null;
  partner_type: string;
  ico: string | null;
  dic: string | null;
}

const emptyForm = {
  name: "",
  contact_person: "",
  email: "",
  phone: "",
  street: "",
  postal_code: "",
  city: "",
  country_name: "",
  website: "",
  notes: "",
  ico: "",
  dic: "",
};

type SupplierPayload = {
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  postal_code: string | null;
  city: string | null;
  country_name: string | null;
  website: string | null;
  notes: string | null;
  partner_type: string;
  ico: string | null;
  dic: string | null;
};

const Suppliers = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [searchText, setSearchText] = useState("");
  const [formData, setFormData] = useState(emptyForm);
  const [activeTab, setActiveTab] = useState<"supplier" | "customer">("supplier");
  const [aresLoading, setAresLoading] = useState(false);
  // Duplicate check state
  const [pendingPayload, setPendingPayload] = useState<SupplierPayload | null>(null);
  const [dupDialogOpen, setDupDialogOpen] = useState(false);
  const [dupResults, setDupResults] = useState<{ duplicates: DuplicateSupplier[]; hasSameName: boolean; hasSameEmail: boolean; hasSamePhone: boolean } | null>(null);
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const { setIsSaving, setLastSaved } = useGlobalHistory();

  // Auto-save for editing existing supplier
  const autoSavePayload = editingSupplier && isDialogOpen ? formData : null;
  useAutoSave({
    data: autoSavePayload,
    saveFn: async (data) => {
      if (!editingSupplier || !data) return;
      setIsSaving(true);
      setAutoSaveStatus('saving');
      try {
        const payload = {
          name: data.name.trim(),
          contact_person: data.contact_person.trim() || null,
          email: data.email.trim() || null,
          phone: data.phone.trim() ? formatPhone(data.phone.trim()) : null,
          street: data.street.trim() || null,
          postal_code: data.postal_code.trim() || null,
          city: data.city.trim() || null,
          country_name: data.country_name.trim() || null,
          website: data.website.trim() || null,
          notes: data.notes.trim() || null,
          ico: data.ico.trim() || null,
          dic: data.dic.trim() || null,
        };
        await supabase.from("suppliers").update(payload).eq("id", editingSupplier.id);
        setLastSaved(new Date());
        setAutoSaveStatus('saved');
        fetchSuppliers();
      } catch (e) {
        console.error("Auto-save supplier error:", e);
        setAutoSaveStatus('idle');
      } finally {
        setIsSaving(false);
      }
    },
    debounceMs: 1500,
    enabled: !!editingSupplier && isDialogOpen,
  });

  useEffect(() => { fetchSuppliers(); }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name, contact_person, email, phone, street, postal_code, city, country_name, website, notes, partner_type, ico, dic")
        .order("name", { ascending: true });
      if (error) throw error;
      setSuppliers((data as Supplier[]) || []);
    } catch {
      toast.error("Chyba při načítání partnerů");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneBlur = () => {
    if (formData.phone.trim()) {
      setFormData((f) => ({ ...f, phone: formatPhone(f.phone) }));
    }
  };

  const handleAresLookup = async (ico: string) => {
    if (!ico || ico.trim().length < 2) return;
    setAresLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ares-lookup", {
        body: { ico: ico.trim() },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      setFormData((f) => ({
        ...f,
        name: data.name || f.name,
        ico: data.ico || f.ico,
        dic: data.dic || f.dic,
        street: data.street || f.street,
        city: data.city || f.city,
        postal_code: data.postal_code || f.postal_code,
        country_name: f.country_name || "Česká republika",
      }));
      toast.success("Údaje doplněny z ARES");
    } catch {
      toast.error("Nepodařilo se načíst údaje z ARES");
    } finally {
      setAresLoading(false);
    }
  };

  const saveSupplier = async (payload: SupplierPayload) => {
    try {
      const label = payload.partner_type === "customer" ? "Odběratel" : "Dodavatel";
      if (editingSupplier) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", editingSupplier.id);
        if (error) throw error;
        toast.success(`${label} byl aktualizován`);
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
        toast.success(`${label} byl přidán`);
      }
      handleDialogClose();
      fetchSuppliers();
    } catch (error: any) {
      if (error.code === "23505") toast.error("Partner s tímto názvem již existuje");
      else toast.error("Chyba při ukládání partnera");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Název je povinný"); return; }

    const payload: SupplierPayload = {
      name: formData.name.trim(),
      contact_person: formData.contact_person.trim() || null,
      email: formData.email.trim() || null,
      phone: formData.phone.trim() ? formatPhone(formData.phone.trim()) : null,
      street: formData.street.trim() || null,
      postal_code: formData.postal_code.trim() || null,
      city: formData.city.trim() || null,
      country_name: formData.country_name.trim() || null,
      website: formData.website.trim() || null,
      notes: formData.notes.trim() || null,
      partner_type: editingSupplier ? editingSupplier.partner_type : activeTab,
      ico: formData.ico.trim() || null,
      dic: formData.dic.trim() || null,
    };

    // Skip duplicate check when editing
    if (editingSupplier) { await saveSupplier(payload); return; }

    const result = await checkSupplierDuplicates(
      formData.name,
      formData.email,
      formData.phone,
    );

    if (result.duplicates.length > 0) {
      setPendingPayload(payload);
      setDupResults(result);
      setDupDialogOpen(true);
    } else {
      await saveSupplier(payload);
    }
  };

  const handleEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || "",
      email: supplier.email || "",
      phone: supplier.phone || "",
      street: supplier.street || "",
      postal_code: supplier.postal_code || "",
      city: supplier.city || "",
      country_name: supplier.country_name || "",
      website: supplier.website || "",
      notes: supplier.notes || "",
      ico: supplier.ico || "",
      dic: supplier.dic || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Opravdu chcete smazat tohoto partnera?")) return;
    try {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
      toast.success("Partner byl smazán");
      fetchSuppliers();
    } catch {
      toast.error("Chyba při mazání partnera");
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingSupplier(null);
    setFormData(emptyForm);
  };

  const filteredSuppliers = suppliers.filter((s) => {
    if (s.partner_type !== activeTab) return false;
    if (!searchText.trim()) return true;
    const q = removeDiacritics(searchText.toLowerCase());
    return (
      removeDiacritics(s.name.toLowerCase()).includes(q) ||
      removeDiacritics((s.contact_person || "").toLowerCase()).includes(q) ||
      removeDiacritics((s.email || "").toLowerCase()).includes(q) ||
      removeDiacritics((s.city || "").toLowerCase()).includes(q) ||
      removeDiacritics((s.ico || "").toLowerCase()).includes(q)
    );
  });

  const currentLabel = activeTab === "customer" ? "odběratele" : "dodavatele";
  const currentLabelTitle = activeTab === "customer" ? "Odběratel" : "Dodavatel";
  const isCustomerForm = editingSupplier ? editingSupplier.partner_type === "customer" : activeTab === "customer";

  usePageToolbar(
    <div className="flex items-center gap-2">
      <SmartSearchInput
        value={searchText}
        onChange={setSearchText}
        noResults={filteredSuppliers.length === 0 && !loading}
        addLabel={`${currentLabel} „{text}"`}
        onAddNew={(text) => {
          setFormData({ ...emptyForm, name: text });
          setEditingSupplier(null);
          setIsDialogOpen(true);
        }}
        placeholder={`Hledat ${currentLabel}...`}
        className="w-48 md:w-64"
        inputClassName="h-8 text-xs"
      />
      {activeTab === "supplier" && <BulkSupplierUpload onComplete={fetchSuppliers} />}
    </div>,
    [searchText, filteredSuppliers.length, loading, activeTab]
  );

  return (
    <PageShell>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "supplier" | "customer")} className="space-y-6">
          <TabsList>
            <TabsTrigger value="supplier">Dodavatelé ({suppliers.filter(s => s.partner_type === "supplier").length})</TabsTrigger>
            <TabsTrigger value="customer">Odběratelé ({suppliers.filter(s => s.partner_type === "customer").length})</TabsTrigger>
          </TabsList>

          <TabsContent value="supplier" className="mt-0">
            {renderTable(filteredSuppliers)}
          </TabsContent>
          <TabsContent value="customer" className="mt-0">
            {renderTable(filteredSuppliers)}
          </TabsContent>
        </Tabs>

        {/* Create/Edit Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) handleDialogClose(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background">
            <DialogHeader>
              <DialogTitle>{editingSupplier ? `Upravit ${currentLabelTitle.toLowerCase()}` : `Nový ${currentLabelTitle.toLowerCase()}`}</DialogTitle>
              <DialogDescription>Zadejte informace o {currentLabel}</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ARES lookup for all partner types */}
              <div className="space-y-2">
                <Label>Načíst z ARES</Label>
                <div className="flex gap-2">
                  <Input
                    value={formData.ico}
                    onChange={(e) => setFormData({ ...formData, ico: e.target.value })}
                    placeholder="Zadejte IČO"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={aresLoading || !formData.ico.trim()}
                    onClick={() => handleAresLookup(formData.ico)}
                  >
                    {aresLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    <span className="ml-1">ARES</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">Název <span className="text-destructive">*</span></Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ico">IČO</Label>
                  <Input id="ico" value={formData.ico} onChange={(e) => setFormData({ ...formData, ico: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dic">DIČ</Label>
                  <Input id="dic" value={formData.dic} onChange={(e) => setFormData({ ...formData, dic: e.target.value })} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_person">Kontaktní osoba</Label>
                  <Input id="contact_person" value={formData.contact_person} onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    onBlur={handlePhoneBlur}
                    placeholder="+420 777 123 456"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">Web</Label>
                  <Input id="website" value={formData.website} onChange={(e) => setFormData({ ...formData, website: e.target.value })} placeholder="https://..." />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Adresa</Label>
                <Input
                  value={formData.street}
                  onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                  placeholder="Ulice a č.p."
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    value={formData.postal_code}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                    placeholder="PSČ"
                  />
                  <Input
                    className="col-span-2"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="Město"
                  />
                </div>
                <Input
                  value={formData.country_name}
                  onChange={(e) => setFormData({ ...formData, country_name: e.target.value })}
                  placeholder="Stát"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Poznámky</Label>
                <Textarea id="notes" value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} />
              </div>

              <div className="flex gap-2 justify-end items-center">
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  {editingSupplier ? "Zavřít" : "Zrušit"}
                </Button>
                {editingSupplier ? (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    {autoSaveStatus === 'saving' ? (
                      <><Loader2 className="h-3 w-3 animate-spin" />Ukládám…</>
                    ) : autoSaveStatus === 'saved' ? (
                      <><Check className="h-3 w-3 text-emerald-500" />Uloženo</>
                    ) : null}
                  </span>
                ) : (
                  <Button type="submit">Přidat</Button>
                )}
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Duplicate warning dialog */}
        <Dialog open={dupDialogOpen} onOpenChange={setDupDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                Možná duplicita
              </DialogTitle>
              <DialogDescription>
                V databázi existují podobní partneři. Chcete přesto přidat nového?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              {dupResults && (
                <Alert className="border-amber-200/50 bg-amber-50/50 dark:bg-amber-950/20">
                  <AlertDescription className="text-sm space-y-0.5">
                    {dupResults.hasSameName && <div>• Stejný název</div>}
                    {dupResults.hasSameEmail && <div>• Stejný e-mail</div>}
                    {dupResults.hasSamePhone && <div>• Stejný telefon</div>}
                  </AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                {dupResults?.duplicates.map((d) => (
                  <Card key={d.id} className="p-3">
                    <div className="font-medium text-sm">{d.name}</div>
                    <div className="text-xs text-muted-foreground space-x-3">
                      {d.email && <span>{d.email}</span>}
                      {d.phone && <span>{d.phone}</span>}
                      {d.city && <span>{d.city}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setDupDialogOpen(false)}>
                Zpět k úpravám
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  if (pendingPayload) {
                    setDupDialogOpen(false);
                    await saveSupplier(pendingPayload);
                    setPendingPayload(null);
                  }
                }}
              >
                Přesto přidat
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </PageShell>
  );

  function renderTable(items: Supplier[]) {
    if (loading) {
      return (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Načítám...</p>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <Card className="p-12 text-center shadow-[var(--shadow-medium)]">
          <h2 className="text-heading-2 text-foreground mb-2">
            {searchText ? `Žádní ${currentLabel} nenalezeni` : `Zatím žádní ${currentLabel}`}
          </h2>
          <p className="text-body text-muted-foreground mb-6">
            {searchText ? "Zkuste změnit hledání" : `Přidejte prvního ${currentLabel}`}
          </p>
        </Card>
      );
    }
    return (
      <>
        {/* Mobile card view */}
        <div className="sm:hidden space-y-2">
          {items.map((supplier) => (
            <Card key={supplier.id} className="shadow-[var(--shadow-medium)] p-3 space-y-1 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => handleEdit(supplier)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <button onClick={() => handleEdit(supplier)} className="font-medium text-sm text-left hover:text-primary transition-colors cursor-pointer">{supplier.name}</button>
                  {supplier.contact_person && (
                    <p className="text-xs text-muted-foreground">{supplier.contact_person}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
                    {supplier.email && (
                      <a href={`mailto:${supplier.email}`} className="hover:text-primary transition-colors truncate">{supplier.email}</a>
                    )}
                    {supplier.ico && <span>IČO: {supplier.ico}</span>}
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8 flex-shrink-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                      <Edit className="h-4 w-4 mr-2" /> Upravit
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(supplier.id)}>
                      <Trash2 className="h-4 w-4 mr-2" /> Smazat
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Card>
          ))}
        </div>

        {/* Desktop table view */}
        <Card className="shadow-[var(--shadow-medium)] overflow-hidden hidden sm:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-primary">Název</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kontaktní osoba</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">IČO</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => handleEdit(supplier)}>
                    <td className="px-4 py-3 font-medium text-foreground"><button onClick={() => handleEdit(supplier)} className="hover:text-primary transition-colors cursor-pointer">{supplier.name}</button></td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {supplier.contact_person || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {supplier.email
                        ? <a href={`mailto:${supplier.email}`} className="hover:text-primary transition-colors">{supplier.email}</a>
                        : <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {supplier.ico || <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(supplier)}>
                            <Edit className="h-4 w-4 mr-2" /> Upravit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => handleDelete(supplier.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Smazat
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  }
};

export default Suppliers;
