

# Oprava ukládání URL adresy hotelu

## Problem

Kdyz kliknete na "Ulozit web" u detekované adresy, URL se ulozi do databaze spravne. Ale kdyz potom kliknete na hlavni tlacitko "Ulozit" pro ulozeni celého hotelu, formular prepise website_url zpet na prazdnou hodnotu (null), protoze formularova data se neaktualizuji po ulozeni webu.

## Reseni

V souboru `src/pages/Hotels.tsx` upravime `onUpdate` callback tak, aby po obnoveni `editHotel` z databaze aktualizoval i `formData` - konkretne pole `website_url`:

### Zmena v `src/pages/Hotels.tsx`

V `onUpdate` callbacku (radky 457-465) pridame aktualizaci formData po nacteni cerstvych dat z databaze:

```typescript
onUpdate={async () => {
  await fetchHotels();
  const { data } = await supabase
    .from("hotel_templates")
    .select("*")
    .eq("id", editHotel.id)
    .single();
  if (data) {
    setEditHotel(data);
    // Sync formData so the main Save button doesn't overwrite
    setFormData(f => ({
      ...f,
      website_url: data.website_url || "",
    }));
  }
}}
```

Tím se zajistí, že po uložení webu přes tlačítko "Uložit web" se aktualizuje i formulář, a hlavní "Uložit" tlačítko nebude přepisovat website_url zpět na prázdnou hodnotu.

