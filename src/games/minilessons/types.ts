export type MiniLessonId = string | number;

export type MiniLesson = {
  id: string;
  number: number;
  title: string;
  prompt: string;
  core?: string;
  rule?: string;
  trigger?: string;
  examples?: string[];
  note?: string;
  tags?: string[];
  intensity?: 1 | 2 | 3 | 4 | 5;
};