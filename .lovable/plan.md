

# Nahrazeni Firecrawl image search za Google Custom Search API

## Co se zmeni

Aktualne funkce `search-hotel-info` pouziva Firecrawl pro vyhledavani fotek hotelu v sekci "Fotky z vyhledavani". Nahradime to Google Custom Search JSON API, ktere je spolehlivejsi pro hledani obrazku a nabizi 100 dotazu denne zdarma.

## Potrebne kroky

### 1. Vytvoreni Google Custom Search Engine a ziskani klicu

Budete potrebovat dva udaje od Google:
- **API Key** - ziskate v Google Cloud Console (console.cloud.google.com) pod "APIs & Services" > "Credentials"
- **Search Engine ID (CX)** - vytvorite v Programmable Search Engine (programmablesearchengine.google.com), nastavte "Search the entire web" a zapnete "Image search"

Oba udaje ulozime bezpecne do backendu jako secrets: `GOOGLE_CSE_API_KEY` a `GOOGLE_CSE_CX`.

### 2. Uprava edge funkce `search-hotel-info`

Nahradime Firecrawl image search za Google Custom Search API:
- Endpoint: `https://www.googleapis.com/customsearch/v1`
- Parametry: `key`, `cx`, `q` (nazev hotelu + "hotel photos"), `searchType=image`, `num=10`
- API vraci primo pole `items` s polem `link` (prima URL obrazku) - zadne parsovani markdown
- Vyfiltrujeme male obrazky (API vraci i `image.width` a `image.height`)

### 3. Zadne zmeny ve frontendu

Komponenta `HotelImageUpload.tsx` uz zpracovava pole `imageUrls` z odpovedi `search-hotel-info` - format odpovedi zustane stejny, takze frontend se nemeni.

## Technicke detaily

### Google Custom Search API volani

```text
GET https://www.googleapis.com/customsearch/v1
  ?key=API_KEY
  &cx=SEARCH_ENGINE_ID
  &q=Hotel+Name+hotel+photos
  &searchType=image
  &num=10
  &imgSize=large
```

Odpoved obsahuje pole `items`, kazda polozka ma:
- `link` - prima URL obrazku
- `image.width`, `image.height` - rozmery
- `image.thumbnailLink` - nahled

### Zmeny v `search-hotel-info/index.ts`

- Odstraneni celeho bloku s Firecrawl API volanim (radky 131-193)
- Nahrazeni za jednoduchy GET request na Google Custom Search API
- Filtrovani vysledku: vylouceni malych obrazku (< 300px), ikon, log
- Zachovani stejneho response formatu `{ success, description, imageUrls }`

### Cena

- **Zdarma**: 100 dotazu/den (pro vase pouziti bohat staci)
- Nad 100 dotazu: $5 za 1000 dotazu (volitelne)

## Souhrn zmen

| Soubor | Zmena |
|--------|-------|
| Secrets | Pridat `GOOGLE_CSE_API_KEY` a `GOOGLE_CSE_CX` |
| `supabase/functions/search-hotel-info/index.ts` | Nahradit Firecrawl image search za Google CSE |

