

# Vylepšení vyhledávání informací o hotelu pomocí Perplexity

## Co se změní

Současný přístup používá Firecrawl pro vše (fotky i popis). Nový přístup rozdělí úlohy:

- **Perplexity** -- vyhledání a syntéza popisu hotelu z více zdrojů, překlad do češtiny
- **Firecrawl** -- zůstane pouze pro scraping fotek z oficiálního webu hotelu

## Postup

### 1. Připojení Perplexity konektoru
- Použije se connector `perplexity` pro získání API klíče
- Klíč bude dostupný jako `PERPLEXITY_API_KEY` v edge functions

### 2. Nová edge funkce `search-hotel-info`
- Zavolá Perplexity API (`sonar` model) s dotazem typu: "Napiš stručný popis hotelu {název} pro golfové cestovatele. Zaměř se na polohu, vybavení, kvalitu pokojů, stravování a blízkost golfových hřišť."
- Druhý dotaz pro vyhledání URL obrázků hotelu (jako záloha k Firecrawlu)
- Výstup přeloží do češtiny pomocí Lovable AI (Gemini flash-lite) -- stejně jako nyní
- Vrátí strukturovaný popis hotelu

### 3. Úprava `scrape-hotel-images` edge funkce
- Odstraní se logika pro generování popisu (Firecrawl search + markdown parsing + AI překlad)
- Funkce se zaměří pouze na hledání a extrakci obrázků

### 4. Úprava `HotelImageUpload.tsx`
- Tlačítko "Najít fotky z webu" zůstane -- volá Firecrawl pro fotky
- Tlačítko "Popis hotelu" se změní na "Vygenerovat popis" -- volá novou Perplexity funkci
- Popis se automaticky vygeneruje při auto-scrape (nový hotel)
- Obě akce (fotky + popis) se spustí paralelně při vytvoření nového hotelu

## Technické detaily

### Edge funkce `search-hotel-info`
```
POST /search-hotel-info
Body: { hotelName: string, golfCourseName?: string }
Response: { success: true, description: string }
```

Perplexity prompt bude v češtině a zaměřený na golfové cestovatele (cílová skupina aplikace). Model `sonar` prohledá web a vrátí syntetizovaný popis z více zdrojů.

Následně se popis přeloží do češtiny přes Lovable AI (Gemini flash-lite), pokud Perplexity vrátí anglický text.

### Změny ve stávajícím `scrape-hotel-images`
- Smazání kroků: search description z markdown, AI překlad popisu
- Ponechání: search + scrape fotek z webu hotelu a golfu
- Funkce bude jednodušší a rychlejší

### Změny v UI (`HotelImageUpload`)
- Při auto-scrape se spustí obě funkce paralelně (Promise.all)
- Nové tlačítko "Vygenerovat popis" vedle tlačítka "Najít fotky z webu"
- Loader indikátor zvlášť pro fotky a zvlášť pro popis

