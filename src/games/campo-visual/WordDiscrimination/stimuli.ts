export type Judgment = "same" | "different";
export type ChangeKind = "substitution" | "transposition" | "insertion" | "deletion" | "accent" | "double";

// Familiar words supply letter shapes only; no answer depends on meaning or spelling.
export const WORDS = [
  "casa", "mesa", "pato", "luna", "gato", "mano", "pelo", "sopa", "nube", "foco",
  "cielo", "playa", "libro", "verde", "barco", "pluma", "brazo", "fruta", "grano", "claro",
  "tarde", "nieve", "campo", "dulce", "fuego", "traje", "llave", "queso", "reloj", "tigre",
  "calle", "perro", "ratón", "lápiz", "árbol", "papel", "salto", "pared", "bolsa", "silla",
  "camino", "ventana", "montaña", "caballo", "escuela", "espejo", "cuchara", "pájaro", "estrella", "jardín",
  "zapato", "botella", "planeta", "pintura", "cortina", "cocina", "cartera", "piscina", "guitarra", "semilla",
  "naranja", "tomate", "sombrero", "paloma", "ratonera", "cascada", "mercado", "cabina", "estación", "pelota",
  "cangrejo", "camiseta", "mariposa", "catedral", "almohada", "chocolate", "calendario", "biblioteca",
  "naturaleza", "ordenador", "primavera", "carretera", "elefante", "aventura", "diamante", "escritorio",
  "paraguas", "fotografía", "habitante", "universo", "televisión", "temperatura", "instrumento", "electricidad",
  "imaginación", "restaurante", "laboratorio", "arquitectura", "mediterráneo", "comunicación", "descubrimiento",
  "extraordinario", "responsabilidad", "independencia", "transformación", "experimentación", "representación",
  "organización", "administración", "concentración", "investigación", "biodiversidad", "interpretación",
  "conversación", "colaboración", "entretenimiento", "participación", "multiplicación", "pronunciación"
].map((word) => word.normalize("NFC"));

export interface Stimulus {
  left: string;
  right: string;
  answer: Judgment;
  change: ChangeKind | null;
}

export interface ResponseResult extends Stimulus {
  response: Judgment;
  correct: boolean;
}

export const EXPOSURE_MS = [2000, 1600, 1200, 1000, 850, 700, 600, 500, 400] as const;
export const SESSION_LENGTHS = [20, 40, 60] as const;

export function normalizeLevel(level: number): number {
  return Number.isFinite(level) ? Math.max(1, Math.min(9, Math.round(level))) : 1;
}

export function exposureForLevel(level: number): number {
  return EXPOSURE_MS[normalizeLevel(level) - 1];
}

function randomIndex(length: number, random: () => number): number {
  return Math.min(length - 1, Math.floor(random() * length));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1, random);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

const LETTERS = "aeiouáéíóúbcdfghjlmnprstvz";
const VOWELS = "aeiouáéíóú";
const CONSONANTS = "bcdfghjlmnprstvz";
const ACCENTS: Record<string, string> = { a: "á", e: "é", i: "í", o: "ó", u: "ú", á: "a", é: "e", í: "i", ó: "o", ú: "u" };

