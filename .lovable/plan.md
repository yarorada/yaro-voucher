

# Public Deal Offer Sharing

## Overview
Add a "Share offer" button to the Deal Detail page that generates a unique public link. The link opens a beautifully designed public page showing the deal's variants (or just the selected one if finalized), each with a hero hotel photo and 2 smaller gallery photos.

## What needs to happen

### 1. Database changes

**New columns on `hotel_templates`:**
- `image_url` (text, nullable) -- main/hero photo
- `image_url_2` (text, nullable) -- room or secondary photo  
- `image_url_3` (text, nullable) -- golf course / beach / signature photo

**New column on `deals`:**
- `share_token` (text, nullable, unique) -- random token for public access

**New storage bucket:**
- `hotel-images` (public) for uploading hotel photos

**New RLS policy:**
- Anonymous SELECT on `deals`, `deal_variants`, `deal_variant_services`, `deal_services`, `hotel_templates`, `destinations`, `countries` where `share_token` matches -- achieved via a database function with SECURITY DEFINER to avoid complex RLS changes.

### 2. Backend function (Edge Function)
- `get-public-offer` -- accepts `token` query param, fetches all deal data (variants with services, destination, hotel images) and returns JSON. This avoids needing anon RLS on all tables.

### 3. New pages and components

**`src/pages/PublicOffer.tsx`** -- public page (no auth required):
- Fetches data via the edge function
- Displays YARO branding header
- If a variant is selected as final: shows only that variant
- Otherwise: shows all variants as cards
- Each variant card shows:
  - Hero hotel image (large, full-width)
  - 2 smaller images in a row below (room + golf/beach)
  - Destination name, dates, services list, total price
- Responsive, modern design with gradient accents

**`src/components/HotelImageUpload.tsx`** -- image upload component:
- Used in HotelCombobox or a separate hotel edit dialog
- Allows uploading 3 images (main, room, golf/beach)
- Stores in `hotel-images` bucket, saves URLs to `hotel_templates`

**`src/components/ShareOfferButton.tsx`** -- button for DealDetail:
- Generates a `share_token` if not present
- Copies the public URL to clipboard
- Shows the shareable link

### 4. Routing
- Add `/offer/:token` route in App.tsx (outside ProtectedRoute)

## Design of the public page

```text
+------------------------------------------+
|  YARO Travel logo          Nabidka       |
+------------------------------------------+
|                                          |
|  [========= HERO HOTEL IMAGE =========]  |
|                                          |
|  [  Room Photo  ]  [  Golf/Beach Photo ] |
|                                          |
|  Destination Name, Country               |
|  DD.MM.YYYY - DD.MM.YYYY                 |
|                                          |
|  Services:                               |
|  - Flight: PRG -> FAO                    |
|  - Hotel: Pine Cliffs 5*                 |
|  - Golf: Monte Rei Golf                  |
|  - Transfer: Airport transfer            |
|                                          |
|  Total: 85 000 CZK                       |
+------------------------------------------+
```

Multiple variant cards shown side-by-side on desktop, stacked on mobile. Selected variant highlighted.

## Technical details

- Share token: 12-char random alphanumeric string
- Edge function queries all needed data server-side (no anon RLS changes needed)
- Hotel images uploaded to Supabase Storage `hotel-images` bucket
- Images compressed client-side before upload (reuse existing `imageCompression.ts`)
- Public page uses minimal dependencies (no sidebar, no auth check)

## Files to create/modify
- **Migration**: Add columns + storage bucket
- **New**: `supabase/functions/get-public-offer/index.ts`
- **New**: `src/pages/PublicOffer.tsx`
- **New**: `src/components/ShareOfferButton.tsx`  
- **New**: `src/components/HotelImageUpload.tsx`
- **Modify**: `src/App.tsx` (add public route)
- **Modify**: `src/pages/DealDetail.tsx` (add ShareOfferButton)
- **Modify**: `src/components/HotelCombobox.tsx` (add image upload trigger)

