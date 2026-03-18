import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function replacePlaceholders(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, val] of Object.entries(vars)) {
    result = result.split(`{{${key}}}`).join(val);
  }
  return result;
}

function formatDate(dateString: string): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getFullYear()).slice(-2)}`;
}

async function logEmail(supabase: any, params: { template_id?: string; deal_id?: string; recipient_email: string; status: string }) {
  try {
    await supabase.from("email_log").insert(params);
  } catch (e) {
    console.error("Failed to log email:", e);
  }
}

async function sendEmail(resendApiKey: string, payload: any): Promise<{ ok: boolean; data?: any; error?: any }> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendApiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.ok) {
    return { ok: true, data: await response.json() };
  }
  return { ok: false, error: await response.json() };
}

interface TriggeredResult {
  dealId: string;
  templateKey: string;
  recipient: string;
  success: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Fetch all active templates with a trigger_type (not manual)
    const { data: templates, error: tplError } = await supabase
      .from("email_templates")
      .select("*")
      .eq("is_active", true)
      .not("trigger_type", "is", null)
      .neq("trigger_type", "manual");

    if (tplError) throw tplError;
    if (!templates || templates.length === 0) {
      console.log("[auto-triggered] No active triggered templates found");
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[auto-triggered] Found ${templates.length} active triggered templates`);
    const results: TriggeredResult[] = [];

    for (const template of templates) {
      const offsetDays = template.trigger_offset_days || 0;
      const triggerType = template.trigger_type;

      try {
        if (triggerType === "before_departure") {
          // Find deals where start_date = today + offsetDays
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + offsetDays);
          const targetDateStr = targetDate.toISOString().split("T")[0];

          console.log(`[auto-triggered] ${template.template_key}: looking for deals with start_date=${targetDateStr}`);

          const { data: deals } = await supabase
            .from("deals")
            .select("id, deal_number, start_date, end_date, total_price, destination:destinations(name, country:countries(name))")
            .eq("start_date", targetDateStr)
            .in("status", ["confirmed", "dispatched"]);

          if (!deals || deals.length === 0) continue;

          for (const deal of deals) {
            await processDealEmail(supabase, resendApiKey, template, deal, results);
          }
        } else if (triggerType === "after_return") {
          // Find deals where end_date = today - offsetDays
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() - offsetDays);
          const targetDateStr = targetDate.toISOString().split("T")[0];

          console.log(`[auto-triggered] ${template.template_key}: looking for deals with end_date=${targetDateStr}`);

          const { data: deals } = await supabase
            .from("deals")
            .select("id, deal_number, start_date, end_date, total_price, destination:destinations(name, country:countries(name))")
            .eq("end_date", targetDateStr)
            .in("status", ["dispatched", "completed"]);

          if (!deals || deals.length === 0) continue;

          for (const deal of deals) {
            await processDealEmail(supabase, resendApiKey, template, deal, results);
          }
        } else if (triggerType === "payment_reminder") {
          // Find deal_payments where due_date = today + offsetDays and not paid
          const targetDate = new Date(today);
          targetDate.setDate(targetDate.getDate() + offsetDays);
          const targetDateStr = targetDate.toISOString().split("T")[0];

          console.log(`[auto-triggered] ${template.template_key}: looking for unpaid payments due on ${targetDateStr}`);

          const { data: payments } = await supabase
            .from("deal_payments")
            .select("id, deal_id, amount, due_date, payment_type, deals:deal_id(id, deal_number, start_date, end_date, total_price, destination:destinations(name, country:countries(name)))")
            .eq("due_date", targetDateStr)
            .eq("paid", false);

          if (!payments || payments.length === 0) continue;

          for (const payment of payments) {
            const deal = (payment as any).deals;
            if (!deal) continue;
            await processDealEmail(supabase, resendApiKey, template, deal, results);
          }
        } else if (triggerType === "birthday") {
          // Find clients whose date_of_birth month/day matches today
          const monthDay = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
          console.log(`[auto-triggered] ${template.template_key}: looking for clients with birthday ${monthDay}`);

          const { data: clients } = await supabase
            .from("clients")
            .select("id, first_name, last_name, title, email, date_of_birth")
            .not("email", "is", null)
            .not("date_of_birth", "is", null);

          if (!clients || clients.length === 0) continue;

          for (const client of clients) {
            if (!client.date_of_birth || !client.email) continue;
            const dob = client.date_of_birth; // YYYY-MM-DD
            const dobMonthDay = dob.substring(5); // MM-DD
            if (dobMonthDay !== monthDay) continue;

            // Check if we already sent this template to this email today
            const alreadySent = await checkAlreadySent(supabase, template.id, client.email, todayStr);
            if (alreadySent) continue;

            const vars: Record<string, string> = {
              first_name: client.first_name || "",
              last_name: client.last_name || "",
              destination: "",
              hotel: "",
              date_from: "",
              date_to: "",
              total_price: "",
              voucher_code: "",
              contract_number: "",
              sign_link: "",
            };

            const subject = replacePlaceholders(template.subject, vars);
            const body = replacePlaceholders(template.body, vars);

            const result = await sendEmail(resendApiKey, {
              from: "YARO Travel <radek@yarogolf.cz>",
              to: [client.email],
              bcc: ["zajezdy@yarotravel.cz"],
              subject,
              text: body,
            });

            const status = result.ok ? "sent" : "failed";
            await logEmail(supabase, { template_id: template.id, recipient_email: client.email, status });
            results.push({
              dealId: "",
              templateKey: template.template_key,
              recipient: client.email,
              success: result.ok,
              error: result.ok ? undefined : JSON.stringify(result.error),
            });

            // Insert notification for birthday email
            if (result.ok) {
              try {
                await supabase.from("notifications").insert({
                  event_type: "email_sent",
                  title: `Odesláno přání k narozeninám pro ${client.first_name} ${client.last_name}`,
                  message: `E-mail odeslán na ${client.email}`,
                });
              } catch (e) {
                console.error("Notification insert error:", e);
              }
            }
          }
        }
      } catch (err: any) {
        console.error(`[auto-triggered] Error processing template ${template.template_key}:`, err);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`[auto-triggered] Done. ${successCount}/${results.length} sent successfully`);

    return new Response(
      JSON.stringify({ processed: results.length, successful: successCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[auto-triggered] Fatal error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function checkAlreadySent(supabase: any, templateId: string, email: string, todayStr: string): Promise<boolean> {
  const startOfDay = `${todayStr}T00:00:00.000Z`;
  const endOfDay = `${todayStr}T23:59:59.999Z`;
  const { data } = await supabase
    .from("email_log")
    .select("id")
    .eq("template_id", templateId)
    .eq("recipient_email", email)
    .gte("sent_at", startOfDay)
    .lte("sent_at", endOfDay)
    .limit(1);
  return data && data.length > 0;
}

async function processDealEmail(
  supabase: any,
  resendApiKey: string,
  template: any,
  deal: any,
  results: TriggeredResult[]
) {
  const todayStr = new Date().toISOString().split("T")[0];

  // Get lead traveler
  const { data: travelers } = await supabase
    .from("deal_travelers")
    .select("client_id, is_lead_traveler, clients:client_id(first_name, last_name, email)")
    .eq("deal_id", deal.id)
    .eq("is_lead_traveler", true)
    .limit(1);

  const lead = travelers?.[0] as any;
  const clientEmail = lead?.clients?.email;
  if (!clientEmail) {
    console.log(`[auto-triggered] Deal ${deal.deal_number}: no lead traveler email, skipping`);
    return;
  }

  // Check if already sent today for this template + deal
  const alreadySent = await checkAlreadySent(supabase, template.id, clientEmail, todayStr);
  if (alreadySent) {
    console.log(`[auto-triggered] Deal ${deal.deal_number}: already sent ${template.template_key} today, skipping`);
    return;
  }

  const destination = deal.destination?.name || "";
  const vars: Record<string, string> = {
    first_name: lead?.clients?.first_name || "",
    last_name: lead?.clients?.last_name || "",
    destination,
    hotel: "",
    date_from: deal.start_date ? formatDate(deal.start_date) : "",
    date_to: deal.end_date ? formatDate(deal.end_date) : "",
    total_price: deal.total_price?.toString() || "",
    voucher_code: "",
    contract_number: "",
    sign_link: "",
  };

  // Try to get hotel name from deal services
  const { data: hotelServices } = await supabase
    .from("deal_services")
    .select("service_name")
    .eq("deal_id", deal.id)
    .eq("service_type", "hotel")
    .limit(1);
  if (hotelServices && hotelServices.length > 0) {
    vars.hotel = hotelServices[0].service_name;
  }

  const subject = replacePlaceholders(template.subject, vars);
  const body = replacePlaceholders(template.body, vars);

  const result = await sendEmail(resendApiKey, {
    from: "YARO Travel <radek@yarogolf.cz>",
    to: [clientEmail],
    bcc: ["zajezdy@yarotravel.cz"],
    subject,
    text: body,
  });

  const status = result.ok ? "sent" : "failed";
  await logEmail(supabase, { template_id: template.id, deal_id: deal.id, recipient_email: clientEmail, status });
  results.push({
    dealId: deal.id,
    templateKey: template.template_key,
    recipient: clientEmail,
    success: result.ok,
    error: result.ok ? undefined : JSON.stringify(result.error),
  });

  // Insert notification for triggered email
  if (result.ok) {
    const triggerLabels: Record<string, string> = {
      before_departure: "před odjezdem",
      after_return: "po návratu",
      payment_reminder: "připomenutí platby",
    };
    const label = triggerLabels[template.trigger_type] || template.template_key;
    try {
      await supabase.from("notifications").insert({
        event_type: "email_sent",
        title: `Automatický e-mail (${label}) odeslán pro deal ${deal.deal_number}`,
        message: `Příjemce: ${clientEmail}`,
        deal_id: deal.id,
        link: `/deals/${deal.id}`,
      });
    } catch (e) {
      console.error("Notification insert error:", e);
    }
  }

  console.log(`[auto-triggered] Deal ${deal.deal_number} (${template.template_key}): ${status} -> ${clientEmail}`);
}
