
# Integrace Moneta API — automatický import plateb

## Co se udělá

Vytvoříme backend funkci, která bude periodicky nebo na vyžádání načítat transakce z Moneta API a automaticky je párovat s neuhrazenými splátkami smluv v CRM. Uživatel jen jednou zadá API token z Internet Banky.

## Architektura

```text
Internet Banka (Moneta)
        |
        | (Bearer Token)
        v
 Backend funkce: moneta-fetch-transactions
        |
        | Porovnání s nezaplacenými splátkami
        v
  Tabulka bank_notifications
        |
        v
  Dashboard → BankNotificationsCard (existující UI)
```

## Kroky implementace

### 1. Uložení API tokenu (secret)

Uložíme Moneta API token jako bezpečný backend secret pod názvem `MONETA_API_TOKEN`. Uživatel ho zadá jednou přes Lovable secret manager.

### 2. Nová backend funkce: `moneta-fetch-transactions`

Funkce bude:
- Volat Moneta API endpoint pro transakce: `GET /accounts/{accountId}/transactions`
- Filtrovat transakce za posledních N dní (configurable, default 7)
- Pro každou transakci zkontrolovat, zda již není v `bank_notifications` (deduplicace podle ID transakce)
- Nové transakce vložit do `bank_notifications` stejným způsobem jako existující webhook

Parametry dotazu:
- `Authorization: Bearer {MONETA_API_TOKEN}`
- `dateFrom`, `dateTo` pro filtrování období
- Parsování polí: `amount`, `variableSymbol`, `transactionDate`, `counterAccountName`, `transactionNote`

### 3. Rozšíření tabulky `bank_notifications`

Přidat sloupec `external_transaction_id` (text, nullable) pro deduplicaci — aby při opakovaném importu tatáž transakce nebyla vložena dvakrát.

### 4. UI — tlačítko "Načíst z Monety"

Do existující karty `BankNotificationsCard` (v dashboardu) přidat tlačítko **Načíst platby z Monety**, které ručně spustí funkci. Zároveň přidat nastavení čísla účtu (accountId) přímo v UI nastavení karty.

### 5. Volitelné: Automatické spouštění

Pokud budete chtít, lze přidat automatické spouštění každý den (cron trigger přes existující `auto-triggered-emails` vzor).

## Technické poznámky

- Moneta API sandbox je dostupný přes `https://api.moneta.cz` (přesná URL se ověří po přihlášení do portálu)
- Po získání tokenu ověřím správné endpointy přes API portál
- Párování plateb využije **existující logiku** z `bank-webhook` funkce (VS + amount matching) — žádná duplicitní logika
- Token z Internet Banky je statický (nevyprší jako OAuth) — stačí ho jednou uložit

## Co musíte udělat před implementací

1. Přihlaste se do **Internet Banky Monety**
2. Jděte do Nastavení → Integrace a API → aktivujte službu
3. Vytvořte API token s oprávněním čtení transakcí
4. Poznamenejte si **číslo účtu** (accountId) — bude potřeba jako parametr
5. Až budete mít token, zadáte ho jako secret a já dokončím implementaci
