// Country name → { iso3, iso2, currency } lookup (shared across components)
// ISO2 codes for flag emoji rendering
const ISO3_TO_ISO2: Record<string, string> = {
  AFG:"AF",ALB:"AL",DZA:"DZ",AND:"AD",AGO:"AO",ARG:"AR",ARM:"AM",AUS:"AU",AUT:"AT",AZE:"AZ",
  BHS:"BS",BHR:"BH",BGD:"BD",BRB:"BB",BLR:"BY",BEL:"BE",BLZ:"BZ",BOL:"BO",BIH:"BA",BWA:"BW",
  BRA:"BR",BRN:"BN",BGR:"BG",BFA:"BF",BDI:"BI",KHM:"KH",CMR:"CM",CAN:"CA",CPV:"CV",CAF:"CF",
  TCD:"TD",CHL:"CL",CHN:"CN",COL:"CO",CRI:"CR",HRV:"HR",CUB:"CU",CYP:"CY",CZE:"CZ",DNK:"DK",
  DMA:"DM",DOM:"DO",ECU:"EC",EGY:"EG",SLV:"SV",ERI:"ER",EST:"EE",ETH:"ET",FJI:"FJ",FIN:"FI",
  FRA:"FR",GMB:"GM",GEO:"GE",DEU:"DE",GHA:"GH",GRC:"GR",GTM:"GT",HND:"HN",HUN:"HU",ISL:"IS",
  IND:"IN",IDN:"ID",IRN:"IR",IRQ:"IQ",IRL:"IE",ISR:"IL",ITA:"IT",JAM:"JM",JPN:"JP",JOR:"JO",
  KAZ:"KZ",KEN:"KE",KOR:"KR",KWT:"KW",KGZ:"KG",LAO:"LA",LVA:"LV",LBN:"LB",LBY:"LY",LIE:"LI",
  LTU:"LT",LUX:"LU",MKD:"MK",MDG:"MG",MYS:"MY",MDV:"MV",MLT:"MT",MAR:"MA",MUS:"MU",MRT:"MR",
  MEX:"MX",MDA:"MD",MCO:"MC",MNG:"MN",MNE:"ME",MOZ:"MZ",MMR:"MM",NAM:"NA",NPL:"NP",NLD:"NL",
  NZL:"NZ",NIC:"NI",NGA:"NG",NOR:"NO",OMN:"OM",PAK:"PK",PAN:"PA",PRY:"PY",PER:"PE",PHL:"PH",
  POL:"PL",PRT:"PT",PRI:"PR",QAT:"QA",ROU:"RO",RUS:"RU",SAU:"SA",SEN:"SN",SRB:"RS",SYC:"SC",
  SGP:"SG",SVK:"SK",SVN:"SI",ZAF:"ZA",ESP:"ES",LKA:"LK",SDN:"SD",SUR:"SR",SWZ:"SZ",SWE:"SE",
  CHE:"CH",SYR:"SY",TWN:"TW",TJK:"TJ",TZA:"TZ",THA:"TH",TGO:"TG",TTO:"TT",TUN:"TN",TUR:"TR",
  TKM:"TM",UGA:"UG",UKR:"UA",ARE:"AE",GBR:"GB",USA:"US",URY:"UY",UZB:"UZ",VEN:"VE",VNM:"VN",
  YEM:"YE",ZMB:"ZM",ZWE:"ZW",CIV:"CI",COK:"CK",ATG:"AG",XKX:"XK",
  SCO:"GB-SCT",ENG:"GB-ENG",WAL:"GB-WLS",NCY:"NC-CY",
};

// Unicode subdivision flags for UK nations
const SUBDIVISION_FLAGS: Record<string, string> = {
  "GB-SCT": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}", // 🏴󠁧󠁢󠁳󠁣󠁴󠁿
  "GB-ENG": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}", // 🏴󠁧󠁢󠁥󠁮󠁧󠁿
  "GB-WLS": "\u{1F3F4}\u{E0067}\u{E0062}\u{E0077}\u{E006C}\u{E0073}\u{E007F}", // 🏴󠁧󠁢󠁷󠁬󠁳󠁿
  "NC-CY": "\u{1F1F9}\u{1F1F7}", // Northern Cyprus – using Turkish flag 🇹🇷
};

