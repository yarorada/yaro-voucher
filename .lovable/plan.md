
## Sjednocení formátování názvů — přehled vs. detail

### Cílový formát (identický na všech stránkách)
```
[Barevný status badge]  [BOLD číslo]  [normální font – popis]
```

### Co je správně a co potřebuje úpravu

| Stránka | Stav |
|---|---|
| Přehled OP (`Deals.tsx`) | ✅ OK |
| Přehled smluv (`Contracts.tsx`) | ✅ OK |
| Přehled voucherů (`VouchersList.tsx`) | ❌ kód, klient, hotel, datum jsou v jednom `font-medium` span bez bold oddělení |
| Detail OP (`DealDetail.tsx`) | ❌ `h1` zobrazuje jen `dealName` nebo destinaci, číslo OP není separátně bold |
| Detail smlouvy (`ContractDetail.tsx`) | ✅ skoro OK, ale badge používá `variant=secondary/default/outline` místo barevné konfigurace |
| Detail voucheru (`VoucherDetail.tsx`) | ❌ `h1` je kód voucheru, badge je za ním, popis je samostatný `<p>` |

---

### Plán změn

#### 1. `src/pages/VouchersList.tsx` — řádek ~492-494
V přehledu voucherů nahradit jeden `font-medium` span za tři oddělené elementy:
```tsx
{/* před: */}
<span className="text-foreground font-medium truncate">
  {[voucher.voucher_code, displayName, hotelName, firstServiceDate ...].join(" ")}
</span>

{/* po: */}
<span className="font-bold text-foreground">{voucher.voucher_code}</span>
{(displayName || hotelName || firstServiceDate) && (
  <span className="text-foreground truncate">
    {[displayName, hotelName, firstServiceDate ? formatDate(firstServiceDate) : null].filter(Boolean).join(" • ")}
  </span>
)}
```

#### 2. `src/pages/DealDetail.tsx` — řádky 2679-2730 (header)
Přidat separátní deal number jako bold span před `dealName`:
```tsx
{/* Nový formát: [Badge] [BOLD D-XXXXXX] [normal popis] [pencil] */}
<DealStatusBadge status={deal.status} />
<span className="font-bold text-foreground text-heading-1">
  {deal.deal_number.match(/^D-\d{6}/)?.[0] || deal.deal_number}
</span>
{isEditingName ? (
  <Input ... />  // editace popisu
) : (
  <>
    {dealName && <span className="text-foreground">{dealName.replace(/^D-\d{6,}\s*/, "").trim()}</span>}
    <Button pencil ... />
  </>
)}
```

#### 3. `src/pages/ContractDetail.tsx` — řádky 293-313 (header)
Status badge nahradit za barevný badge (stejná konfigurace jako v `Contracts.tsx`):
```tsx
{/* Místo getStatusBadge() s variant= použít barevnou konfiguraci */}
<Badge className={`text-xs shrink-0 ${statusConfig[contract.status].className}`}>
  {statusConfig[contract.status].label}
</Badge>
<span className="font-bold text-heading-1 text-foreground">{contract.contract_number}</span>
<span className="text-foreground">{displayName}</span>
```
Přidat `statusConfig` (stejný objekt jako v `Contracts.tsx`) do `ContractDetail.tsx`.

#### 4. `src/pages/VoucherDetail.tsx` — řádky 869-900 (header)
Přeuspořádat header: badge první, pak bold kód, pak normální popis:
```tsx
{/* před: h1(kód) → Badge → p(popis) */}
{/* po: [Badge] [BOLD kód] [normal popis] — vše na jednom řádku */}
<div className="flex flex-wrap items-center gap-2 md:gap-3 mb-1">
  {voucher.sent_at ? (
    <Badge className="... bg-emerald-600 ...">Odesláno</Badge>
  ) : (
    <Badge className="... bg-gray-500 ...">Neodesláno</Badge>
  )}
  <span className="font-bold text-heading-1 text-foreground">{voucher.voucher_code}</span>
  {popis && <span className="text-foreground">{popis}</span>}
</div>
```

---

### Souhrn souborů ke změně
- `src/pages/VouchersList.tsx` — opravit přehled voucherů
- `src/pages/DealDetail.tsx` — opravit header detailu OP
- `src/pages/ContractDetail.tsx` — sjednotit badge barvy + font
- `src/pages/VoucherDetail.tsx` — přeuspořádat header
