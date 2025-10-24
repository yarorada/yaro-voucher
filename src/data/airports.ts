export interface Airport {
  iata: string;
  name: string;
  city: string;
  country: string;
}

export const AIRPORTS: Airport[] = [
  // Česká republika
  { iata: "PRG", name: "Václav Havel Airport Prague", city: "Praha", country: "Česká republika" },
  
  // Rakousko
  { iata: "VIE", name: "Vienna International Airport", city: "Vídeň", country: "Rakousko" },
  
  // Turecko - hlavní destinace
  { iata: "IST", name: "Istanbul Airport", city: "Istanbul", country: "Turecko" },
  { iata: "SAW", name: "Sabiha Gökçen International Airport", city: "Istanbul", country: "Turecko" },
  { iata: "AYT", name: "Antalya Airport", city: "Antalya", country: "Turecko" },
  { iata: "ADB", name: "Adnan Menderes Airport", city: "Izmir", country: "Turecko" },
  { iata: "BJV", name: "Bodrum-Milas Airport", city: "Bodrum", country: "Turecko" },
  { iata: "DLM", name: "Dalaman Airport", city: "Dalaman", country: "Turecko" },
  { iata: "GZT", name: "Gaziantep Oğuzeli Airport", city: "Gaziantep", country: "Turecko" },
  { iata: "ESB", name: "Esenboğa Airport", city: "Ankara", country: "Turecko" },
  
  // Německo
  { iata: "MUC", name: "Munich Airport", city: "Mnichov", country: "Německo" },
  { iata: "FRA", name: "Frankfurt Airport", city: "Frankfurt", country: "Německo" },
  { iata: "BER", name: "Berlin Brandenburg Airport", city: "Berlín", country: "Německo" },
  { iata: "HAM", name: "Hamburg Airport", city: "Hamburg", country: "Německo" },
  { iata: "DUS", name: "Düsseldorf Airport", city: "Düsseldorf", country: "Německo" },
  
  // Maďarsko
  { iata: "BUD", name: "Budapest Ferenc Liszt International Airport", city: "Budapešť", country: "Maďarsko" },
  
  // Polsko
  { iata: "WAW", name: "Warsaw Chopin Airport", city: "Varšava", country: "Polsko" },
  { iata: "KRK", name: "John Paul II International Airport Kraków", city: "Krakov", country: "Polsko" },
  
  // Slovensko
  { iata: "BTS", name: "M. R. Štefánik Airport", city: "Bratislava", country: "Slovensko" },
  
  // Španělsko
  { iata: "MAD", name: "Adolfo Suárez Madrid–Barajas Airport", city: "Madrid", country: "Španělsko" },
  { iata: "BCN", name: "Barcelona–El Prat Airport", city: "Barcelona", country: "Španělsko" },
  { iata: "PMI", name: "Palma de Mallorca Airport", city: "Palma", country: "Španělsko" },
  { iata: "AGP", name: "Málaga Airport", city: "Málaga", country: "Španělsko" },
  
  // Itálie
  { iata: "FCO", name: "Leonardo da Vinci–Fiumicino Airport", city: "Řím", country: "Itálie" },
  { iata: "MXP", name: "Milan Malpensa Airport", city: "Milán", country: "Itálie" },
  { iata: "VCE", name: "Venice Marco Polo Airport", city: "Benátky", country: "Itálie" },
  
  // Francie
  { iata: "CDG", name: "Charles de Gaulle Airport", city: "Paříž", country: "Francie" },
  { iata: "ORY", name: "Paris Orly Airport", city: "Paříž", country: "Francie" },
  { iata: "NCE", name: "Nice Côte d'Azur Airport", city: "Nice", country: "Francie" },
  
  // Velká Británie
  { iata: "LHR", name: "London Heathrow Airport", city: "Londýn", country: "Velká Británie" },
  { iata: "LGW", name: "London Gatwick Airport", city: "Londýn", country: "Velká Británie" },
  { iata: "STN", name: "London Stansted Airport", city: "Londýn", country: "Velká Británie" },
  
  // Řecko
  { iata: "ATH", name: "Athens International Airport", city: "Atény", country: "Řecko" },
  { iata: "HER", name: "Heraklion International Airport", city: "Heraklion", country: "Řecko" },
  { iata: "RHO", name: "Rhodes International Airport", city: "Rhodos", country: "Řecko" },
  
  // Další evropská letiště
  { iata: "AMS", name: "Amsterdam Airport Schiphol", city: "Amsterdam", country: "Nizozemsko" },
  { iata: "BRU", name: "Brussels Airport", city: "Brusel", country: "Belgie" },
  { iata: "CPH", name: "Copenhagen Airport", city: "Kodaň", country: "Dánsko" },
  { iata: "OSL", name: "Oslo Airport", city: "Oslo", country: "Norsko" },
  { iata: "ARN", name: "Stockholm Arlanda Airport", city: "Stockholm", country: "Švédsko" },
  { iata: "ZRH", name: "Zurich Airport", city: "Curych", country: "Švýcarsko" },
];
