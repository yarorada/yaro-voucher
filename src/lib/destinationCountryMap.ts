/**
 * Mapa nejčastějších golfových destinací v češtině → název země v databázi
 * Klíče jsou lowercase bez diakritiky pro snadné porovnávání
 */
const DESTINATION_COUNTRY_MAP: Record<string, string> = {
  // Rakousko
  "viden": "Rakousko",
  "vídeň": "Rakousko",
  "salcburk": "Rakousko",
  "salzburg": "Rakousko",
  "innsbruck": "Rakousko",
  "graz": "Rakousko",
  "leogang": "Rakousko",
  "zell am see": "Rakousko",
  "bad gastein": "Rakousko",
  "saalbach": "Rakousko",
  "schladming": "Rakousko",

  // Španělsko
  "mallorca": "Španělsko",
  "majorka": "Španělsko",
  "costa del sol": "Španělsko",
  "marbella": "Španělsko",
  "benalmadena": "Španělsko",
  "torremolinos": "Španělsko",
  "fuengirola": "Španělsko",
  "nerja": "Španělsko",
  "granada": "Španělsko",
  "madrid": "Španělsko",
  "barcelona": "Španělsko",
  "valencia": "Španělsko",
  "sevilla": "Španělsko",
  "ibiza": "Španělsko",
  "menorca": "Španělsko",
  "tenerife": "Španělsko",
  "fuerteventura": "Španělsko",
  "gran canaria": "Španělsko",
  "lanzarote": "Španělsko",
  "costa brava": "Španělsko",
  "costa blanca": "Španělsko",
  "sitges": "Španělsko",
  "alicante": "Španělsko",

  // Turecko
  "antalya": "Turecko",
  "istanbul": "Turecko",
  "belek": "Turecko",
  "bodrum": "Turecko",
  "kusadasi": "Turecko",
  "alanya": "Turecko",
  "side": "Turecko",
  "kemer": "Turecko",
  "fethiye": "Turecko",
  "marmaris": "Turecko",
  "izmir": "Turecko",
  "dalaman": "Turecko",

  // Itálie
  "rim": "Itálie",
  "řím": "Itálie",
  "milano": "Itálie",
  "milan": "Itálie",
  "miláno": "Itálie",
  "florencie": "Itálie",
  "florenz": "Itálie",
  "benátky": "Itálie",
  "venice": "Itálie",
  "sicilie": "Itálie",
  "sicílie": "Itálie",
  "sardinie": "Itálie",
  "sardínie": "Itálie",
  "capri": "Itálie",
  "amalfi": "Itálie",
  "positano": "Itálie",
  "naples": "Itálie",
  "napolí": "Itálie",
  "napolie": "Itálie",
  "toskánsko": "Itálie",
  "toscana": "Itálie",
  "lago di garda": "Itálie",
  "garda": "Itálie",
  "rimini": "Itálie",

  // Portugalsko
  "algarve": "Portugalsko",
  "lisabon": "Portugalsko",
  "lisbon": "Portugalsko",
  "porto": "Portugalsko",
  "madeira": "Portugalsko",
  "funchal": "Portugalsko",
  "vilamoura": "Portugalsko",
  "albufeira": "Portugalsko",
  "cascais": "Portugalsko",
  "sintra": "Portugalsko",
  "estoril": "Portugalsko",

  // Francie
  "paris": "Francie",
  "paříž": "Francie",
  "nice": "Francie",
  "cannes": "Francie",
  "monaco": "Francie",
  "antibes": "Francie",
  "lyon": "Francie",
  "bordeaux": "Francie",
  "marseille": "Francie",
  "côte d'azur": "Francie",
  "cote d azur": "Francie",
  "normandie": "Francie",
  "bretagne": "Francie",

  // Chorvatsko
  "dubrovník": "Chorvatsko",
  "dubrovnik": "Chorvatsko",
  "split": "Chorvatsko",
  "zadar": "Chorvatsko",
  "hvar": "Chorvatsko",
  "brač": "Chorvatsko",
  "brac": "Chorvatsko",
  "korčula": "Chorvatsko",
  "korcula": "Chorvatsko",
  "rovinj": "Chorvatsko",
  "pula": "Chorvatsko",
  "zagreb": "Chorvatsko",
  "záhřeb": "Chorvatsko",

  // Řecko
  "rhodos": "Řecko",
  "rhodes": "Řecko",
  "kréta": "Řecko",
  "kreta": "Řecko",
  "crete": "Řecko",
  "korfu": "Řecko",
  "corfu": "Řecko",
  "mykonos": "Řecko",
  "santorini": "Řecko",
  "zakynthos": "Řecko",
  "kefalonia": "Řecko",
  "atény": "Řecko",
  "athens": "Řecko",
  "thessaloniki": "Řecko",
  "kos": "Řecko",
  "lefkada": "Řecko",
  "chalkidiki": "Řecko",

  // Kypr
  "kypr": "Kypr",
  "cyprus": "Kypr",
  "larnaka": "Kypr",
  "larnaca": "Kypr",
  "limassol": "Kypr",
  "paphos": "Kypr",
  "nicosia": "Kypr",
  "nikósie": "Kypr",
  "ayia napa": "Kypr",

  // Maroko
  "marrakech": "Maroko",
  "marrakéš": "Maroko",
  "marrakesh": "Maroko",
  "agadir": "Maroko",
  "casablanca": "Maroko",
  "fes": "Maroko",
  "fez": "Maroko",
  "tangier": "Maroko",

  // Egypt
  "hurghada": "Egypt",
  "sharm el sheikh": "Egypt",
  "luxor": "Egypt",
  "káhira": "Egypt",
  "cairo": "Egypt",
  "marsa alam": "Egypt",

  // Spojené arabské emiráty
  "dubai": "Spojené arabské emiráty",
  "dubaj": "Spojené arabské emiráty",
  "abu dhabi": "Spojené arabské emiráty",
  "abú dhabí": "Spojené arabské emiráty",
  "sharjah": "Spojené arabské emiráty",

  // Thajsko
  "phuket": "Thajsko",
  "bangkok": "Thajsko",
  "pattaya": "Thajsko",
  "koh samui": "Thajsko",
  "chiang mai": "Thajsko",
  "hua hin": "Thajsko",

  // Irsko
  "dublin": "Irsko",
  "irsko": "Irsko",
  "ireland": "Irsko",
  "kerry": "Irsko",

  // Skotsko / UK
  "skotsko": "Spojené království",
  "scotland": "Spojené království",
  "edinburgh": "Spojené království",
  "london": "Spojené království",
  "londýn": "Spojené království",
  "st andrews": "Spojené království",

  // Německo
  "berlin": "Německo",
  "berlín": "Německo",
  "münchen": "Německo",
  "mnichov": "Německo",
  "hamburg": "Německo",
  "frankfurt": "Německo",
  "drážďany": "Německo",
  "dresden": "Německo",

  // Maďarsko
  "budapešť": "Maďarsko",
  "budapest": "Maďarsko",
  "maďarsko": "Maďarsko",

  // Slovensko
  "bratislava": "Slovensko",
  "tatry": "Slovensko",
  "vysoké tatry": "Slovensko",
  "piešťany": "Slovensko",

  // Polsko
  "krakov": "Polsko",
  "krakow": "Polsko",
  "kraków": "Polsko",
  "varšava": "Polsko",
  "warsaw": "Polsko",

  // Česko
  "praha": "Česká republika",
  "prague": "Česká republika",
  "karlovy vary": "Česká republika",
  "mariánské lázně": "Česká republika",
  "brno": "Česká republika",
};

/**
 * Pokusí se automaticky určit zemi z názvu destinace.
 * Porovnání je case-insensitive a ignoruje diakritiku.
 */
export function guessCountryFromDestination(destinationName: string): string | null {
  const normalized = destinationName.toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Přímá shoda (bez diakritiky)
  if (DESTINATION_COUNTRY_MAP[normalized]) {
    return DESTINATION_COUNTRY_MAP[normalized];
  }

  // Shoda s klíčem po odstranění diakritiky z klíče
  for (const [key, country] of Object.entries(DESTINATION_COUNTRY_MAP)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedKey === normalized) {
      return country;
    }
  }

  // Částečná shoda (destinace obsahuje klíčové slovo nebo naopak)
  for (const [key, country] of Object.entries(DESTINATION_COUNTRY_MAP)) {
    const normalizedKey = key.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalized.includes(normalizedKey) || normalizedKey.includes(normalized)) {
      return country;
    }
  }

  return null;
}
