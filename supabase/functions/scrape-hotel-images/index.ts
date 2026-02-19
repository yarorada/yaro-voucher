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

    console.log("Searching images for hotel:", hotelName, "golf:", golfCourseName);

    // Step 1: Search for hotel official website
    const searchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${hotelName} hotel official website`,
        limit: 3,
        scrapeOptions: { formats: ["links", "markdown"] },
      }),
    });

    const searchData = await searchResponse.json();
    console.log("Search results:", JSON.stringify(searchData).substring(0, 500));

    // Step 2: Scrape the top result for images
    const hotelImages: string[] = [];
    
    if (searchData?.data && searchData.data.length > 0) {
      const topUrl = searchData.data[0].url;
      console.log("Scraping hotel URL:", topUrl);

      const scrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: topUrl,
          formats: ["screenshot", "links", "markdown"],
          onlyMainContent: false,
        }),
      });

      const scrapeData = await scrapeResponse.json();
      console.log("Scrape response keys:", Object.keys(scrapeData?.data || scrapeData || {}));

      // Extract image URLs from markdown content
      const content = scrapeData?.data?.markdown || scrapeData?.markdown || "";
      const imgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi;
      let match;
      while ((match = imgRegex.exec(content)) !== null) {
        if (!match[1].includes("icon") && !match[1].includes("logo") && !match[1].includes("favicon")) {
          hotelImages.push(match[1]);
        }
      }

      // Also try to extract from raw links
      const links = scrapeData?.data?.links || scrapeData?.links || [];
      for (const link of links) {
        const linkStr = typeof link === "string" ? link : link?.url || "";
        if (/\.(jpg|jpeg|png|webp)/i.test(linkStr) && 
            !linkStr.includes("icon") && !linkStr.includes("logo") && !linkStr.includes("favicon") &&
            linkStr.length < 500) {
          hotelImages.push(linkStr);
        }
      }

      // Also try plain img tags from markdown
      const imgRegex2 = /(?:src=["'])(https?:\/\/[^\s"']+\.(?:jpg|jpeg|png|webp)[^\s"']*)/gi;
      while ((match = imgRegex2.exec(content)) !== null) {
        if (!match[1].includes("icon") && !match[1].includes("logo")) {
          hotelImages.push(match[1]);
        }
      }
    }

    // Step 3: Search for golf course images if provided
    const golfImages: string[] = [];
    if (golfCourseName) {
      const golfSearchResponse = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: `${golfCourseName} golf course photos`,
          limit: 3,
          scrapeOptions: { formats: ["links", "markdown"] },
        }),
      });

      const golfSearchData = await golfSearchResponse.json();

      if (golfSearchData?.data && golfSearchData.data.length > 0) {
        const golfUrl = golfSearchData.data[0].url;
        console.log("Scraping golf URL:", golfUrl);

        const golfScrapeResponse = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: golfUrl,
            formats: ["links", "markdown"],
            onlyMainContent: false,
          }),
        });

        const golfScrapeData = await golfScrapeResponse.json();
        const golfContent = golfScrapeData?.data?.markdown || golfScrapeData?.markdown || "";

        const golfImgRegex = /!\[.*?\]\((https?:\/\/[^\s)]+\.(?:jpg|jpeg|png|webp)[^\s)]*)\)/gi;
        let gMatch;
        while ((gMatch = golfImgRegex.exec(golfContent)) !== null) {
          if (!gMatch[1].includes("icon") && !gMatch[1].includes("logo")) {
            golfImages.push(gMatch[1]);
          }
        }

        const golfLinks = golfScrapeData?.data?.links || golfScrapeData?.links || [];
        for (const link of golfLinks) {
          const linkStr = typeof link === "string" ? link : link?.url || "";
          if (/\.(jpg|jpeg|png|webp)/i.test(linkStr) && 
              !linkStr.includes("icon") && !linkStr.includes("logo") &&
              linkStr.length < 500) {
            golfImages.push(linkStr);
          }
        }
      }
    }

    // Deduplicate
    const uniqueHotelImages = [...new Set(hotelImages)].slice(0, 12);
    const uniqueGolfImages = [...new Set(golfImages)].slice(0, 8);

    console.log(`Found ${uniqueHotelImages.length} hotel images, ${uniqueGolfImages.length} golf images`);

    return new Response(
      JSON.stringify({
        success: true,
        hotelImages: uniqueHotelImages,
        golfImages: uniqueGolfImages,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error scraping:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Failed to scrape" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
