import "server-only";
import { isChoiceType, type Question } from "./types";
import { revealAnswer } from "./grade";
import {
  byDifficulty,
  groupPickUnits,
  shuffle,
  type DifficultyFilter,
} from "./questions";
import { filterQuestions, getQuestionMap, pickQuestions } from "./questions.server";
import type { LanguagePracticeMode } from "./languagePractice";
import type { Vendor } from "./vendor";

export const MATCH_MAX = 8;

function correctTexts(question: Question): string[] {
  if (question.options && question.answer) {
    return question.answer
      .map((id) => question.options?.find((option) => option.id === id)?.text ?? "")
      .filter(Boolean);
  }
  const revealed = revealAnswer(question);
  return revealed ? [revealed] : [];
}

export function bundleMatchQuestion(items: Question[]): Question {
  return {
    id: `match-bundle:${items.map((item) => item.id).join(",")}`,
    chapter: items[0]?.chapter ?? "語言",
    tags: ["配對"],
    difficulty: 1,
    type: "match",
    stem: "將左邊與右邊正確配對。",
    explanation: items
      .map((item) => `${item.stem} → ${correctTexts(item).join("、")}。${item.explanation}`)
      .join(" "),
    pairs: items.map((item) => ({
      left: item.stem,
      right: correctTexts(item).join("、"),
    })),
  };
}

const MATCH_BUNDLE_PREFIX = "match-bundle:";

export function resolveFullQuestion(id: string): Question | undefined {
  const map = getQuestionMap();
  const found = map.get(id);
  if (found) return found;
  if (!id.startsWith(MATCH_BUNDLE_PREFIX)) return undefined;
  const sourceIds = id.slice(MATCH_BUNDLE_PREFIX.length).split(",").filter(Boolean);
  if (sourceIds.length < 2) return undefined;
  const items = sourceIds
    .map((sourceId) => map.get(sourceId))
    .filter((item): item is Question => Boolean(item));
  if (items.length !== sourceIds.length) return undefined;
  return { ...bundleMatchQuestion(items), id };
}

export function expandPassage(question: Question): Question[] {
  if (!question.passageId) return [question];
  return filterQuestions({}).filter((item) => item.passageId === question.passageId);
}

export function pickLanguageQuiz(options: {
  vendor: Vendor;
  chapter?: string;
  count: number | "all";
  random: boolean;
  method: LanguagePracticeMode;
  difficulty?: DifficultyFilter;
}): Question[] {
  const base = {
    vendor: options.vendor,
    chapter: options.chapter,
    count: options.count,
    random: options.random,
    difficulty: options.difficulty,
  };
  if (options.method === "mixed") return pickQuestions({ ...base });
  if (options.method === "choice") {
    return pickQuestions({ ...base, types: ["single", "multiple", "boolean"], excludePassage: true });
  }
  if (options.method === "cloze") {
    const pool = byDifficulty(
      filterQuestions({ vendor: options.vendor, chapter: options.chapter }).filter((item) => !item.passageId),
      options.difficulty,
    );
    const native = pool.filter((item) => item.type === "cloze" || item.type === "short");
    const converted = pool
      .filter((item) => item.type === "single" || item.type === "boolean")
      .map((item) => ({
        ...item,
        type: "short" as const,
        aliases: Array.from(new Set([...correctTexts(item), ...(item.answer ?? [])])),
      }));
    const ordered = options.random ? [...shuffle(native), ...shuffle(converted)] : [...native, ...converted];
    if (options.count === "all") return ordered;
    return ordered.slice(0, Math.min(options.count, ordered.length));
  }
  if (options.method === "match") {
    const pool = byDifficulty(
      filterQuestions({ vendor: options.vendor, chapter: options.chapter }).filter((item) => !item.passageId),
      options.difficulty,
    );
    const native = options.random
      ? shuffle(pool.filter((item) => item.type === "match"))
      : pool.filter((item) => item.type === "match");
    const limit = options.count === "all" ? native.length : options.count;
    const picked = native.slice(0, limit);
    if (options.count === "all" || picked.length >= options.count) return picked;

    const mcq = (options.random ? shuffle(pool) : pool).filter((item) => item.type === "single");
    let offset = 0;
    while (picked.length < options.count && offset < mcq.length) {
      const chunk = mcq.slice(offset, offset + MATCH_MAX);
      offset += MATCH_MAX;
      if (chunk.length < 2) break;
      picked.push(bundleMatchQuestion(chunk));
    }
    return picked;
  }
  if (options.method === "translate") return pickQuestions({ ...base, types: ["translate"] });
  if (options.method === "dictation") return pickQuestions({ ...base, types: ["dictation"] });
  if (options.method === "hotspot") return pickQuestions({ ...base, types: ["hotspot"] });
  if (options.method === "speak") return pickQuestions({ ...base, types: ["speak"] });
  if (options.method === "audio") {
    const pool = byDifficulty(
      filterQuestions({ vendor: options.vendor, chapter: options.chapter }).filter(
        (item) => Boolean(item.audioSrc) && isChoiceType(item.type),
      ),
      options.difficulty,
    );
    const ordered = options.random ? shuffle(pool) : pool;
    if (options.count === "all") return ordered;
    return ordered.slice(0, Math.min(options.count, ordered.length));
  }
  if (options.method === "reading") {
    const pool = byDifficulty(
      filterQuestions({ vendor: options.vendor, chapter: options.chapter }).filter((item) => Boolean(item.passageId)),
      options.difficulty,
    );
    let units = groupPickUnits(pool).filter((unit) => unit.length >= 2);
    units = options.random ? shuffle(units) : units;
    if (options.count === "all") return units.flat();
    return units.slice(0, Math.min(options.count, units.length)).flat();
  }
  if (options.method === "listen") {
    return pickQuestions({
      ...base,
      types: ["single", "multiple", "boolean"],
      excludePassage: true,
      excludeAudio: true,
    });
  }
  if (options.method === "flash" || options.method === "speed") {
    return pickQuestions({
      ...base,
      types: ["single", "multiple", "boolean", "cloze", "short"],
      excludePassage: true,
    });
  }
  return pickQuestions({ ...base, excludePassage: true });
}
