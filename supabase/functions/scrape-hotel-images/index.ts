import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { hotelName, golfCourseName, websiteUrl } = await req.json();

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

    console.log("Searching images for hotel:", hotelName, "websiteUrl:", websiteUrl || "none");

    // --- URL upgrade: convert thumbnail URLs to high-res versions ---
    function upgradeUrl(url: string): string {
      let u = url;
      // Booking.com: /max500/ → /max1920x1080/
      u = u.replace(/\/max\d+(?:x\d+)?\//, "/max1920x1080/");
      // WordPress thumbnails: -150x150.jpg → .jpg
      u = u.replace(/-\d{2,4}x\d{2,4}(\.(jpg|jpeg|png|webp))/i, "$1");
      // Cloudinary: /w_400/ → /w_1920,q_auto/
      u = u.replace(/\/w_\d+(?:,h_\d+)?(?:,c_\w+)?(?:,q_\w+)?\//, "/w_1920,q_auto/");
      // Cloudinary: /t_thumb/ or /t_small/ → remove transform
      u = u.replace(/\/t_(?:thumb|small|medium|square)\//i, "/");
      return u;
    }

    // --- Helpers ---
    function extractImgsFromHtml(html: string): string[] {
      const urls: string[] = [];

      // Standard src
      const srcRegex = /<img[^>]+src=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/gi;
      let m: RegExpExecArray | null;
      while ((m = srcRegex.exec(html)) !== null) {
        if (!shouldSkip(m[1])) urls.push(upgradeUrl(m[1]));
      }

      // srcset — pick highest resolution
      const srcsetRegex = /<img[^>]+srcset=["']([^"']+)/gi;
      while ((m = srcsetRegex.exec(html)) !== null) {
        const entries = m[1].split(",").map((s) => s.trim());
        let bestUrl = "";
        let bestW = 0;
        for (const entry of entries) {
          const parts = entry.split(/\s+/);
          const entryUrl = parts[0];
          const descriptor = parts[1] || "";
          const wMatch = descriptor.match(/^(\d+)w$/);
          const w = wMatch ? parseInt(wMatch[1]) : 0;
          if (w > bestW) {
            bestW = w;
            bestUrl = entryUrl;
          }
        }
        if (bestUrl && /\.(jpg|jpeg|png|webp)/i.test(bestUrl) && !shouldSkip(bestUrl)) {
          urls.push(upgradeUrl(bestUrl));
        }
        // Also add all srcset entries as fallback
        for (const entry of entries) {
          const entryUrl = entry.split(/\s+/)[0];
          if (/\.(jpg|jpeg|png|webp)/i.test(entryUrl) && !shouldSkip(entryUrl) && entryUrl !== bestUrl) {
            urls.push(upgradeUrl(entryUrl));
          }
        }
      }

      // data-src, data-original, data-lazy-src, data-hi-res
      const lazyAttrs = ["data-src", "data-original", "data-lazy-src", "data-hi-res", "data-zoom-image", "data-large"];
      for (const attr of lazyAttrs) {
        const lazyRegex = new RegExp(`${attr}=["']([^"']+\\.(?:jpg|jpeg|png|webp)[^"']*)`, "gi");
        while ((m = lazyRegex.exec(html)) !== null) {
          if (!shouldSkip(m[1])) urls.push(upgradeUrl(m[1]));
        }
      }

      // OG image
      const ogRegex = /<meta[^>]+(?:property=["']og:image["']|name=["']og:image["'])[^>]+content=["']([^"']+)/gi;
      while ((m = ogRegex.exec(html)) !== null) {
        if (/\.(jpg|jpeg|png|webp)/i.test(m[1]) && !shouldSkip(m[1])) urls.push(upgradeUrl(m[1]));
      }

      // CSS background-image
      const bgRegex = /background(?:-image)?\s*:\s*url\(["']?([^"')]+\.(?:jpg|jpeg|png|webp)[^"')]*)/gi;
      while ((m = bgRegex.exec(html)) !== null) {
        if (!shouldSkip(m[1])) urls.push(upgradeUrl(m[1]));
      }

      return urls;
    }

    function shouldSkip(url: string): boolean {
      const lower = url.toLowerCase();
      return (
        lower.includes("icon") || lower.includes("logo") || lower.includes("favicon") ||
        lower.includes("avatar") || lower.includes("sprite") || lower.includes("1x1") ||
        lower.includes("pixel") || lower.includes("map") || lower.includes("flag") ||
        lower.includes("star") || lower.includes("_thumb") || lower.includes("_small") ||
        lower.includes("/thumb/") || lower.includes("/small/") || lower.includes("placeholder") ||
        lower.includes("spacer") || lower.includes("blank.") || lower.includes("loading") ||
        /[_-](\d{1,2}x\d{1,2})[_.]/.test(lower) || url.length > 600
      );
    }

    function preferLarger(urls: string[]): string[] {
      return [...urls].sort((a, b) => sizeScore(b) - sizeScore(a));
    }

    function sizeScore(url: string): number {
      const hints = ["1920", "1600", "1400", "1280", "1024", "800", "original", "full", "large", "xl", "big", "hi-res", "hires"];
      const lower = url.toLowerCase();
      let score = 0;
      for (let i = 0; i < hints.length; i++) {
        if (lower.includes(hints[i])) {
          score = Math.max(score, hints.length - i);
        }
      }
      // Penalize known small patterns
      if (/(?:_|\/)(?:xs|sm|tiny|mini|micro)\b/i.test(lower)) score -= 5;
      if (/\/(?:100|150|200|250|300)(?:x|\/)/i.test(lower)) score -= 3;
      return score;
    }

    async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 15000): Promise<Response> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        return await fetch(url, { ...options, signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
    }

    async function firecrawlScrape(url: string): Promise<string> {
      try {
        const r = await fetchWithTimeout("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false }),
        });
        if (!r.ok) {
          console.error("Firecrawl scrape error:", r.status);
          return "";
        }
        const d = await r.json();
        return d?.data?.rawHtml || d?.rawHtml || "";
      } catch (e) {
        console.error("Firecrawl scrape failed:", e instanceof Error ? e.message : e);
        return "";
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
          console.error("Firecrawl search error:", r.status);
          return [];
        }
        const d = await r.json();
        return (d?.data || []).map((item: any) => ({ url: item.url, html: item.rawHtml || "" }));
      } catch (e) {
        console.error("Firecrawl search failed:", e instanceof Error ? e.message : e);
        return [];
      }
    }

    const hotelImages: string[] = [];
    let detectedWebsiteUrl: string | null = websiteUrl || null;

    // ====== PHASE 1: Official website (highest priority) ======
    if (websiteUrl) {
      console.log("Phase 1: Scraping official website:", websiteUrl);
      const galleryPaths = ["/gallery", "/photos", "/images", "/galerie", "/fotky", "/photo-gallery", "/media"];
      const pagesToScrape = [websiteUrl, ...galleryPaths.map(p => websiteUrl.replace(/\/+$/, "") + p)];

      const results = await Promise.allSettled(
        pagesToScrape.slice(0, 4).map(url => firecrawlScrape(url))
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          hotelImages.push(...extractImgsFromHtml(r.value));
        }
      }
      console.log(`Phase 1: Found ${hotelImages.length} images from official website`);
    } else {
      console.log("Phase 1: Searching for official website");
      const officialResults = await firecrawlSearch(`"${hotelName}" hotel official website`, 2);
      if (officialResults.length > 0) {
        const top = officialResults[0];
        try {
          const parsed = new URL(top.url);
          if (!parsed.hostname.includes("booking") && !parsed.hostname.includes("tripadvisor")) {
            detectedWebsiteUrl = parsed.origin;
            console.log("Detected official website:", detectedWebsiteUrl);
          }
        } catch { /* ignore */ }
        for (const result of officialResults) {
          hotelImages.push(...extractImgsFromHtml(result.html || ""));
        }
      }
      console.log(`Phase 1: Found ${hotelImages.length} images from search`);
    }

    // ====== PHASE 2: Booking.com ======
    console.log("Phase 2: Searching Booking.com");
    const bookingResults = await firecrawlSearch(`site:booking.com "${hotelName}"`, 2);
    for (const result of bookingResults) {
      const imgs = extractImgsFromHtml(result.html || "");
      const bookingImgs = imgs.filter((u) => u.includes("bstatic") || u.includes("booking"));
      hotelImages.push(...bookingImgs);
    }
    console.log(`Phase 2: Total images so far: ${hotelImages.length}`);

    // ====== PHASE 3: General fallback (only if we have few images) ======
    if (new Set(hotelImages).size < 10) {
      console.log("Phase 3: General search fallback");
      const generalResults = await firecrawlSearch(`${hotelName} hotel photos rooms exterior`, 3);
      for (const result of generalResults) {
        hotelImages.push(...extractImgsFromHtml(result.html || ""));
      }
      console.log(`Phase 3: Total images so far: ${hotelImages.length}`);
    }

    const uniqueHotelImages = preferLarger([...new Set(hotelImages)]).slice(0, 30);

    // --- Golf course images ---
    const golfImages: string[] = [];
    if (golfCourseName) {
      console.log("Searching golf images for:", golfCourseName);
      const golfResult = await firecrawlSearch(`"${golfCourseName}" golf course photos`, 3).catch(() => []);
      for (const result of golfResult) {
        golfImages.push(...extractImgsFromHtml(result.html || ""));
      }
    }
    const uniqueGolfImages = preferLarger([...new Set(golfImages)]).slice(0, 15);

    console.log(`Done: ${uniqueHotelImages.length} hotel images, ${uniqueGolfImages.length} golf images`);

    return new Response(
      JSON.stringify({
        success: true,
        hotelImages: uniqueHotelImages,
        golfImages: uniqueGolfImages,
        detectedWebsiteUrl: detectedWebsiteUrl,
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