/**
 * Convert ISO2 country code to flag emoji using regional indicator symbols.
 */
const iso2ToFlag = (iso2: string): string => {
  if (iso2.length !== 2) return "";
  const codePoints = iso2.toUpperCase().split("").map(c => 0x1F1E6 + c.charCodeAt(0) - 65);
  return String.fromCodePoint(...codePoints);
};

/**
 * Get flag emoji for a country name (Czech).
 */
export const getCountryFlag = (countryName: string): string => {
  const data = lookupCountryData(countryName);
  if (!data) return "";
  const iso2 = ISO3_TO_ISO2[data.iso];
  if (!iso2) return "";
  // Check for subdivision flags (Scotland, England, Wales)
  if (SUBDIVISION_FLAGS[iso2]) return SUBDIVISION_FLAGS[iso2];
  if (iso2.length !== 2) return "";
  return iso2ToFlag(iso2);
};

const COUNTRY_DATA: Record<string, { iso: string; currency: string }> = {
  "afghánistán": { iso: "AFG", currency: "AFN" },
  "albánie": { iso: "ALB", currency: "ALL" },
  "alžírsko": { iso: "DZA", currency: "DZD" },
  "andorra": { iso: "AND", currency: "EUR" },
  "angola": { iso: "AGO", currency: "AOA" },
  "argentina": { iso: "ARG", currency: "ARS" },
  "arménie": { iso: "ARM", currency: "AMD" },
  "austrálie": { iso: "AUS", currency: "AUD" },
  "ázerbájdžán": { iso: "AZE", currency: "AZN" },
  "bahamy": { iso: "BHS", currency: "BSD" },
  "bahrajn": { iso: "BHR", currency: "BHD" },
  "bangladéš": { iso: "BGD", currency: "BDT" },
  "barbados": { iso: "BRB", currency: "BBD" },
  "belgie": { iso: "BEL", currency: "EUR" },
  "belize": { iso: "BLZ", currency: "BZD" },
  "bělorusko": { iso: "BLR", currency: "BYN" },
  "bolívie": { iso: "BOL", currency: "BOB" },
  "bosna a hercegovina": { iso: "BIH", currency: "BAM" },
  "botswana": { iso: "BWA", currency: "BWP" },
  "brazílie": { iso: "BRA", currency: "BRL" },
  "brunej": { iso: "BRN", currency: "BND" },
  "bulharsko": { iso: "BGR", currency: "BGN" },
  "burkina faso": { iso: "BFA", currency: "XOF" },
  "burundi": { iso: "BDI", currency: "BIF" },
  "čad": { iso: "TCD", currency: "XAF" },
  "česko": { iso: "CZE", currency: "CZK" },
  "česká republika": { iso: "CZE", currency: "CZK" },
  "čína": { iso: "CHN", currency: "CNY" },
  "dánsko": { iso: "DNK", currency: "DKK" },
  "dominikánská republika": { iso: "DOM", currency: "DOP" },
  "egypt": { iso: "EGY", currency: "EGP" },
  "ekvádor": { iso: "ECU", currency: "USD" },
  "eritrea": { iso: "ERI", currency: "ERN" },
  "estonsko": { iso: "EST", currency: "EUR" },
  "etiopie": { iso: "ETH", currency: "ETB" },
  "filipíny": { iso: "PHL", currency: "PHP" },
  "finsko": { iso: "FIN", currency: "EUR" },
  "francie": { iso: "FRA", currency: "EUR" },
  "gambie": { iso: "GMB", currency: "GMD" },
  "ghana": { iso: "GHA", currency: "GHS" },
  "gruzie": { iso: "GEO", currency: "GEL" },
  "guatemala": { iso: "GTM", currency: "GTQ" },
  "honduras": { iso: "HND", currency: "HNL" },
  "chile": { iso: "CHL", currency: "CLP" },
  "chorvatsko": { iso: "HRV", currency: "EUR" },
  "indie": { iso: "IND", currency: "INR" },
  "indonésie": { iso: "IDN", currency: "IDR" },
  "irák": { iso: "IRQ", currency: "IQD" },
  "írán": { iso: "IRN", currency: "IRR" },
  "irsko": { iso: "IRL", currency: "EUR" },
  "island": { iso: "ISL", currency: "ISK" },
  "itálie": { iso: "ITA", currency: "EUR" },
  "izrael": { iso: "ISR", currency: "ILS" },
  "jamajka": { iso: "JAM", currency: "JMD" },
  "japonsko": { iso: "JPN", currency: "JPY" },
  "jemen": { iso: "YEM", currency: "YER" },
  "jihoafrická republika": { iso: "ZAF", currency: "ZAR" },
  "jižní korea": { iso: "KOR", currency: "KRW" },
  "jordánsko": { iso: "JOR", currency: "JOD" },
  "kambodža": { iso: "KHM", currency: "KHR" },
  "kamerun": { iso: "CMR", currency: "XAF" },
  "kanada": { iso: "CAN", currency: "CAD" },
  "kapverdy": { iso: "CPV", currency: "CVE" },
  "katar": { iso: "QAT", currency: "QAR" },
  "kazachstán": { iso: "KAZ", currency: "KZT" },
  "keňa": { iso: "KEN", currency: "KES" },
  "kolumbie": { iso: "COL", currency: "COP" },
  "kostarika": { iso: "CRI", currency: "CRC" },
  "kuba": { iso: "CUB", currency: "CUP" },
  "kuvajt": { iso: "KWT", currency: "KWD" },
  "kypr": { iso: "CYP", currency: "EUR" },
  "kyrgyzstán": { iso: "KGZ", currency: "KGS" },
  "laos": { iso: "LAO", currency: "LAK" },
  "libanon": { iso: "LBN", currency: "LBP" },
  "libye": { iso: "LBY", currency: "LYD" },
  "lichtenštejnsko": { iso: "LIE", currency: "CHF" },
  "litva": { iso: "LTU", currency: "EUR" },
  "lotyšsko": { iso: "LVA", currency: "EUR" },
  "lucembursko": { iso: "LUX", currency: "EUR" },
  "madagaskar": { iso: "MDG", currency: "MGA" },
  "maďarsko": { iso: "HUN", currency: "HUF" },
  "malajsie": { iso: "MYS", currency: "MYR" },
  "maledivy": { iso: "MDV", currency: "MVR" },
  "malta": { iso: "MLT", currency: "EUR" },
  "maroko": { iso: "MAR", currency: "MAD" },
  "mauricius": { iso: "MUS", currency: "MUR" },
  "mauritánie": { iso: "MRT", currency: "MRU" },
  "mexiko": { iso: "MEX", currency: "MXN" },
  "moldavsko": { iso: "MDA", currency: "MDL" },
  "monako": { iso: "MCO", currency: "EUR" },
  "mongolsko": { iso: "MNG", currency: "MNT" },
  "mosambik": { iso: "MOZ", currency: "MZN" },
  "myanmar": { iso: "MMR", currency: "MMK" },
  "namibie": { iso: "NAM", currency: "NAD" },
  "německo": { iso: "DEU", currency: "EUR" },
  "nepál": { iso: "NPL", currency: "NPR" },
  "nigérie": { iso: "NGA", currency: "NGN" },
  "nikaragua": { iso: "NIC", currency: "NIO" },
  "nizozemsko": { iso: "NLD", currency: "EUR" },
  "norsko": { iso: "NOR", currency: "NOK" },
  "nový zéland": { iso: "NZL", currency: "NZD" },
  "omán": { iso: "OMN", currency: "OMR" },
  "pákistán": { iso: "PAK", currency: "PKR" },
  "panama": { iso: "PAN", currency: "PAB" },
  "paraguay": { iso: "PRY", currency: "PYG" },
  "peru": { iso: "PER", currency: "PEN" },
  "pobřeží slonoviny": { iso: "CIV", currency: "XOF" },
  "polsko": { iso: "POL", currency: "PLN" },
  "portoriko": { iso: "PRI", currency: "USD" },
  "portugalsko": { iso: "PRT", currency: "EUR" },
  "rakousko": { iso: "AUT", currency: "EUR" },
  "rumunsko": { iso: "ROU", currency: "RON" },
  "rusko": { iso: "RUS", currency: "RUB" },
  "řecko": { iso: "GRC", currency: "EUR" },
  "salvador": { iso: "SLV", currency: "USD" },
  "saúdská arábie": { iso: "SAU", currency: "SAR" },
  "senegal": { iso: "SEN", currency: "XOF" },
  "severní makedonie": { iso: "MKD", currency: "MKD" },
  "singapur": { iso: "SGP", currency: "SGD" },
  "slovensko": { iso: "SVK", currency: "EUR" },
  "slovinsko": { iso: "SVN", currency: "EUR" },
  "spojené arabské emiráty": { iso: "ARE", currency: "AED" },
  "spojené státy": { iso: "USA", currency: "USD" },
  "spojené státy americké": { iso: "USA", currency: "USD" },
  "srbsko": { iso: "SRB", currency: "RSD" },
  "srí lanka": { iso: "LKA", currency: "LKR" },
  "středoafrická republika": { iso: "CAF", currency: "XAF" },
  "súdán": { iso: "SDN", currency: "SDG" },
  "surinam": { iso: "SUR", currency: "SRD" },
  "svazijsko": { iso: "SWZ", currency: "SZL" },
  "eswatini": { iso: "SWZ", currency: "SZL" },
  "sýrie": { iso: "SYR", currency: "SYP" },
  "španělsko": { iso: "ESP", currency: "EUR" },
  "švédsko": { iso: "SWE", currency: "SEK" },
  "švýcarsko": { iso: "CHE", currency: "CHF" },
  "tádžikistán": { iso: "TJK", currency: "TJS" },
  "tanzanie": { iso: "TZA", currency: "TZS" },
  "thajsko": { iso: "THA", currency: "THB" },
  "tchaj-wan": { iso: "TWN", currency: "TWD" },
  "togo": { iso: "TGO", currency: "XOF" },
  "trinidad a tobago": { iso: "TTO", currency: "TTD" },
  "tunisko": { iso: "TUN", currency: "TND" },
  "turecko": { iso: "TUR", currency: "TRY" },
  "turkmenistán": { iso: "TKM", currency: "TMT" },
  "uganda": { iso: "UGA", currency: "UGX" },
  "ukrajina": { iso: "UKR", currency: "UAH" },
  "uruguay": { iso: "URY", currency: "UYU" },
  "uzbekistán": { iso: "UZB", currency: "UZS" },
  "venezuela": { iso: "VEN", currency: "VES" },
  "vietnam": { iso: "VNM", currency: "VND" },
  "zambie": { iso: "ZMB", currency: "ZMW" },
  "zimbabwe": { iso: "ZWE", currency: "ZWL" },
  "černá hora": { iso: "MNE", currency: "EUR" },
  "kosovo": { iso: "XKX", currency: "EUR" },
  "seychely": { iso: "SYC", currency: "SCR" },
  "fidži": { iso: "FJI", currency: "FJD" },
  "cookovy ostrovy": { iso: "COK", currency: "NZD" },
  "dominika": { iso: "DMA", currency: "XCD" },
  "antigua a barbuda": { iso: "ATG", currency: "XCD" },
  "skotsko": { iso: "SCO", currency: "GBP" },
  "anglie": { iso: "ENG", currency: "GBP" },
  "wales": { iso: "WAL", currency: "GBP" },
  "spojené království": { iso: "GBR", currency: "GBP" },
  "velká británie": { iso: "GBR", currency: "GBP" },
  "severní kypr": { iso: "NCY", currency: "TRY" },
};

