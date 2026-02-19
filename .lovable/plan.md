

# Vylepšení párování plateb: smlouva -> obchodní případ

## Co se změní

Aktuální systém hledá platby v kontextu, odkud byl dialog otevřen. Nový systém bude fungovat takto:

1. Uživatel vloží text emailové notifikace z banky
2. AI extrahuje částku, datum, variabilní symbol (VS)
3. Systém hledá **vždy v cestovních smlouvách** (travel_contracts) podle VS z čísla smlouvy
4. Najde odpovídající nezaplacenou platbu v contract_payments a označí ji jako zaplacenou
5. **Automaticky propíše stav platby do deal_payments** -- najde propojenou smlouvu (deal_id), vyhledá odpovídající platbu ve stejné výši/typu a označí ji rovněž jako zaplacenou

## Technické změny

### 1. Edge funkce `parse-payment-email`
- Zjednodušení: vždy hledat pouze v `travel_contracts` podle VS (bez kontextu deal_id/contract_id)
- Odebrat vyhledávání v deal_payments -- VS je vždy ze smlouvy
- Pokud VS chybí, zkusit hledat jen podle částky napříč všemi nezaplacenými contract_payments

### 2. Edge funkce `confirm-payment-match`
- Po označení platby v `contract_payments` jako zaplacené:
  - Najít `deal_id` ze smlouvy (`travel_contracts.deal_id`)
  - Pokud existuje deal_id, najít odpovídající platbu v `deal_payments` (podle payment_type + amount s tolerancí +/- 1)
  - Označit ji rovněž jako `paid = true, paid_at = datum`
- Vrátit info o tom, že byla propagována i do obchodního případu

### 3. UI komponenta `PaymentEmailMatchDialog`
- Odebrat parametr `context` (deal_id/contract_id) -- už není potřeba, vyhledávání je globální
- Po úspěšném spárování zobrazit toast s informací o propagaci do dealu
- Zajistit refresh dat jak na stránce smlouvy, tak na stránce dealu

### 4. Úprava volání v komponentách
- `ContractPaymentSchedule.tsx`: odebrat `context` prop z PaymentEmailMatchDialog
- `DealPaymentSchedule.tsx`: odebrat `context` prop z PaymentEmailMatchDialog (dialog bude fungovat stejně -- hledá vždy ve smlouvách)

