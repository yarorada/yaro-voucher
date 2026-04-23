// UCTO výstup — Etapa 4
// Karta pro nahrávání bankovních výpisů (Moneta, Amnis, jiné) do měsíční složky.

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { Upload, Trash2, FileText, Landmark, Loader2 } from "lucide-react";

export type BankStatement = {
  id: string;
  period: string;
  bank: string;
  file_url: string;
  file_name: string;
  file_size_bytes: number | null;
  uploaded_at: string;
  accounting_batch_id: string | null;
};

const BANK_LABELS: Record<string, string> = {
  moneta: "Moneta",
  amnis: "Amnis",
  other: "Jiná banka",
};

function fmtSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BankStatementsCard({ period }: { period: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [bank, setBank] = useState<string>("moneta");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: statements = [] } = useQuery({
    queryKey: ["ucto-bank-statements", period],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("bank_statements")
        .select("*")
        .eq("period", period)
        .is("accounting_batch_id", null)
        .order("uploaded_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BankStatement[];
    },
    enabled: !!user,
  });

  const uploadFiles = async (files: FileList | File[]) => {
    if (!user) return;
    const list = Array.from(files);
    if (list.length === 0) return;

    setUploading(true);
    try {
      for (const file of list) {
        const safeBank = bank.replace(/[^a-z]/g, "");
        const cleanName = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${user.id}/${period}/${safeBank}_${Date.now()}_${cleanName}`;

        const { error: upErr } = await supabase.storage
          .from("bank-statements")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw new Error(`Nahrání selhalo: ${upErr.message}`);

        const { data: pub } = supabase.storage.from("bank-statements").getPublicUrl(path);
        // bucket je privátní → URL nepoužitelné publicly, ale uložíme storage referenci
        // (parser v ZIP builderu si stáhne přes storage API)
        const fileUrl = pub.publicUrl;

        const { error: insErr } = await (supabase as any).from("bank_statements").insert({
          user_id: user.id,
          period,
          bank,
          file_url: fileUrl,
          file_name: file.name,
          file_size_bytes: file.size,
        });
        if (insErr) throw new Error(`Záznam selhal: ${insErr.message}`);
      }
      toast.success(`Nahráno ${list.length} ${list.length === 1 ? "výpis" : list.length < 5 ? "výpisy" : "výpisů"}`);
      qc.invalidateQueries({ queryKey: ["ucto-bank-statements"] });
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "Nahrání selhalo");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (s: BankStatement) => {
      // 1) smaž záznam
      const { error: delErr } = await (supabase as any).from("bank_statements").delete().eq("id", s.id);
      if (delErr) throw delErr;
      // 2) zkus smazat soubor (best-effort)
      const m = s.file_url.match(/\/storage\/v1\/object\/(?:public|sign)\/bank-statements\/(.+)$/);
      if (m) {
        const path = decodeURIComponent(m[1].split("?")[0]);
        await supabase.storage.from("bank-statements").remove([path]);
      }
    },
    onSuccess: () => {
      toast.success("Výpis smazán");
      qc.invalidateQueries({ queryKey: ["ucto-bank-statements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Landmark className="h-4 w-4 text-blue-600" />
          Bankovní výpisy
          {statements.length > 0 && (
            <Badge variant="secondary" className="text-xs ml-2">
              {statements.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          className="border-2 border-dashed rounded-md p-4 text-center hover:bg-muted/40 transition-colors cursor-pointer"
          onDragOver={(e) => {
            e.preventDefault();
            e.currentTarget.classList.add("bg-muted/60");
          }}
          onDragLeave={(e) => e.currentTarget.classList.remove("bg-muted/60")}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.classList.remove("bg-muted/60");
            if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
          }}
          onClick={() => fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.csv,.xml,.xlsx,.xls,.txt,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => e.target.files && uploadFiles(e.target.files)}
          />
          {uploading ? (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Nahrávám…
            </div>
          ) : (
            <>
              <Upload className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm">
                <span className="font-medium text-primary">Klikni</span> nebo přetáhni soubory
              </p>
              <p className="text-xs text-muted-foreground mt-1">PDF, CSV, XML, XLSX, JPG…</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Banka pro nahrání:</span>
          <Select value={bank} onValueChange={setBank}>
            <SelectTrigger className="w-40 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="moneta">Moneta</SelectItem>
              <SelectItem value="amnis">Amnis</SelectItem>
              <SelectItem value="other">Jiná banka</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {statements.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {statements.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-2 text-sm py-1.5 px-2 rounded bg-muted/40"
              >
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Badge variant="outline" className="text-[10px] uppercase">
                  {BANK_LABELS[s.bank] || s.bank}
                </Badge>
                <span className="truncate flex-1" title={s.file_name}>
                  {s.file_name}
                </span>
                <span className="text-xs text-muted-foreground">{fmtSize(s.file_size_bytes)}</span>
                <span className="text-xs text-muted-foreground hidden md:inline">
                  {format(new Date(s.uploaded_at), "d.M.")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => deleteMutation.mutate(s)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
