

# Propojení Fintable (Google Sheets) s webhook endpointem

## Shrnutí

Fintable synchronizuje bankovní transakce do Google Sheets. Upravíme `bank-webhook` endpoint tak, aby kromě raw textu emailu umel prijmout i strukturovana data (amount, variable_symbol, date, sender_name). Navic dodame hotovy Google Apps Script, ktery se vlozi primo do Google Sheets a automaticky odeslane novy radek na webhook.

## Co se zmeni

### 1. Uprava `bank-webhook` Edge funkce

Aktualne funkce ocekava `emailText` a pouziva AI k extrakci dat. Nova verze bude:

- **Detekce strukturovanych dat**: Pokud payload obsahuje pole `amount` (cislo), preskoci AI parsing a pouzije data primo
- **Zachovani zpetne kompatibility**: Pokud payload obsahuje `emailText`, pouzije se stavajici AI parsing
- Ocekavany format ze Sheets:
  ```text
  {
    "amount": 15000,
    "variable_symbol": "260012",
    "date": "2026-02-19",
    "sender_name": "Jan Novak",
    "note": "Doplatek zajezd"
  }
  ```
- Zbytek logiky (parovani podle VS, fallback podle castky, ulozeni do `bank_notifications`) zustava beze zmeny

### 2. Google Apps Script pro automaticke odesilani

Dodame hotovy skript, ktery uzivateli staci vlozit do Google Sheets (Extensions > Apps Script). Skript:

- Reaguje na udalost `onEdit` nebo `onChange` pri pridani noveho radku
- Precte sloupce (nazvy sloupcu se nakonfigurují podle toho, jak je Fintable pojmenoval)
- Odesle POST request na `bank-webhook?token=XXX`
- Zapise do posledniho sloupce "Odesláno" jako potvrzeni

## Technicky detail

### Edge funkce `bank-webhook/index.ts`

```
// Na zacatku po nacteni body:
if (typeof body.amount === 'number' && body.amount > 0) {
  // Strukturovana data - preskocit AI parsing
  parsed = {
    amount: body.amount,
    variable_symbol: body.variable_symbol || null,
    date: body.date || null,
    sender_name: body.sender_name || null,
    note: body.note || null,
  };
} else {
  // Stavajici AI parsing z emailText
  ...
}
```

### Google Apps Script (dodany jako navod)

```
function onNewRow(e) {
  var sheet = e.source.getActiveSheet();
  var row = e.range.getRow();
  // Cteni sloupcu: Castka, VS, Datum, Odesilatel
  var amount = sheet.getRange(row, SLOUPEC_CASTKA).getValue();
  var vs = sheet.getRange(row, SLOUPEC_VS).getValue();
  // ... POST na webhook URL
}
```

## Postup implementace

1. Upravit `bank-webhook` aby prijiml strukturovana data
2. Poskytnout Google Apps Script navod s konfigurovatelnymi nazvy sloupcu
3. Otestovat webhook s ukazkovym payloadem

## Co se NEMENI

- Tabulka `bank_notifications` - zadne schema zmeny
- Dashboard `BankNotificationsCard` - funguje stejne
- `confirm-payment-match` - beze zmeny
- Manualni parsovani emailu v `PaymentEmailMatchDialog` - funguje dale

