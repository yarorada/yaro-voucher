

# Auto-select schvalene varianty a zobrazeni poznamky klienta

## Co se zmeni

Kdyz klient na verejne strance schvali nabidku (klikne na zelene tlacitko u konkretni varianty), system automaticky:
1. Oznaci danou variantu jako finalní (is_selected = true)
2. Ulozi komentar klienta do pole `notes` na tabulce `deals` (s prefixem, aby bylo jasne, ze jde o poznamku od klienta)
3. V detailu obchodniho pripadu se zobrazi zvyrazneny blok s poznamkou klienta (pokud existuje odpoved v `offer_responses`)

## Technicke zmeny

### 1. Uprava PublicOffer.tsx - posilat variant_id

Aktualne se posila pouze `variant_name`. Pridame `variant_id` do requestu, aby edge funkce vedela, kterou variantu oznacit.

### 2. Uprava edge funkce `submit-offer-response`

- Prijme novy parametr `variant_id`
- Pokud je `variant_id` vyplnene:
  - Nastavi `is_selected = false` u vsech variant daneho dealu
  - Nastavi `is_selected = true` u schvalene varianty
- Ulozi komentar klienta do `deals.notes` (prida ho k existujicim poznamkam s prefixem "Poznamka klienta: ")

### 3. Zobrazeni poznamky klienta v DealDetail.tsx

Na detailu obchodniho pripadu se prida nova sekce (karta) s nadpisem "Odpoved klienta", ktera:
- Nacte posledni zaznam z `offer_responses` pro dany deal
- Zobrazi jmeno klienta, datum odpovedi a komentar
- Bude vizualne odlisena (zeleny lem, ikona CheckCircle2)
- Zobrazi se pouze pokud odpoved existuje

### Shrhnuti toku

1. Klient na webu vybere variantu a klikne "Souhlasim"
2. Frontend posle `{ token, comment, variant_name, variant_id }` do edge funkce
3. Edge funkce:
   - Ulozi odpoved do `offer_responses`
   - Oznaci variantu jako finalní (`is_selected = true`)
   - Ulozi poznamku do `deals.notes`
   - Zmeni status na "approved"
   - Posle notifikacni e-mail
4. V CRM se na detailu dealu objevi karta s odpovedi klienta a varianta bude oznacena jako finální
