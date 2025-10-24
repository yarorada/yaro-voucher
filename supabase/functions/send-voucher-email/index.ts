import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  voucherId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { voucherId }: SendEmailRequest = await req.json();
    console.log("Sending email for voucher:", voucherId);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch voucher details
    const { data: voucher, error: voucherError } = await supabase
      .from("vouchers")
      .select("*")
      .eq("id", voucherId)
      .single();

    if (voucherError || !voucher) {
      throw new Error("Voucher not found");
    }

    // Fetch travelers
    const { data: travelers, error: travelersError } = await supabase
      .from("voucher_travelers")
      .select("client_id, is_main_client, clients(first_name, last_name, email)")
      .eq("voucher_id", voucherId)
      .order("is_main_client", { ascending: false });

    if (travelersError) {
      throw new Error("Failed to fetch travelers");
    }

    // Fetch supplier
    let supplier = null;
    if (voucher.supplier_id) {
      const { data: supplierData } = await supabase
        .from("suppliers")
        .select("name, contact_person, email, phone, address, notes")
        .eq("id", voucher.supplier_id)
        .single();
      supplier = supplierData;
    }

    // Find main client email
    const mainClient = travelers?.find((t: any) => t.is_main_client);
    const mainClientData = mainClient?.clients as any;
    const clientEmail = mainClientData?.email;
    const clientName = mainClientData
      ? `${mainClientData.first_name} ${mainClientData.last_name}`
      : voucher.client_name;

    if (!clientEmail) {
      throw new Error("Client email not found");
    }

    // Build other travelers list
    const otherTravelers = travelers
      ?.filter((t: any) => !t.is_main_client)
      .map((t: any) => {
        const client = t.clients as any;
        return `${client.first_name} ${client.last_name}`;
      })
      .join(", ");

    // Format dates
    const formatDate = (dateString: string) => {
      if (!dateString) return "N/A";
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = String(date.getFullYear()).slice(-2);
      return `${day}.${month}.${year}`;
    };

    // Build services HTML
    const servicesHtml = voucher.services.map((service: any, index: number) => `
      <tr style="background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'};">
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${service.pax || '—'}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${service.qty || '—'}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb; font-weight: 600;">${service.name}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${formatDate(service.dateFrom)}</td>
        <td style="padding: 12px; border: 1px solid #e5e7eb;">${formatDate(service.dateTo)}</td>
      </tr>
    `).join("");

    // Build HTML email
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Travel Voucher - ${voucher.voucher_code}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f3f4f6;">
          
          <!-- Header -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 32px;">YARO Travel</h1>
            <p style="margin: 10px 0 0; font-size: 16px; opacity: 0.9;">Your Journey, Our Passion</p>
          </div>

          <!-- Voucher Code -->
          <div style="background-color: white; padding: 20px; border-bottom: 4px solid #667eea;">
            <div style="text-align: center;">
              <div style="font-size: 36px; font-weight: bold; color: #667eea; margin-bottom: 5px;">${voucher.voucher_code}</div>
              <p style="color: #6b7280; margin: 0;">Travel Voucher</p>
            </div>
          </div>

          <!-- Service Provider -->
          ${supplier ? `
          <div style="background-color: white; padding: 20px; border-left: 4px solid #667eea; margin-top: 20px;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 16px;">Service Provider:</h3>
            <p style="margin: 5px 0; color: #4b5563;">
              <strong>${supplier.name}</strong>
              ${supplier.address ? `<br>${supplier.address}` : ''}
              ${supplier.email ? `<br>Email: ${supplier.email}` : ''}
              ${supplier.phone ? `<br>Tel: ${supplier.phone}` : ''}
            </p>
            ${supplier.notes ? `<p style="margin: 10px 0 0; padding-top: 10px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">${supplier.notes}</p>` : ''}
          </div>
          ` : ''}

          <!-- Client Information -->
          <div style="background-color: white; padding: 20px; margin-top: 20px;">
            <h2 style="color: #1f2937; font-size: 20px; border-left: 4px solid #10b981; padding-left: 12px; margin-top: 0;">Client Information</h2>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px;">
              <p style="margin: 0 0 10px 0;"><strong>Main Client:</strong> ${clientName}</p>
              ${otherTravelers ? `<p style="margin: 0;"><strong>Other Travelers:</strong> ${otherTravelers}</p>` : ''}
            </div>
          </div>

          <!-- Services -->
          <div style="background-color: white; padding: 20px; margin-top: 20px;">
            <h2 style="color: #1f2937; font-size: 20px; border-left: 4px solid #10b981; padding-left: 12px; margin-top: 0;">Service Overview</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <thead>
                <tr style="background-color: #667eea; color: white;">
                  <th style="padding: 12px; text-align: left; border: 1px solid #4f46e5;">PAX</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #4f46e5;">Qtd.</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #4f46e5;">Service</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #4f46e5;">Date From</th>
                  <th style="padding: 12px; text-align: left; border: 1px solid #4f46e5;">Date To</th>
                </tr>
              </thead>
              <tbody>
                ${servicesHtml}
              </tbody>
            </table>
          </div>

          <!-- Dates -->
          <div style="background-color: white; padding: 20px; margin-top: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px;">
              <p style="margin: 0 0 5px; color: #6b7280; font-size: 14px;">Issue Date</p>
              <p style="margin: 0; font-weight: 600; color: #1f2937;">${formatDate(voucher.issue_date)}</p>
            </div>
            <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px;">
              <p style="margin: 0 0 5px; color: #6b7280; font-size: 14px;">Expiration Date</p>
              <p style="margin: 0; font-weight: 600; color: #1f2937;">${voucher.expiration_date ? formatDate(voucher.expiration_date) : 'No Expiration'}</p>
            </div>
          </div>

          <!-- Company Info -->
          <div style="background-color: white; padding: 20px; margin-top: 20px; border-top: 2px solid #e5e7eb;">
            <div style="background: linear-gradient(to right, rgba(102, 126, 234, 0.1), rgba(16, 185, 129, 0.1)); padding: 20px; border-radius: 8px;">
              <h3 style="margin-top: 0; color: #1f2937;">YARO Travel</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; font-size: 14px; color: #4b5563;">
                <div>
                  <p style="margin: 0 0 5px; font-weight: 600; color: #1f2937;">Address:</p>
                  <p style="margin: 0;">Bratrancu Veverkowych 680</p>
                  <p style="margin: 0;">Pardubice, 530 02</p>
                </div>
                <div>
                  <p style="margin: 0 0 5px; font-weight: 600; color: #1f2937;">Contact:</p>
                  <p style="margin: 0;">Tel.: +420 602 102 108</p>
                  <p style="margin: 0;">Email: zajezdy@yarotravel.cz</p>
                </div>
                <div>
                  <p style="margin: 0 0 5px; font-weight: 600; color: #1f2937;">Website:</p>
                  <p style="margin: 0;">www.yarotravel.cz</p>
                  <p style="margin: 8px 0 0; font-size: 12px;">Available 24/7 for your travel needs</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Terms -->
          <div style="background-color: white; padding: 20px; margin-top: 20px; border-radius: 0 0 10px 10px;">
            <p style="font-size: 12px; color: #6b7280; margin: 0;"><strong style="color: #1f2937;">Terms & Conditions:</strong> This voucher is valid for the services listed above. Please present this voucher to service providers. Changes or cancellations must be made 48 hours in advance. For assistance, contact YARO Travel support.</p>
          </div>

        </body>
      </html>
    `;

    // Send emails
    const recipients = [clientEmail];
    if (supplier?.email) {
      recipients.push(supplier.email);
    }

    console.log("Sending email to:", recipients);

    // Send email via Resend API
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "YARO Travel <onboarding@resend.dev>",
        to: recipients,
        subject: `Travel Voucher ${voucher.voucher_code} - YARO Travel`,
        html: html,
      }),
    });

    if (!resendResponse.ok) {
      const errorData = await resendResponse.json();
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    const emailResponse = await resendResponse.json();
    console.log("Email sent successfully:", emailResponse);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        recipients: recipients 
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
