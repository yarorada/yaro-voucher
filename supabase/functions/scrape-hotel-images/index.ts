import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelName, golfCourseName } = await req.json();

    if (!hotelName) {
      return new Response(
        JSON.stringify({ success: false, error: "Hotel name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Searching images for hotel:", hotelName);

    function extractImgsFromHtml(html: string): string[] {
      const urls: string[] = [];
      const srcRegex = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi;
      let m: RegExpExecArray | null;
      while ((m = srcRegex.exec(html)) !== null) {
        const u = m[1].split("?")[0];
        if (!shouldSkip(u)) urls.push(m[1]);
      }
      const srcsetRegex = /<img[^>]+srcset=["']([^"']+)/gi;
      while ((m = srcsetRegex.exec(html)) !== null) {
        const parts = m[1].split(",").map((s) => s.trim().split(" ")[0]);
        for (const p of parts) {
          if (/\.(jpg|jpeg|png|webp)/i.test(p) && !shouldSkip(p)) urls.push(p);
        }
      }
      const dataSrcRegex = /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi;
      while ((m = dataSrcRegex.exec(html)) !== null) {
        if (!shouldSkip(m[1])) urls.push(m[1]);
      }
      const ogRegex = /<meta[^>]+(?:property=["']og:image["']|name=["']og:image["'])[^>]+content=["']([^"']+)/gi;
      while ((m = ogRegex.exec(html)) !== null) {
        if (/\.(jpg|jpeg|png|webp)/i.test(m[1]) && !shouldSkip(m[1])) urls.push(m[1]);
      }
      return urls;
    }

    function shouldSkip(url: string): boolean {
      const lower = url.toLowerCase();
      return (
        lower.includes("icon") ||
        lower.includes("logo") ||
        lower.includes("favicon") ||
        lower.includes("avatar") ||
        lower.includes("sprite") ||
        lower.includes("1x1") ||
        lower.includes("pixel") ||
        lower.includes("map") ||
        lower.includes("flag") ||
        lower.includes("star") ||
        /[_-](\d{1,2}x\d{1,2})[_.]/.test(lower) ||
        url.length > 600
      );
    }

    function preferLarger(urls: string[]): string[] {
      return [...urls].sort((a, b) => sizeScore(b) - sizeScore(a));
    }

    function sizeScore(url: string): number {
      const hints = ["1920", "1600", "1400", "1280", "1024", "800", "original", "full", "large", "xl", "big"];
      const lower = url.toLowerCase();
      for (let i = 0; i < hints.length; i++) {
        if (lower.includes(hints[i])) return hints.length - i;
      }
      return 0;
    }

    // Wrap fetch calls with a timeout to avoid edge function timeout
    async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 12000): Promise<Response> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }

    async function firecrawlSearch(query: string, limit = 3): Promise<{ url: string; html?: string }[]> {
      try {
        const r = await fetchWithTimeout("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["rawHtml"] } }),
        });
        if (!r.ok) {
          console.error("Firecrawl search error:", r.status, await r.text().catch(() => ""));
          return [];
        }
        const d = await r.json();
        return (d?.data || []).map((item: any) => ({
          url: item.url,
          html: item.rawHtml || "",
        }));
      } catch (e) {
        console.error("Firecrawl search failed:", e instanceof Error ? e.message : e);
        return [];
      }
    }

    // Reduced to 2 parallel searches instead of 4 to stay within timeout
    const [officialResults, bookingResults] = await Promise.allSettled([
      firecrawlSearch(`"${hotelName}" hotel photos gallery`, 3),
      firecrawlSearch(`site:booking.com "${hotelName}"`, 2),
    ]);

    const hotelImages: string[] = [];
    let detectedWebsiteUrl: string | null = null;

    if (officialResults.status === "fulfilled" && officialResults.value.length > 0) {
      const top = officialResults.value[0];
      try {
        const parsedUrl = new URL(top.url);
        if (!parsedUrl.hostname.includes("booking") && !parsedUrl.hostname.includes("tripadvisor")) {
          detectedWebsiteUrl = parsedUrl.origin;
        }
      } catch { /* ignore */ }

      for (const result of officialResults.value) {
        hotelImages.push(...extractImgsFromHtml(result.html || ""));
      }
    }

    if (bookingResults.status === "fulfilled") {
      for (const result of bookingResults.value) {
        const imgs = extractImgsFromHtml(result.html || "");
        const bookingImgs = imgs.filter((u) => u.includes("bstatic") || u.includes("booking"));
        hotelImages.push(...bookingImgs);
      }
    }

    const uniqueHotelImages = preferLarger([...new Set(hotelImages)]).slice(0, 30);

    // Golf course images
    const golfImages: string[] = [];
    if (golfCourseName) {
      const golfResult = await firecrawlSearch(`"${golfCourseName}" golf course photos`, 3).catch(() => []);
      for (const result of golfResult) {
        golfImages.push(...extractImgsFromHtml(result.html || ""));
      }
    }

    const uniqueGolfImages = preferLarger([...new Set(golfImages)]).slice(0, 15);

    console.log(`Found ${uniqueHotelImages.length} hotel images, ${uniqueGolfImages.length} golf images`);

    return new Response(
      JSON.stringify({
        success: true,
        hotelImages: uniqueHotelImages,
        golfImages: uniqueGolfImages,
        detectedWebsiteUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to scrape",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