export function transformWord(word: string, kind: Exclude<ChangeKind, "double">, level: number, random: () => number = Math.random): string {
  const source = [...word.normalize("NFC")];
  const high = normalizeLevel(level) >= 7;
  const internal = source.map((_, i) => i).filter((i) => i > 0 && i < source.length - 1);
  const positions = high && internal.length ? internal : source.map((_, i) => i);
  if (kind === "accent") {
    const eligible = positions.filter((i) => ACCENTS[source[i]]);
    if (!eligible.length) return word.normalize("NFC");
    const i = eligible[randomIndex(eligible.length, random)];
    source[i] = ACCENTS[source[i]];
  } else if (kind === "transposition") {
    const eligible = positions.filter((i) => i < source.length - 1 && (!high || i + 1 < source.length - 1) && source[i] !== source[i + 1]);
    if (!eligible.length) return word.normalize("NFC");
    const i = eligible[randomIndex(eligible.length, random)];
    [source[i], source[i + 1]] = [source[i + 1], source[i]];
  } else if (kind === "deletion") {
    source.splice(positions[randomIndex(positions.length, random)], 1);
  } else if (kind === "insertion") {
    const i = positions[randomIndex(positions.length, random)];
    const candidates = [...LETTERS].filter((letter) => letter !== source[i] && letter !== source[i - 1]);
    source.splice(i, 0, candidates[randomIndex(candidates.length, random)]);
  } else {
    const i = positions[randomIndex(positions.length, random)];
    const alphabet = high ? (VOWELS.includes(source[i]) ? VOWELS : CONSONANTS) : LETTERS;
    const candidates = [...alphabet].filter((letter) => letter !== source[i] && letter !== ACCENTS[source[i]]);
    source[i] = candidates[randomIndex(candidates.length, random)];
  }
  return source.join("").normalize("NFC");
}

export function createDifferent(word: string, level: number, random: () => number = Math.random): Stimulus {
  const normalized = word.normalize("NFC");
  const band = normalizeLevel(level);
  const kinds: Exclude<ChangeKind, "double">[] = band <= 3
    ? ["substitution", "transposition", "insertion", "deletion"]
    : band <= 6 ? ["substitution", "transposition", "insertion", "deletion", "accent"]
      : ["substitution", "transposition", "accent", "substitution", "transposition"];
  for (let attempt = 0; attempt < 30; attempt++) {
    const double = band <= 2 && random() < 0.4;
    if (double && normalized.length >= 2) {
      const letters = [...normalized];
      const first = randomIndex(letters.length, random);
      const second = (first + 1 + randomIndex(letters.length - 1, random)) % letters.length;
      for (const i of [first, second]) {
        const candidates = [...LETTERS].filter((letter) => letter !== letters[i] && letter !== ACCENTS[letters[i]]);
        letters[i] = candidates[randomIndex(candidates.length, random)];
      }
      return { left: normalized, right: letters.join("").normalize("NFC"), answer: "different", change: "double" };
    }
    const kind = kinds[randomIndex(kinds.length, random)];
    const right = transformWord(normalized, kind, band, random);
    if (right !== normalized) {
      return { left: normalized, right, answer: "different", change: kind };
    }
  }
  // A changed letter is always available for corpus words.
  return { left: normalized, right: transformWord(normalized, "substitution", band, () => 0), answer: "different", change: "substitution" };
}

export function createSession(level: number, length: 20 | 40 | 60, random: () => number = Math.random): Stimulus[] {
  const band = normalizeLevel(level);
  const pool = WORDS.filter((word) => band <= 3 ? word.length <= 6 : band <= 6 ? word.length >= 6 && word.length <= 9 : word.length >= 10);
  const words: string[] = [];
  while (words.length < length) words.push(...shuffle([...pool], random));
  const answers = shuffle(Array.from({ length }, (_, i): Judgment => i < length / 2 ? "same" : "different"), random);
  return answers.map((answer, i) => answer === "same"
    ? { left: words[i], right: words[i], answer, change: null }
    : createDifferent(words[i], band, random));
}

export function evaluate(stimulus: Stimulus, response: Judgment): ResponseResult {
  return { ...stimulus, response, correct: response === stimulus.answer };
}

export function summarize(results: ResponseResult[]) {
  const hits = results.filter((result) => result.correct).length;
  return {
    hits,
    differentAsSame: results.filter((result) => result.answer === "different" && result.response === "same").length,
    sameAsDifferent: results.filter((result) => result.answer === "same" && result.response === "different").length,
    accuracy: results.length ? Math.round((hits / results.length) * 100) : 0,
    misses: results.filter((result) => !result.correct)
  };
}
