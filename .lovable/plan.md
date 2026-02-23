
# Upscale fotek pri ukladani z webu

## Problem
Fotky stazene z webu jsou casto male thumbnaily (napr. 200x150px, 20KB). Pri ukladani do databaze je potreba zajistit minimalni kvalitu 1024x1024px a 300KB.

## Reseni

### 1. Nova funkce `ensureMinimumQuality` v `src/lib/imageCompression.ts`
- Prijme blob obrazku a zkontroluje jeho rozmery
- Pokud je obrazek mensi nez 1024px na sirku nebo vysku, upscaluje ho pomoci canvas na minimalne 1024px (zachova pomer stran)
- Pokud je vysledny soubor mensi nez 300KB, zvysi JPEG kvalitu (0.95 nebo 1.0) a zkusi znovu
- Pokud ani pri max kvalite nedosahne 300KB (protoze zdrojovy obrazek je prilis maly/jednoduchy), vrati co ma s varovani
- Vrati blob + info o rozmerech

### 2. Uprava `HotelImageUpload.tsx`
- V `handleSelectImage` (ukladani nalezene fotky): po stazeni pres proxy nahradit volani `compressImage(file, 1920, 1080, 0.85)` sekvenci:
  1. Nejdriv `ensureMinimumQuality(file, 1024, 1024, 300*1024)` -- upscale na min rozmery
  2. Pak pripadne `compressImage` pouze pokud je obrazek vetsi nez 1920px
- V `handleSaveFromUrl` (ukladani z URL): stejna uprava
- Obrazky nahrane rucne (drag & drop) zustanou beze zmeny -- tam uzivatel vi co nahravel

### Technicke detaily

#### `ensureMinimumQuality(file, minWidth, minHeight, minBytes)`
```typescript
export async function ensureMinimumQuality(
  file: File,
  minWidth = 1024,
  minHeight = 1024,
  minBytes = 300 * 1024
): Promise<{ blob: Blob; width: number; height: number; upscaled: boolean }>
```
- Nacte obrazek do Image elementu
- Pokud sirka < minWidth nebo vyska < minHeight, spocita novy rozmer (zachova aspect ratio, min strana = pozadovana hodnota)
- Nakresli na canvas s `imageSmoothingQuality: "high"`
- Exportuje jako JPEG s kvalitou 0.92
- Pokud velikost < minBytes, zkusi kvalitu 0.97, pak 1.0
- Vrati blob s informaci zda doslo k upscalu

#### Uprava handleSelectImage
```typescript
// Misto:
const compressed = await compressImage(file, 1920, 1080, 0.85);

// Nove:
const upscaled = await ensureMinimumQuality(file, 1024, 1024, 300 * 1024);
// Pokud je obrazek stale vetsi nez 1920px, zkomprimuj
let finalBlob = upscaled.blob;
if (upscaled.width > 1920 || upscaled.height > 1920) {
  const compressed = await compressImage(
    new File([upscaled.blob], "img.jpg", { type: "image/jpeg" }),
    1920, 1920, 0.85
  );
  finalBlob = compressed.blob;
}
```

## Co se nezmeni
- Rucni upload fotek (drag & drop) -- tam se pouziva stavajici `compressImage`
- Proxy-image edge funkce -- ta jen stahuje, processing je na klientu
- Scrape/search edge funkce -- ty jen hledaji URL
