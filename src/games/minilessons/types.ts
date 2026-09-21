export interface MiniLesson {
  id: string;
  number: number;
  title: string;
  prompt?: string;
  core?: string;
  rule?: string;
  trigger?: string;
  note?: string;
  examples?: string[] | string;
  tags?: string[];
  intensity?: number;
}