const lookupCountryData = (name: string) => {
  const key = name.trim().toLowerCase();
  return COUNTRY_DATA[key] || null;
};

export const searchCountries = (query: string, limit = 10) => {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  return Object.entries(COUNTRY_DATA)
    .filter(([key]) => key.includes(q))
    .slice(0, limit)
    .map(([key, val]) => ({ 
      name: key.charAt(0).toUpperCase() + key.slice(1), 
      iso: val.iso, 
      currency: val.currency 
    }));
};

// Known destination → country mapping for intelligent suggestions
const DESTINATION_COUNTRY_MAP: Record<string, string> = {
  // Egypt
  "hurghada": "egypt", "sharm el sheikh": "egypt", "marsa alam": "egypt", "el gouna": "egypt",
  "dahab": "egypt", "taba": "egypt", "luxor": "egypt", "aswan": "egypt", "káhira": "egypt",
  "alexandria": "egypt", "soma bay": "egypt", "makadi bay": "egypt", "sahl hasheesh": "egypt",
  // Turecko
  "antalya": "turecko", "alanya": "turecko", "belek": "turecko", "side": "turecko",
  "kemer": "turecko", "bodrum": "turecko", "marmaris": "turecko", "fethiye": "turecko",
  "kusadasi": "turecko", "dalaman": "turecko", "ölüdeniz": "turecko", "istanbul": "turecko",
  "kappadokie": "turecko", "kapadocie": "turecko", "lara": "turecko", "kundu": "turecko",
  // Řecko
  "kréta": "řecko", "rhodos": "řecko", "korfu": "řecko", "santorini": "řecko",
  "zakynthos": "řecko", "kos": "řecko", "mykonos": "řecko", "lefkada": "řecko",
  "thassos": "řecko", "samos": "řecko", "kefalonie": "řecko", "atény": "řecko",
  "chalkidiki": "řecko", "skiathos": "řecko", "paros": "řecko", "naxos": "řecko",
  // Španělsko
  "mallorca": "španělsko", "tenerife": "španělsko", "gran canaria": "španělsko",
  "fuerteventura": "španělsko", "lanzarote": "španělsko", "ibiza": "španělsko",
  "costa brava": "španělsko", "costa del sol": "španělsko", "costa blanca": "španělsko",
  "barcelona": "španělsko", "madrid": "španělsko", "málaga": "španělsko",
  "menorca": "španělsko", "la palma": "španělsko", "marbella": "španělsko",
  // Chorvatsko
  "dubrovník": "chorvatsko", "split": "chorvatsko", "zadar": "chorvatsko",
  "makarska": "chorvatsko", "pula": "chorvatsko", "rovinj": "chorvatsko",
  "hvar": "chorvatsko", "brač": "chorvatsko", "korčula": "chorvatsko",
  "opatija": "chorvatsko", "trogir": "chorvatsko", "šibenik": "chorvatsko",
  // Itálie
  "řím": "itálie", "milán": "itálie", "benátky": "itálie", "florencie": "itálie",
  "neapol": "itálie", "sicílie": "itálie", "sardinie": "itálie", "toskánsko": "itálie",
  "amalfi": "itálie", "capri": "itálie", "como": "itálie", "garda": "itálie",
  "rimini": "itálie", "kalábrie": "itálie", "puglie": "itálie", "lignano": "itálie",
  "bibione": "itálie", "caorle": "itálie", "lido di jesolo": "itálie",
  // Portugalsko
  "algarve": "portugalsko", "lisabon": "portugalsko", "porto": "portugalsko",
  "madeira": "portugalsko", "azory": "portugalsko", "faro": "portugalsko",
  "vilamoura": "portugalsko", "albufeira": "portugalsko", "lagos": "portugalsko",
  "cascais": "portugalsko", "sintra": "portugalsko", "tavira": "portugalsko",
  "quinta do lago": "portugalsko", "vale do lobo": "portugalsko",
  // Tunisko
  "hammamet": "tunisko", "sousse": "tunisko", "djerba": "tunisko",
  "monastir": "tunisko", "port el kantaoui": "tunisko", "mahdia": "tunisko",
  // SAE
  "dubaj": "spojené arabské emiráty", "abu dhabi": "spojené arabské emiráty",
  "ras al khaimah": "spojené arabské emiráty", "šardžá": "spojené arabské emiráty",
  "ajmán": "spojené arabské emiráty",
  // Thajsko
  "phuket": "thajsko", "bangkok": "thajsko", "pattaya": "thajsko",
  "koh samui": "thajsko", "krabi": "thajsko", "chiang mai": "thajsko",
  "koh phangan": "thajsko", "koh lanta": "thajsko", "hua hin": "thajsko",
  // Mauricius
  "belle mare": "mauricius", "grand baie": "mauricius", "flic en flac": "mauricius",
  "le morne": "mauricius", "trou aux biches": "mauricius",
  // Maledivy
  "malé": "maledivy", "ari atol": "maledivy", "baa atol": "maledivy",
  // Dominikánská republika
  "punta cana": "dominikánská republika", "puerto plata": "dominikánská republika",
  "la romana": "dominikánská republika", "samaná": "dominikánská republika",
  "bavaro": "dominikánská republika",
  // Mexiko
  "cancún": "mexiko", "riviera maya": "mexiko", "playa del carmen": "mexiko",
  "los cabos": "mexiko", "tulum": "mexiko",
  // Kuba
  "varadero": "kuba", "havana": "kuba", "cayo coco": "kuba",
  "cayo santa maria": "kuba", "holguín": "kuba",
  // Bulharsko
  "slunečné pobřeží": "bulharsko", "zlaté písky": "bulharsko",
  "nesebar": "bulharsko", "sozopol": "bulharsko", "burgas": "bulharsko",
  "sv. konstantin": "bulharsko", "pomorie": "bulharsko",
  // Černá Hora
  "budva": "černá hora", "bečiči": "černá hora", "kotor": "černá hora",
  "tivat": "černá hora", "herceg novi": "černá hora", "ulcinj": "černá hora",
  // Tunisko
  // Seychely
  "mahé": "seychely", "praslin": "seychely", "la digue": "seychely",
  // Zanzibar / Tanzanie
  "zanzibar": "tanzanie", "nungwi": "tanzanie", "kendwa": "tanzanie",
  // Srí Lanka
  "colombo": "srí lanka", "negombo": "srí lanka", "bentota": "srí lanka",
  "unawatuna": "srí lanka",
  // Kapverdy
  "sal": "kapverdy", "boa vista": "kapverdy", "santiago": "kapverdy",
  // Maroko
  "marrákeš": "maroko", "agadir": "maroko", "fez": "maroko", "casablanca": "maroko",
  // Kypr
  "ayia napa": "kypr", "paphos": "kypr", "limassol": "kypr", "larnaka": "kypr", "protaras": "kypr",
  // Jihoafrická republika
  "kapské město": "jihoafrická republika", "johannesburg": "jihoafrická republika",
  "durban": "jihoafrická republika", "krugerův park": "jihoafrická republika",
  // Rakousko
  "vídeň": "rakousko", "salzburg": "rakousko", "innsbruck": "rakousko", "tyrolsko": "rakousko",
  // Francie
  "paříž": "francie", "nice": "francie", "cannes": "francie", "marseille": "francie",
  "lyon": "francie", "korsika": "francie", "provence": "francie", "côte d'azur": "francie",
  // Velká Británie – not in COUNTRY_DATA, skip
  // Německo
  "berlín": "německo", "mnichov": "německo",
  // Maďarsko
  "budapešť": "maďarsko", "balaton": "maďarsko",
  // Golf destinations
  "vilamoura golf": "portugalsko", "belek golf": "turecko",
  "costa del sol golf": "španělsko", "algarve golf": "portugalsko",
  // Skotsko
  "st andrews": "skotsko", "edinburgh": "skotsko", "glasgow": "skotsko",
  "aberdeen": "skotsko", "inverness": "skotsko", "highlands": "skotsko",
  "carnoustie": "skotsko", "turnberry": "skotsko", "gleneagles": "skotsko",
  "royal troon": "skotsko", "muirfield": "skotsko", "kingsbarns": "skotsko",
  // Anglie
  "londýn": "anglie", "manchester": "anglie", "liverpool": "anglie",
  "birmingham": "anglie", "bath": "anglie", "oxford": "anglie",
  "the belfry": "anglie", "wentworth": "anglie", "sunningdale": "anglie",
  // Wales
  "cardiff": "wales", "swansea": "wales", "celtic manor": "wales",
  "royal porthcawl": "wales",
};

/**
 * Search known destinations by query (≥3 chars).
 * Returns destination name + matched country data.
 */
export const searchDestinations = (query: string, limit = 10) => {
  const q = query.trim().toLowerCase();
  if (q.length < 3) return [];
  const results: { destination: string; countryName: string; iso: string; currency: string }[] = [];

  for (const [dest, countryKey] of Object.entries(DESTINATION_COUNTRY_MAP)) {
    if (dest.includes(q) || q.includes(dest)) {
      const countryInfo = COUNTRY_DATA[countryKey];
      if (countryInfo) {
        const destCapitalized = dest.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const countryCapitalized = countryKey.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        results.push({
          destination: destCapitalized,
          countryName: countryCapitalized,
          iso: countryInfo.iso,
          currency: countryInfo.currency,
        });
      }
    }
    if (results.length >= limit) break;
  }
  return results;
};
