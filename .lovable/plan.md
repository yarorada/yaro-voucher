
## Analysis

The user wants to add per-room-type pricing to hotel services in deals/variants. Currently:
- A hotel service has a single `price` field (flat total or per-person)
- The `description` field holds room type text (e.g. "Deluxe Double Room")
- `computePerPersonPrices()` in `PublicOffer.tsx` already exists but does a simple per-hotel-entry calculation

**What needs to change:**

### The Core Concept
- When entering a hotel service, allow multiple room types (e.g. Single + Double + Suite)
- Each room type has: name, number of rooms, persons per room, price per room
- The per-person price on the public offer is calculated as:
  `(hotel room price / persons_in_room) + (shared services per person)`
- "Shared services" = green fees, transfers, etc. divided proportionally

### Data Model
The room types data will be stored in `details.room_types` as a JSON array on the hotel service, keeping backward compatibility. Each entry:
```json
{ "name": "Double", "rooms": 2, "persons_per_room": 2, "price": 25000 }
```
The main `price` on the service = sum of all room prices (for total calculation compatibility)
The `person_count` on the service = total persons across all room types

### Files to Change

**1. `src/pages/DealDetail.tsx`** — Hotel service form:
- When `service_type === "hotel"`, instead of single Description field, add a **Room Types editor** section  
- Shows a dynamic list of room types: `[Typ pokoje | Pokojů | Osob/pokoj | Cena/pokoj]`
- Default row: one "Double" row pre-filled
- "Přidat typ pokoje" button to add Single, Suite etc.
- Auto-sums `price` = total of all rooms, `person_count` = total persons
- Still show single-line description field for meal plan etc.

**2. `src/components/VariantServiceDialog.tsx`** — Same room types editor for variant services

**3. `src/pages/PublicOffer.tsx`** — Update `computePerPersonPrices()`:
- When hotel service has `details.room_types`, compute per-person prices per room type
- Formula: `(room.price / room.persons_per_room) + shared_services_per_person`
- "Shared services" = non-hotel services, split per person respecting `price_mode`
- Show a breakdown: "Single – 1 os.: 45 000 CZK | Double – 2 os./pokoj: 38 000 CZK"

**4. `supabase/functions/get-public-offer/index.ts`** — No changes needed (already passes full `details` field)

### Room Types Editor Component
A small inline component (no separate file needed, inline in the hotel section):
```
[Typ pokoje]  [Pokojů]  [Os./pokoj]  [Cena/pokoj]  [Celkem]  [🗑]
Double          2           2          25,000         50,000
Single          1           1          30,000         30,000
                            Celkem osob: 5   Celkem cena: 80,000
```
- When any value changes, auto-updates `price` and `person_count` on the service form
- If no room types defined, falls back to current single-price behavior (backward compatible)

### Updated `computePerPersonPrices()` Logic
```
For each room type in hotel.details.room_types:
  price_per_person = room.price / room.persons_per_room
  + for each non-hotel service:
      if price_mode === "per_person": add service.price
      if price_mode === "per_service": add (service.price * service.quantity) / total_persons
  
  yield: { label: "Double (2 os./pokoj)", personCount: room.persons_per_room, pricePerPerson }
```

### Implementation Steps
1. Add `RoomTypeEditor` inline component in `DealDetail.tsx` (hotel service form)
2. Update `handleSaveService` to derive `price` and `person_count` from room types sum
3. Mirror same changes in `VariantServiceDialog.tsx`
4. Update `computePerPersonPrices()` in `PublicOffer.tsx` to handle `room_types`
5. Update public offer display to show per-room-type price rows

No database migration needed — `details` is already `jsonb` and stores arbitrary data.

### Display on Public Offer
Current "Cena na osobu" section becomes:
```
Cena na osobu
Double (2 os.)     38 000 CZK
Single (1 os.)     44 000 CZK
```
(Each line = hotel room price / persons + shared services share)
