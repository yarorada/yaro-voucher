

## Zhutneni PDF sablony smlouvy

Snizeni radkovani, paddingu a fontu v cele PDF sablone pro kompaktnejsi rozlozeni na A4. Text bude oddeleny od cар pomoci `verticalAlign: 'middle'` a dostatecneho borderBottom, ale bez zbytecnych mezer.

### Zmeny v `src/components/ContractPdfTemplate.tsx`

#### 1. Sdilene styly (radky 127-132)

| Styl | Aktualni | Novy |
|------|----------|------|
| `labelStyle` padding | `4px 0` | `2px 0` |
| `labelStyle` lineHeight | `1.5` | `1.2` |
| `labelStyle` verticalAlign | `top` | `middle` |
| `valueStyle` padding | `4px 0 4px 6px` | `2px 0 2px 6px` |
| `valueStyle` lineHeight | `1.5` | `1.2` |
| `valueStyle` verticalAlign | `top` | `middle` |
| `sectionTitle` marginTop | `10px` | `8px` |
| `sectionTitle` marginBottom | `5px` | `3px` |
| `sectionTitle` paddingBottom | `3px` | `2px` |
| `sectionTitle` lineHeight | `1.4` | `1.2` |
| `thStyle` padding | `5px 6px` | `3px 6px` |
| `thStyle` lineHeight | `1.4` | `1.2` |
| `thStyle` fontSize | `8px` | `7px` |
| `tdStyle` padding | `5px 6px` | `3px 6px` |
| `tdStyle` lineHeight | `1.5` | `1.2` |
| `tdStyle` fontSize | `9px` | `8px` |

#### 2. Hlavni kontejner (radek 144)

- `lineHeight` z `1.5` na `1.2`

#### 3. Itinerar letu (radek 226)

- `lineHeight` u odstavcu z `1.5` na `1.2`

#### 4. Popisky sluzeb (radek 287)

- `lineHeight` z `1.4` na `1.2`
- `fontSize` z `8px` na `7px`

#### 5. Platebni kalendar -- poznamky (radek 336)

- `lineHeight` z `1.4` na `1.2`
- `fontSize` z `8px` na `7px`

#### 6. Souhrnne radky tabulek (radky 298, 350-357)

- `padding` z `3px 5px` na `2px 5px`

#### 7. Platebni udaje box (radky 363-368)

- `padding` z `6px 8px` na `4px 6px`
- `marginTop` z `6px` na `4px`
- `fontSize` nadpisu z `9px` na `8px`

#### 8. Pravni podminky (radek 390)

- `lineHeight` z `1.6` na `1.3`
- `fontSize` z `8px` na `7px`
- Mezery mezi odstavci (`margin`) zmenseny z `4px`/`5px` na `2px`/`3px`

#### 9. Podpisy (radky 402-416)

- `marginTop` z `20px` na `14px`
- `paddingTop` z `10px` na `6px`
- `marginTop` u podpisove cary z `28px` na `22px`

#### Co zustava

- `verticalAlign: 'middle'` na vsech tabulkovych bunkach -- text zustane vertikalne vycentrovany a nebude se lepit na spodni hranu
- `borderBottom` na bunkach zustava -- vizualne oddeluje radky od textu
- Fonty hlavicek (`16px` nadpis, `12px` cislo smlouvy, `11px` celkova cena) se nemeni
- QR kod a jeho popisky zustavaji beze zmeny

