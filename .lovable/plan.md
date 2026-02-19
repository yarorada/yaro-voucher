

# Automatické párování plateb z emailových notifikací

## Jak to bude fungovat

1. V detailu smlouvy (platební kalendář) se objeví nové tlačítko "Spárovat platbu z emailu"
2. Otevře se dialog, kam vložíte text emailové notifikace z banky (Ctrl+V)
3. AI (Gemini Flash) z textu vytáhne: částku, datum připsání, variabilní symbol, poznámku odesílatele
4. Systém najde odpovídající nezaplacenou platbu podle VS a částky
5. Automaticky ji označí jako zaplacenou s datem z emailu

Později lze rozšířit o webhook pro plně automatické zpracování přeposlaných emailů.

---

## Technický plán

### 1. Nová backend funkce: `parse-payment-email`

- Přijme text emailové notifikace (POST body)
- Použije Lovable AI (gemini-2.5-flash) k extrakci strukturovaných dat:
  - `amount` (částka)
  - `date` (datum připsání)
  - `variable_symbol` (VS)
  - `sender_name` (jméno odesílatele)
  - `sender_account` (číslo účtu odesílatele)
- Vyhledá v `contract_payments` + `travel_contracts` nezaplacenou platbu kde:
  - VS z emailu odpovídá číslu smlouvy (contract_number bez prefixu)
  - Částka odpovídá (tolerance +/- 1 Kc)
- Pokud najde shodu, vrátí návrh párování (contract_number, payment_id, amount)
- Pokud ne, vrátí chybu s popisem co nenašel

### 2. Nová backend funkce: `confirm-payment-match`

- Přijme `payment_id`, `paid_at` (datum), `table` (contract_payments / deal_payments)
- Označí platbu jako zaplacenou (`paid = true`, `paid_at = datum z emailu`)
- Zabezpečeno JWT autentizací

### 3. UI komponenta: dialog v `ContractPaymentSchedule.tsx`

- Nové tlačítko "Spárovat z emailu" vedle "Přidat platbu"
- Dialog s textarea pro vložení textu emailu
- Po odeslání zobrazí náhled: "Nalezena platba: Záloha 50 000 Kc, splatnost 15.3.2026"
- Tlačítko "Potvrdit spárování" pro finální označení
- Stejná funkcionalita i v `DealPaymentSchedule.tsx`

### 4. Bez databázových změn

Stávající tabulky `contract_payments` a `deal_payments` již mají sloupce `paid` a `paid_at` -- není potřeba nic měnit.

