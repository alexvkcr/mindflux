import type { MiniLesson } from "../types";

type MiniLessonFrequencyMap = Readonly<Record<string, number>>;

function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const key = String(value).trim();
  return key.length > 0 ? key : null;
}

function getFrequencyKeys(lesson: MiniLesson, index: number): string[] {
  const keys = [
    normalizeKey(lesson.id),
    normalizeKey(lesson.number),
    normalizeKey(lesson.title),
    normalizeKey(index + 1)
  ];

  return Array.from(new Set(keys.filter((key): key is string => key !== null)));
}

export function getMiniLessonFrequency(
  lesson: MiniLesson,
  index: number,
  frequencyMap: MiniLessonFrequencyMap
): number {
  const keys = getFrequencyKeys(lesson, index);

  for (const key of keys) {
    const rawFrequency = frequencyMap[key];
    if (typeof rawFrequency === "number" && Number.isFinite(rawFrequency)) {
      return Math.max(0, Math.floor(rawFrequency));
    }
  }

  return 1;
}

export function buildWeightedDeck<T extends MiniLesson>(
  lessons: readonly T[],
  frequencyMap: MiniLessonFrequencyMap
): T[] {
  const weightedDeck: T[] = [];

  lessons.forEach((lesson, index) => {
    const frequency = getMiniLessonFrequency(lesson, index, frequencyMap);
    for (let copy = 0; copy < frequency; copy += 1) {
      weightedDeck.push(lesson);
    }
  });

  return weightedDeck;
}

export function pickWeightedLesson<T>(deck: readonly T[]): T | null {
  if (deck.length === 0) {
    return null;
  }

  return deck[Math.floor(Math.random() * deck.length)] ?? null;
}
