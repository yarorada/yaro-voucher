

# Migrace synchronizace smluv: Airtable -> Google Sheets

## Co se změní

Stávající edge funkce `sync-contract-airtable` bude přepsána tak, aby místo Airtable API posílala data na Google Apps Script webhook, který je zapíše do Google Sheets.

## Kroky

1. **Uložení webhook URL jako secret**
   - Název: `GOOGLE_SHEETS_WEBHOOK_URL`
   - Hodnota: `https://script.google.com/macros/s/AKfycbxZ4xgmA4f_a0M0jgy1xT0kJJ5-InfuM9EWZid5TL0Cib4iXIcJOSPu_bTG8Vq4CINctA/exec`

2. **Přepis edge funkce `sync-contract-airtable`**
   - Odstranění veškeré Airtable logiky (vyhledávání existujícího záznamu, PATCH/POST)
   - Nahrazení jediným POST requestem na Google Sheets webhook
   - Data zůstávají stejná: Číslo smlouvy, Klient, Email klienta, Destinace, Datum odjezdu, Datum návratu, Prodejní cena, Měna, Nákupní cena, Marže, Odesláno dne
   - Upsert logiku (vložení vs. aktualizace) řeší Apps Script na straně Google Sheets

3. **Volání funkce zůstává beze změny**
   - Všechna místa, kde se volá `supabase.functions.invoke("sync-contract-airtable", ...)`, fungují dál bez úprav

## Technické detaily

- Edge funkce načte `GOOGLE_SHEETS_WEBHOOK_URL` z env proměnných
- Pošle JSON payload přes POST na webhook
- Google Apps Script přijme data, najde řádek podle "Číslo smlouvy" a aktualizuje ho, nebo přidá nový
- Airtable secrets (`AIRTABLE_API_TOKEN`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_ID`) zůstanou v projektu, ale funkce je přestane používat

