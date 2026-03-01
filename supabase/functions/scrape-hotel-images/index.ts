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

    // Helper: extract image URLs from rawHtml using <img src> and srcset
    function extractImgsFromHtml(html: string): string[] {
      const urls: string[] = [];
      // <img src="...">
      const srcRegex = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi;
      let m: RegExpExecArray | null;
      while ((m = srcRegex.exec(html)) !== null) {
        const u = m[1].split("?")[0];
        if (!shouldSkip(u)) urls.push(m[1]);
      }
      // srcset="url1 1x, url2 2x"
      const srcsetRegex = /<img[^>]+srcset=["']([^"']+)/gi;
      while ((m = srcsetRegex.exec(html)) !== null) {
        const parts = m[1].split(",").map((s) => s.trim().split(" ")[0]);
        for (const p of parts) {
          if (/\.(jpg|jpeg|png|webp)/i.test(p) && !shouldSkip(p)) urls.push(p);
        }
      }
      // data-src (lazy loaded)
      const dataSrcRegex = /data-src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi;
      while ((m = dataSrcRegex.exec(html)) !== null) {
        if (!shouldSkip(m[1])) urls.push(m[1]);
      }
      // og:image meta
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
        // Skip obviously tiny thumbnails by URL pattern
        /[_-](\d{1,2}x\d{1,2})[_.]/.test(lower) ||
        url.length > 600
      );
    }

    // Prefer larger images: sort by hints in URL
    function preferLarger(urls: string[]): string[] {
      return [...urls].sort((a, b) => {
        const scoreA = sizeScore(a);
        const scoreB = sizeScore(b);
        return scoreB - scoreA;
      });
    }

    function sizeScore(url: string): number {
      // Higher resolution hints
      const hints = ["1920", "1600", "1400", "1280", "1024", "800", "original", "full", "large", "xl", "big"];
      const lower = url.toLowerCase();
      for (let i = 0; i < hints.length; i++) {
        if (lower.includes(hints[i])) return hints.length - i;
      }
      return 0;
    }

    async function firecrawlScrape(url: string): Promise<{ html: string; links: string[] }> {
      const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url, formats: ["rawHtml", "links"], onlyMainContent: false }),
      });
      const d = await r.json();
      const html = d?.data?.rawHtml || d?.rawHtml || "";
      const links: string[] = (d?.data?.links || d?.links || []).map((l: any) =>
        typeof l === "string" ? l : l?.url || ""
      );
      return { html, links };
    }

    async function firecrawlSearch(query: string, limit = 5): Promise<{ url: string; html?: string }[]> {
      const r = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["rawHtml"] } }),
      });
      const d = await r.json();
      return (d?.data || []).map((item: any) => ({
        url: item.url,
        html: item.rawHtml || "",
      }));
    }

    // --- Run parallel searches ---
    const [
      officialResults,
      bookingResults,
      tripadvisorResults,
      googleResults,
    ] = await Promise.allSettled([
      // 1. Official website via search
      firecrawlSearch(`"${hotelName}" hotel official site photos gallery`, 3),
      // 2. Booking.com
      firecrawlSearch(`site:booking.com "${hotelName}" photos`, 2),
      // 3. TripAdvisor
      firecrawlSearch(`site:tripadvisor.com "${hotelName}" photos`, 2),
      // 4. General image search
      firecrawlSearch(`${hotelName} hotel rooms exterior photos gallery`, 4),
    ]);

    const hotelImages: string[] = [];
    let detectedWebsiteUrl: string | null = null;

    // Process official website — scrape top result's full page
    if (officialResults.status === "fulfilled" && officialResults.value.length > 0) {
      const top = officialResults.value[0];
      try {
        const parsedUrl = new URL(top.url);
        // Avoid booking.com/tripadvisor as "official"
        if (!parsedUrl.hostname.includes("booking") && !parsedUrl.hostname.includes("tripadvisor")) {
          detectedWebsiteUrl = parsedUrl.origin;
        }
      } catch { /* ignore */ }

      for (const result of officialResults.value) {
        const imgs = extractImgsFromHtml(result.html || "");
        hotelImages.push(...imgs);
      }

      // Also scrape top result's gallery page if we found the base URL
      if (detectedWebsiteUrl) {
        const gallerySuffixes = ["/gallery", "/photos", "/images", "/galerie", "/fotky"];
        const galleryAttempts = gallerySuffixes.slice(0, 2).map((suffix) =>
          firecrawlScrape(detectedWebsiteUrl! + suffix).then(({ html }) => {
            const imgs = extractImgsFromHtml(html);
            hotelImages.push(...imgs);
          }).catch(() => {})
        );
        await Promise.allSettled(galleryAttempts);
      }
    }

    // Process Booking.com results
    if (bookingResults.status === "fulfilled") {
      for (const result of bookingResults.value) {
        const imgs = extractImgsFromHtml(result.html || "");
        // Booking.com uses bstatic.com for images
        const bookingImgs = imgs.filter((u) => u.includes("bstatic") || u.includes("booking"));
        hotelImages.push(...bookingImgs);
        // Also try full page scrape of booking.com hotel page
        if (result.url.includes("booking.com/hotel")) {
          const { html } = await firecrawlScrape(result.url).catch(() => ({ html: "", links: [] }));
          const full = extractImgsFromHtml(html);
          hotelImages.push(...full.filter((u) => u.includes("bstatic") || u.includes("booking")));
        }
      }
    }

    // Process TripAdvisor results
    if (tripadvisorResults.status === "fulfilled") {
      for (const result of tripadvisorResults.value) {
        const imgs = extractImgsFromHtml(result.html || "");
        // TripAdvisor uses media-cdn.tripadvisor.com
        const taImgs = imgs.filter((u) => u.includes("tripadvisor") || u.includes("media-cdn") || u.includes("ta-cdn"));
        hotelImages.push(...taImgs);
      }
    }

    // Process general search results
    if (googleResults.status === "fulfilled") {
      for (const result of googleResults.value) {
        const imgs = extractImgsFromHtml(result.html || "");
        hotelImages.push(...imgs);
      }
    }

    // Deduplicate and prioritize larger images
    const uniqueHotelImages = preferLarger([...new Set(hotelImages)]).slice(0, 30);

    // --- Golf course images ---
    const golfImages: string[] = [];
    if (golfCourseName) {
      const [golfOfficial, golfSearch] = await Promise.allSettled([
        firecrawlSearch(`"${golfCourseName}" golf course official website photos`, 2),
        firecrawlSearch(`${golfCourseName} golf course holes fairway photos`, 3),
      ]);

      for (const res of [golfOfficial, golfSearch]) {
        if (res.status === "fulfilled") {
          for (const result of res.value) {
            golfImages.push(...extractImgsFromHtml(result.html || ""));
          }
        }
      }
    }

    const uniqueGolfImages = preferLarger([...new Set(golfImages)]).slice(0, 15);

    console.log(
      `Found ${uniqueHotelImages.length} hotel images, ${uniqueGolfImages.length} golf images`
    );

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
