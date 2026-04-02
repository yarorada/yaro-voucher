import { useState, useEffect, useRef } from "react";
import { PageShell } from "@/components/PageShell";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Eye, Mail, Copy } from "lucide-react";

interface EmailTemplate {
  id: string;
  template_key: string;
  name: string;
  subject: string;
  body: string;
  trigger_type: string | null;
  trigger_offset_days: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const PLACEHOLDERS = [
  { key: "{{salutation}}", desc: "Oslovení – Vážený/Vážená + příjmení ve vokativu (dle titulu Pan/Paní)" },
  { key: "{{last_name}}", desc: "Příjmení klienta" },
  { key: "{{destination}}", desc: "Název destinace" },
  { key: "{{hotel}}", desc: "Název hotelu" },
  { key: "{{date_from}}", desc: "Datum od (DD.MM.YY)" },
  { key: "{{date_to}}", desc: "Datum do (DD.MM.YY)" },
  { key: "{{total_price}}", desc: "Celková cena" },
  { key: "{{voucher_code}}", desc: "Kód voucheru" },
  { key: "{{contract_number}}", desc: "Číslo smlouvy" },
  { key: "{{sign_link}}", desc: "Odkaz na podpis smlouvy" },
];

const TRIGGER_TYPES = [
  { value: "manual", label: "Manuální" },
  { value: "before_departure", label: "Před odjezdem", desc: "X dní před start_date dealu" },
  { value: "after_return", label: "Po návratu", desc: "X dní po end_date dealu" },
  { value: "payment_reminder", label: "Připomenutí platby", desc: "X dní před splatností platby" },
  { value: "payment_received", label: "Po přijetí platby", desc: "Po potvrzení platby" },
  { value: "birthday", label: "Narozeniny", desc: "V den narozenin klienta" },
];

const EXAMPLE_DATA: Record<string, string> = {
  "{{salutation}}": "Vážený pane Nováku",
  "{{last_name}}": "Novák",
  "{{destination}}": "Belek, Turecko",
  "{{hotel}}": "Regnum Carya",
  "{{date_from}}": "15.03.26",
  "{{date_to}}": "22.03.26",
  "{{total_price}}": "125 000 CZK",
  "{{voucher_code}}": "YT-26042",
  "{{contract_number}}": "CS-260015",
  "{{sign_link}}": "https://yarogolf-crm.lovable.app/sign-contract?token=abc123",
};

const renderPreview = (text: string) => {
  let result = text;
  for (const [key, val] of Object.entries(EXAMPLE_DATA)) {
    result = result.split(key).join(val);
  }
  return result;
};

export default function EmailTemplates() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<EmailTemplate | null>(null);
  const [editForm, setEditForm] = useState({ subject: "", body: "", trigger_type: "", trigger_offset_days: "" });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .order("template_key");
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      setTemplates((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleEdit = (t: EmailTemplate) => {
    setEditingTemplate(t);
    setEditForm({
      subject: t.subject,
      body: t.body,
      trigger_type: t.trigger_type || "",
      trigger_offset_days: t.trigger_offset_days?.toString() || "",
    });
  };

  const handleSave = async () => {
    if (!editingTemplate) return;
    const { error } = await supabase
      .from("email_templates")
      .update({
        subject: editForm.subject,
        body: editForm.body,
        trigger_type: editForm.trigger_type || null,
        trigger_offset_days: editForm.trigger_offset_days ? parseInt(editForm.trigger_offset_days) : null,
      } as any)
      .eq("id", editingTemplate.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Uloženo", description: "Šablona byla aktualizována." });
      setEditingTemplate(null);
      fetchTemplates();
    }
  };

  const toggleActive = async (t: EmailTemplate) => {
    const { error } = await supabase
      .from("email_templates")
      .update({ is_active: !t.is_active } as any)
      .eq("id", t.id);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
    } else {
      fetchTemplates();
    }
  };

  const insertPlaceholder = (placeholder: string) => {
    const textarea = bodyRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newBody = editForm.body.slice(0, start) + placeholder + editForm.body.slice(end);
      setEditForm(prev => ({ ...prev, body: newBody }));
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        textarea.selectionStart = start + placeholder.length;
        textarea.selectionEnd = start + placeholder.length;
        textarea.focus();
      });
    } else {
      setEditForm(prev => ({ ...prev, body: prev.body + placeholder }));
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Načítání...</div>;

  return (
    <PageShell>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-1">E-mailové šablony</h1>
          <p className="text-body text-muted-foreground mt-1">Správa textů odesílaných e-mailů pro vouchery, smlouvy a dokumenty.</p>
        </div>
      </div>

      <div className="grid gap-4">
        {templates.map(t => (
          <Card key={t.id} className={!t.is_active ? "opacity-60" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <CardTitle className="text-base">{t.name}</CardTitle>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.template_key}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {t.trigger_type && (
                    <Badge variant="outline" className="text-xs">
                      {TRIGGER_TYPES.find(tt => tt.value === t.trigger_type)?.label || t.trigger_type}
                      {t.trigger_offset_days ? ` (${t.trigger_offset_days}d)` : ""}
                    </Badge>
                  )}
                  <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                  <Button variant="ghost" size="icon" onClick={() => setPreviewTemplate(t)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(t)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <p className="text-sm text-muted-foreground"><span className="font-medium">Předmět:</span> {t.subject}</p>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={() => setEditingTemplate(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Upravit šablonu: {editingTemplate?.name}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="edit">
            <TabsList>
              <TabsTrigger value="edit">Editace</TabsTrigger>
              <TabsTrigger value="preview">Náhled</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="space-y-4 mt-4">
              <div>
                <Label>Předmět e-mailu</Label>
                <Input value={editForm.subject} onChange={e => setEditForm(p => ({ ...p, subject: e.target.value }))} />
              </div>
              <div>
                <Label>Tělo e-mailu</Label>
                <Textarea
                  ref={bodyRef}
                  value={editForm.body}
                  onChange={e => setEditForm(p => ({ ...p, body: e.target.value }))}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Dostupné placeholdery (kliknutím vložíte)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDERS.map(p => (
                    <Button
                      key={p.key}
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 font-mono"
                      onClick={() => insertPlaceholder(p.key)}
                      title={p.desc}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      {p.key}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Typ triggeru</Label>
                  <Select value={editForm.trigger_type || "none"} onValueChange={v => setEditForm(p => ({ ...p, trigger_type: v === "none" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="Žádný" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Žádný</SelectItem>
                      {TRIGGER_TYPES.map(tt => (
                        <SelectItem key={tt.value} value={tt.value}>{tt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Offset (dny)</Label>
                  <Input
                    type="number"
                    value={editForm.trigger_offset_days}
                    onChange={e => setEditForm(p => ({ ...p, trigger_offset_days: e.target.value }))}
                    placeholder="např. 7"
                  />
                </div>
              </div>
            </TabsContent>
            <TabsContent value="preview" className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Předmět: {renderPreview(editForm.subject)}</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm font-sans">{renderPreview(editForm.body)}</pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>Zrušit</Button>
            <Button onClick={handleSave}>Uložit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Náhled: {previewTemplate?.name}</DialogTitle>
          </DialogHeader>
          {previewTemplate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Předmět: {renderPreview(previewTemplate.subject)}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-sans">{renderPreview(previewTemplate.body)}</pre>
              </CardContent>
            </Card>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
