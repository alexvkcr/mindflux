export const CORPUS = {
  animales: [
    "jirafa", "elefante", "rinoceronte", "hipopótamo", "cocodrilo", "delfín",
    "pingüino", "mariposa", "tortuga", "ardilla", "camello", "cebra",
    "koala", "canguro", "leopardo", "ballena", "guepardo", "orangután"
  ],
  ciudades: [
    "Madrid", "Sevilla", "Zaragoza", "Bilbao", "Barcelona", "Toledo",
    "Salamanca", "Córdoba", "Burgos", "Valladolid", "Segovia", "Ávila",
    "Pamplona", "Logroño", "Gijón", "Murcia", "Cáceres", "Soria"
  ],
  frutas: [
    "manzana", "pera", "plátano", "melocotón", "albaricoque", "cereza",
    "pomelo", "uva", "papaya", "lichi", "sandía", "melón",
    "mandarina", "arándano", "frambuesa", "nectarina", "maracuyá", "ciruela"
  ],
  herramientas: [
    "martillo", "destornillador", "alicates", "tenazas", "serrucho", "taladro",
    "formón", "escoplo", "cincel", "amoladora", "rastrillo", "azada",
    "hacha", "caladora", "remachadora", "broca", "berbiquí", "cortafríos"
  ],
  prendas: [
    "camisa", "pantalón", "falda", "abrigo", "chaqueta", "sudadera",
    "jersey", "blusa", "camiseta", "vestido", "calcetín", "bufanda",
    "gorro", "sombrero", "guantes", "zapatillas", "pijama", "chaleco"
  ],
  vehículos: [
    "automóvil", "autobús", "camión", "motocicleta", "bicicleta", "tranvía",
    "helicóptero", "submarino", "velero", "patinete", "tractor", "ambulancia",
    "limusina", "monociclo", "catamarán", "teleférico", "funicular", "dirigible"
  ]
} as const;

export type Category = keyof typeof CORPUS;

export const CATEGORY_LABELS: Record<Category, string> = {
  animales: "Animales",
  ciudades: "Ciudades",
  frutas: "Frutas",
  herramientas: "Herramientas",
  prendas: "Prendas de ropa",
  vehículos: "Vehículos"
};
