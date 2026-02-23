import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const slug = url.searchParams.get("slug");

    // Build query - only published hotels
    let query = supabase
      .from("hotel_templates")
      .select(
        "id, name, slug, subtitle, description, nights, green_fees, price_label, golf_courses, golf_courses_data, benefits, room_types, highlights, is_published, website_url, image_url, image_url_2, image_url_3, image_url_4, image_url_5, image_url_6, image_url_7, image_url_8, image_url_9, image_url_10, destinations:destination_id(name, countries:country_id(name, iso_code))"
      )
      .eq("is_published", true);

    if (slug) {
      query = query.eq("slug", slug).single();
    } else {
      query = query.order("name", { ascending: true });
    }

    const { data, error } = await query;

    if (error) {
      const status = error.code === "PGRST116" ? 404 : 500;
      return new Response(
        JSON.stringify({ error: slug ? "Hotel not found" : "Failed to fetch hotels" }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Transform image_url fields into an images array for cleaner API
    const transformHotel = (hotel: any) => {
      const images: string[] = [];
      for (let i = 0; i <= 10; i++) {
        const key = i === 0 ? "image_url" : `image_url_${i}`;
        if (hotel[key]) images.push(hotel[key]);
      }

      const {
        image_url, image_url_2, image_url_3, image_url_4, image_url_5,
        image_url_6, image_url_7, image_url_8, image_url_9, image_url_10,
        ...rest
      } = hotel;

      const destination_name = rest.destinations?.name || null;
      const country_name = rest.destinations?.countries?.name || null;
      const country_iso = rest.destinations?.countries?.iso_code || null;
      const { destinations, ...clean } = rest;

      return { ...clean, images, destination_name, country_name, country_iso };
    };

    const result = slug
      ? transformHotel(data)
      : (data as any[]).map(transformHotel);

    return new Response(JSON.stringify(result), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300, s-maxage=600",
      },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
