
## Analýza rozsahu

Systém má dva typy formulářů, které je potřeba pokrýt:

**A) Detail stránky (inline editing) – data existují v DB, jsou editována na stránce:**
- `DealDetail.tsx` – hlavní pole dealu (status, destination, dates, notes, discount…) – **ALREADY HAS** `silentSave` + `useAutoSaveOnLeave`, ale ukládá jen při opuštění stránky, NE průběžně
- `ContractDetail.tsx` – upravuje se přes `EditContractDialog`
- `VoucherDetail.tsx` – existující voucher

**B) Dialogy (Create/Edit) – formulář v modálním okně:**
- `Clients.tsx` – dialog pro přidání/edit klienta (manual submit)
- `Suppliers.tsx` – dialog pro přidání/edit dodavatele (manual submit)
- `Hotels.tsx` + `HotelEditDialog.tsx` – dialog pro edit hotelu (manual submit)
- `Destinations.tsx` – dialog pro destinace (manual submit)
- `DealDetail.tsx` – dialog pro přidání služby (manual submit)
- `VoucherForm.tsx` – formulář pro voucher (manual submit)
- `CreateDeal.tsx`, `CreateContract.tsx` – nové záznamy

---

## Realistické hodnocení požadavku

Požadavek „automatické uložení ÚPLNĚ VŠEHO" je technicky velice komplexní a musím být upřímný v tom, co je proveditelné:

**Hlavní problém**: Dialogy pro vytváření NOVÝCH záznamů (nový klient, nový dodavatel) nemohou průběžně ukládat do DB, protože záznam ještě neexistuje – musel by se vytvořit „prázdný draft" při každém otevření formuláře, což by způsobovalo znečištění dat.

**Co je proveditelné a smysluplné:**

### 1. Existující záznamy → auto-save při každé změně (debounced)
Pole na detail stránkách se uloží automaticky 1–2 sekundy po poslední změně. V hlavičce se zobrazí indikátor „Ukládání..." / „Uloženo".

### 2. Dialogy pro EDIT existujících záznamů → auto-save
Klient/Dodavatel/Hotel – když editujeme EXISTUJÍCÍ záznam v dialogu, každá změna se po debounce (1s) uloží. Tlačítko „Uložit" se změní na indikátor stavu.

### 3. Dialogy pro NOVÉ záznamy → draft v localStorage + auto-uložení při submit
Nový klient/dodavatel/hotel se uloží při „potvrzení" (submit) – ale draft se průběžně ukládá do localStorage, aby se formulář neztratil při náhodném zavření.

### 4. Globální undo/redo v menu
Pro detailové stránky (DealDetail) – kde probíhá inline editing – přidáme globální Undo/Redo tlačítka do header toolbar. Pro dialogy (client/supplier/hotel) bude Ctrl+Z/Ctrl+Y fungovat lokálně uvnitř dialogu.

---

## Plán implementace

### Fáze 1: Nový hook `useAutoSave`

Nový soubor `src/hooks/useAutoSave.ts`:

```text
useAutoSave<T>({
  data: T,                    // sledovaná data
  saveFn: (data: T) => Promise<void>,  // funkce ukládání
  debounceMs: number,         // debounce (default 1000ms)
  enabled: boolean,           // zapnout/vypnout
  onSaveStart?: () => void,
  onSaveEnd?: () => void,
})
→ { isSaving, lastSaved }
```

### Fáze 2: Globální stavová indikace v headeru

V `App.tsx` / `LayoutHeader` přidat:
- Malý indikátor „Ukládám..." (spinner + text) / „Uloženo ✓" (check + čas)
- Undo/Redo tlačítka – propojené přes nový `AutoSaveContext`

### Fáze 3: DealDetail – průběžné auto-save

Aktuálně má `silentSave` + `useAutoSaveOnLeave` (ukládá jen při opuštění).

Změna: Přidat `useAutoSave` hook, který sleduje všechna hlavní pole a uloží po 1.5s nečinnosti. **Odebrat** tlačítko `Save` z toolbar (nebo ho přejmenovat na vizuální indikátor).

### Fáze 4: Clients, Suppliers dialogy

**EDIT existujícího záznamu:**
- Při `formData` change → debounce 1.5s → uložit do DB bez zavření dialogu
- Tlačítko „Uložit" → nahradit textem „Uloženo" s ikonou check

**NOVÝ záznam:**
- Zachovat submit button (musíme potvrdit akci)
- Přidat draft recovery z localStorage

### Fáze 5: Hotel edit dialog

Stejný princip jako Clients/Suppliers edit – průběžné auto-save pro editaci.

### Fáze 6: Undo/redo v header toolbaru

`src/hooks/useAutoSaveContext.tsx` (nový globální context):
```text
- undoStack: snapshot[] (max 30 snapshotů)
- redo stack
- pushSnapshot(label, revertFn)  ← volá se PŘED každou akcí
- undo() / redo()
```

Tlačítka Undo/Redo v `LayoutHeader` (viditelná vždy).

---

## Přehled souborů ke změně

| Soubor | Změna |
|---|---|
| `src/hooks/useAutoSave.ts` | NOVÝ – debounced auto-save hook |
| `src/hooks/useGlobalHistory.tsx` | NOVÝ – globální undo/redo context |
| `src/App.tsx` | Přidat undo/redo tlačítka do LayoutHeader |
| `src/pages/DealDetail.tsx` | Nahradit auto-save on leave → průběžný auto-save, integrovat undo/redo |
| `src/pages/Clients.tsx` | Auto-save při editaci existujícího klienta |
| `src/pages/Suppliers.tsx` | Auto-save při editaci existujícího dodavatele |
| `src/components/HotelEditDialog.tsx` | Auto-save při editaci hotelu |

---

## Undo/redo – realistický scope

**Co lze globálně undovat:**
- Změna pole v DealDetail (status, dates, notes…)
- Smazání služby z dealu
- Smazání cestujícího z dealu

**Co nelze snadno globálně undovat** (příliš komplexní revert logic):
- Vytvoření nového klienta/dodavatele (to by znamenalo smazání záznamu)
- Změny v dialogu klienta (zachováme lokální Ctrl+Z v textovém poli)

**UI undo/redo v headeru:**
```text
[← Zpět]  [Vpřed →]  Uloženo 14:23
```
Tlačítka jsou aktivní pouze tehdy, kdy je dostupná odpovídající history.

---

## Shrnutí přístupu

- **DealDetail** – průběžný auto-save každé pole po 1.5s, globální undo/redo v header
- **Klienti (edit)** – auto-save při editaci, zachovat submit pro nové
- **Dodavatelé (edit)** – auto-save při editaci, zachovat submit pro nové
- **Hotely (edit)** – auto-save při editaci hotelu
- **Vouchery** – zachovat současný flow (komplexní, mnoho vazeb)
- **Destinace** – jednoduché pole, průběžné uložení při editaci
- Žádné nové záznamy se neukládají automaticky bez potvrzení (bezpečné chování)
