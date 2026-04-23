// UCTO výstup — Etapa 3
// Pošle účetnímu mail s odkazem na ZIP balíček uložený v privátním bucketu.
// Frontend ZIP nahraje sám, edge function jen vygeneruje signed URL (30 dní),
// odešle mail přes Resend a zapíše audit do accounting_batches.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Summary = {
  issued_count: number;
  received_count: number;
  contracts_count: number;
  issued_total: number;
  received_total: number;
  contracts_total: number;
  currency: string;
};

type Payload = {
  batch_id: string;
  folder_name: string;
  zip_path: string;          // např. "<uid>/UCTO_2026-04_duben-2026.zip"
  zip_size_bytes?: number;
  recipient_email: string;
  notes?: string;
  summary: Summary;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const payload = (await req.json()) as Payload;

    if (!payload.batch_id || !payload.folder_name || !payload.zip_path || !payload.recipient_email) {
      return json({ error: "Missing batch_id, folder_name, zip_path or recipient_email" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

    // Authentikuj uživatele přes Authorization header (anon klient)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing Authorization header" }, 401);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const userId = userData.user.id;

    // Service-role klient pro storage signed URL + zápis auditu
    const admin = createClient(supabaseUrl, serviceKey);

    // Ověř, že dávka patří uživateli
    const { data: batch, error: batchErr } = await admin
      .from("accounting_batches")
      .select("id, user_id, period, label")
      .eq("id", payload.batch_id)
      .single();
    if (batchErr || !batch) return json({ error: "Batch not found" }, 404);
    if (batch.user_id !== userId) return json({ error: "Forbidden" }, 403);

    // Ověř, že ZIP path začíná uživatelovým UID
    if (!payload.zip_path.startsWith(`${userId}/`)) {
      return json({ error: "ZIP path mismatch" }, 403);
    }

    // 30-denní signed URL
    const expiresIn = 60 * 60 * 24 * 30;
    const { data: signed, error: signedErr } = await admin.storage
      .from("ucto-archives")
      .createSignedUrl(payload.zip_path, expiresIn);
    if (signedErr || !signed?.signedUrl) {
      console.error("Signed URL error:", signedErr);
      return json({ error: "Failed to create signed URL" }, 500);
    }

    const html = buildEmailHtml({
      folderName: payload.folder_name,
      label: batch.label || batch.period,
      downloadUrl: signed.signedUrl,
      summary: payload.summary,
      notes: payload.notes,
      sizeBytes: payload.zip_size_bytes,
    });

    const subject = `Účetní podklady – ${batch.label || payload.folder_name}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "YARO Travel <radek@yarogolf.cz>",
        to: [payload.recipient_email],
        bcc: ["zajezdy@yarotravel.cz"],
        subject,
        html,
      }),
    });

    const emailResult = await emailResponse.json();
    if (!emailResponse.ok) {
      console.error("Resend error:", emailResult);
      return json({ error: "Failed to send email", details: emailResult }, 500);
    }

    // Audit
    await admin
      .from("accounting_batches")
      .update({
        sent_to_accountant_at: new Date().toISOString(),
        sent_to_accountant_email: payload.recipient_email,
        sent_zip_path: payload.zip_path,
        sent_zip_size_bytes: payload.zip_size_bytes ?? null,
      })
      .eq("id", payload.batch_id);

    return json({ success: true, signed_url: signed.signedUrl });
  } catch (err) {
    console.error("send-ucto-to-accountant error:", err);
    return json({ error: (err as Error).message ?? "Unexpected error" }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fmtCZK(n: number, currency = "CZK"): string {
  if (typeof n !== "number" || isNaN(n)) return "—";
  return new Intl.NumberFormat("cs-CZ", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

function fmtSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return "";
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return ` (${Math.round(bytes / 1024)} kB)`;
  return ` (${mb.toFixed(1)} MB)`;
}

function buildEmailHtml(args: {
  folderName: string;
  label: string;
  downloadUrl: string;
  summary: Summary;
  notes?: string;
  sizeBytes?: number;
}): string {
  const { folderName, label, downloadUrl, summary, notes, sizeBytes } = args;
  const c = summary.currency || "CZK";
  return `
<!DOCTYPE html>
<html>
  <body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;line-height:1.5;background:#f6f7f9;margin:0;padding:24px">
    <div style="max-width:620px;margin:0 auto;background:#fff;padding:28px;border-radius:8px;border:1px solid #e5e7eb">
      <h2 style="margin:0 0 8px;color:#0f172a">Účetní podklady – ${escapeHtml(label)}</h2>
      <p style="margin:0 0 16px;color:#475569">
        Dobrý den, posílám účetní podklady za období <b>${escapeHtml(label)}</b>.
      </p>

      <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:13px">
        <tr><td style="padding:6px 0;color:#64748b">Vystavené faktury</td><td style="padding:6px 0;text-align:right"><b>${summary.issued_count}</b> ks · ${fmtCZK(summary.issued_total, c)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Přijaté faktury</td><td style="padding:6px 0;text-align:right"><b>${summary.received_count}</b> ks · ${fmtCZK(summary.received_total, c)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b">Smlouvy</td><td style="padding:6px 0;text-align:right"><b>${summary.contracts_count}</b> ks · ${fmtCZK(summary.contracts_total, c)}</td></tr>
      </table>

      <p style="margin:20px 0">
        <a href="${downloadUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600">
          Stáhnout ZIP balíček${fmtSize(sizeBytes)}
        </a>
      </p>

      <p style="margin:8px 0 0;color:#64748b;font-size:12px">
        Odkaz je platný 30 dní. Soubor: <code>${escapeHtml(folderName)}.zip</code><br>
        V archivu najdete <b>vystavené faktury</b> (PDF), <b>přijaté faktury</b> (originály),
        <b>smlouvy</b> (PDF) a souhrnný <b>prehled.csv</b>.
      </p>

      ${notes ? `<div style="margin-top:20px;padding:12px;background:#fef3c7;border-left:3px solid #f59e0b;font-size:13px"><b>Poznámka:</b><br>${escapeHtml(notes).replace(/\n/g, "<br>")}</div>` : ""}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
      <p style="margin:0;color:#94a3b8;font-size:12px">
        S pozdravem,<br>
        YARO Travel · radek@yarogolf.cz · +420 602 102 108
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}
