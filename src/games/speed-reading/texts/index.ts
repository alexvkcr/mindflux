import { quijote } from './quijote';
import { regenta } from './regenta';
import { colmena } from './colmena';

export type BookFragment = {
  text: string;
  chapter: number;
  page: number;
};

export const texts = {
  quijote,
  regenta,
  colmena
} as const;