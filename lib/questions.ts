import type { Question, QuestionType } from "./types";

export const ALL_CHAPTER = "全部章節";

export type DifficultyFilter = 1 | 2 | 3 | "all";

export const DIFFICULTY_OPTIONS: { id: DifficultyFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: 1, label: "入門" },
  { id: 2, label: "中等" },
  { id: 3, label: "進階" },
];

export function byDifficulty<T extends { difficulty: 1 | 2 | 3 }>(
  items: T[],
  difficulty?: DifficultyFilter,
): T[] {
  if (!difficulty || difficulty === "all") return items;
  return items.filter((item) => item.difficulty === difficulty);
}

export function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function groupPickUnits<T extends { passageId?: string }>(pool: T[]): T[][] {
  const byPassage = new Map<string, T[]>();
  for (const question of pool) {
    if (!question.passageId) continue;
    const list = byPassage.get(question.passageId) ?? [];
    list.push(question);
    byPassage.set(question.passageId, list);
  }
  const used = new Set<string>();
  const units: T[][] = [];
  for (const question of pool) {
    if (!question.passageId) {
      units.push([question]);
      continue;
    }
    if (used.has(question.passageId)) continue;
    used.add(question.passageId);
    units.push(byPassage.get(question.passageId) ?? [question]);
  }
  return units;
}

export function flattenPickUnits<T>(units: T[][]): T[] {
  return units.flat();
}

export type { QuestionType };
