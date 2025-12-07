export type GrammarCategory = "mascSingular" | "femSingular" | "mascPlural" | "femPlural";

export interface ArticleOption {
  value: string;
  category: GrammarCategory;
}

export const ARTICLES: ArticleOption[] = [
  { value: "un", category: "mascSingular" },
  { value: "una", category: "femSingular" },
  { value: "unos", category: "mascPlural" },
  { value: "unas", category: "femPlural" },
  { value: "el", category: "mascSingular" },
  { value: "la", category: "femSingular" },
  { value: "los", category: "mascPlural" },
  { value: "las", category: "femPlural" }
];

export const NOUNS: Record<GrammarCategory, string[]> = {
  mascSingular: ["gato", "perro", "libro", "rio", "juego"],
  femSingular: ["casa", "taza", "planta", "nube", "silla"],
  mascPlural: ["gatos", "perros", "libros", "rios", "juegos"],
  femPlural: ["casas", "tazas", "plantas", "nubes", "sillas"]
};
