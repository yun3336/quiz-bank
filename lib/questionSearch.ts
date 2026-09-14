import type { Question } from "./types";

export type SearchField = "stem" | "chapter" | "tag";

export type QuestionSearchHit = {
  question: Question;
  field: SearchField;
};

const MIN_ASCII = 2;

export function searchReady(query: string): boolean {
  const needle = query.trim();
  if (!needle) return false;
  if (/[\u3400-\u9fff]/.test(needle)) return true;
  return needle.length >= MIN_ASCII;
}

export function matchQuestion(question: Question, query: string): SearchField | null {
  const needle = normalize(query);
  if (!needle) return null;
  if (normalize(question.stem).includes(needle)) return "stem";
  if (question.tags.some((tag) => normalize(tag).includes(needle))) return "tag";
  if (normalize(question.chapter).includes(needle)) return "chapter";
  return null;
}

export function searchQuestions(pool: Question[], query: string, limit = 24): QuestionSearchHit[] {
  if (!searchReady(query)) return [];
  const hits: QuestionSearchHit[] = [];
  for (const question of pool) {
    const field = matchQuestion(question, query);
    if (!field) continue;
    hits.push({ question, field });
  }
  const rank: Record<SearchField, number> = { stem: 0, tag: 1, chapter: 2 };
  hits.sort((a, b) => rank[a.field] - rank[b.field] || a.question.chapter.localeCompare(b.question.chapter, "zh-Hant"));
  return hits.slice(0, limit);
}

export function stemSnippet(stem: string, query: string, max = 72): string {
  const text = stem.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  const needle = query.trim();
  const at = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
  if (at < 0) return `${text.slice(0, max)}…`;
  const start = Math.max(0, at - 12);
  const chunk = text.slice(start, start + max);
  return `${start > 0 ? "…" : ""}${chunk}${start + max < text.length ? "…" : ""}`;
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}
