/**
 * 抽題／組卷共用邏輯（無 server-only）。
 * 網站 API 與原生離線包都走這裡，避免兩套規則漂移。
 */
import { isChoiceType, type Question } from "./types";
import { revealAnswer } from "./grade";
import {
  byDifficulty,
  flattenPickUnits,
  groupPickUnits,
  shuffle,
  type DifficultyFilter,
} from "./questions";
import type { LanguagePracticeMode } from "./practiceModes";
import { questionVendor, type Vendor } from "./vendor";

export const MATCH_MAX = 8;
const MATCH_BUNDLE_PREFIX = "match-bundle:";

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

export function filterPool(
  pool: Question[],
  options: { vendor?: Vendor; chapter?: string },
): Question[] {
  let next = pool;
  if (options.vendor) {
    next = next.filter((item) => questionVendor(item) === options.vendor);
  }
  if (options.chapter && options.chapter !== "全部章節") {
    next = next.filter((item) => item.chapter === options.chapter);
  }
  return next;
}

export function pickQuestionsFromPool(
  pool: Question[],
  options: {
    vendor?: Vendor;
    chapter?: string;
    count: number | "all";
    random: boolean;
    types?: Question["type"][];
    preferTypes?: Question["type"][];
    excludePassage?: boolean;
    excludeAudio?: boolean;
    difficulty?: DifficultyFilter;
  },
): Question[] {
  let next = filterPool(pool, { vendor: options.vendor, chapter: options.chapter });
  next = byDifficulty(next, options.difficulty);
  if (options.excludePassage) next = next.filter((item) => !item.passageId);
  if (options.excludeAudio) next = next.filter((item) => !item.audioSrc);
  if (options.types && options.types.length > 0) {
    next = next.filter((item) => options.types?.includes(item.type));
  }
  let units = groupPickUnits(next);
  if (options.preferTypes && options.preferTypes.length > 0) {
    const preferred = units.filter((unit) => unit.some((item) => options.preferTypes?.includes(item.type)));
    const rest = units.filter((unit) => !unit.some((item) => options.preferTypes?.includes(item.type)));
    units = options.random ? [...shuffle(preferred), ...shuffle(rest)] : [...preferred, ...rest];
  } else {
    units = options.random ? shuffle(units) : units;
  }
  if (options.count === "all") return flattenPickUnits(units);
  return flattenPickUnits(units.slice(0, Math.min(options.count, units.length)));
}

export function expandPassageInPool(question: Question, pool: Question[]): Question[] {
  if (!question.passageId) return [question];
  return pool.filter((item) => item.passageId === question.passageId);
}

export function resolveQuestionInPool(id: string, pool: Question[]): Question | undefined {
  const map = new Map(pool.map((item) => [item.id, item]));
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

export function pickLanguageQuizFromPool(
  pool: Question[],
  options: {
    vendor: Vendor;
    chapter?: string;
    count: number | "all";
    random: boolean;
    method: LanguagePracticeMode;
    difficulty?: DifficultyFilter;
  },
): Question[] {
  const base = {
    vendor: options.vendor,
    chapter: options.chapter,
    count: options.count,
    random: options.random,
    difficulty: options.difficulty,
  };
  if (options.method === "mixed") return pickQuestionsFromPool(pool, { ...base });
  if (options.method === "choice") {
    return pickQuestionsFromPool(pool, {
      ...base,
      types: ["single", "multiple", "boolean"],
      excludePassage: true,
    });
  }
  if (options.method === "cloze") {
    const filtered = byDifficulty(
      filterPool(pool, { vendor: options.vendor, chapter: options.chapter }).filter((item) => !item.passageId),
      options.difficulty,
    );
    const native = filtered.filter((item) => item.type === "cloze" || item.type === "short");
    const converted = filtered
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
    const filtered = byDifficulty(
      filterPool(pool, { vendor: options.vendor, chapter: options.chapter }).filter((item) => !item.passageId),
      options.difficulty,
    );
    const native = options.random
      ? shuffle(filtered.filter((item) => item.type === "match"))
      : filtered.filter((item) => item.type === "match");
    const limit = options.count === "all" ? native.length : options.count;
    const picked = native.slice(0, limit);
    if (options.count === "all" || picked.length >= options.count) return picked;

    const mcq = (options.random ? shuffle(filtered) : filtered).filter((item) => item.type === "single");
    let offset = 0;
    while (picked.length < (options.count as number) && offset < mcq.length) {
      const chunk = mcq.slice(offset, offset + MATCH_MAX);
      offset += MATCH_MAX;
      if (chunk.length < 2) break;
      picked.push(bundleMatchQuestion(chunk));
    }
    return picked;
  }
  if (options.method === "translate") return pickQuestionsFromPool(pool, { ...base, types: ["translate"] });
  if (options.method === "dictation") return pickQuestionsFromPool(pool, { ...base, types: ["dictation"] });
  if (options.method === "hotspot") return pickQuestionsFromPool(pool, { ...base, types: ["hotspot"] });
  if (options.method === "speak") return pickQuestionsFromPool(pool, { ...base, types: ["speak"] });
  if (options.method === "audio") {
    const filtered = byDifficulty(
      filterPool(pool, { vendor: options.vendor, chapter: options.chapter }).filter(
        (item) => Boolean(item.audioSrc) && isChoiceType(item.type),
      ),
      options.difficulty,
    );
    const ordered = options.random ? shuffle(filtered) : filtered;
    if (options.count === "all") return ordered;
    return ordered.slice(0, Math.min(options.count, ordered.length));
  }
  if (options.method === "reading") {
    const filtered = byDifficulty(
      filterPool(pool, { vendor: options.vendor, chapter: options.chapter }).filter((item) => Boolean(item.passageId)),
      options.difficulty,
    );
    let units = groupPickUnits(filtered).filter((unit) => unit.length >= 2);
    units = options.random ? shuffle(units) : units;
    if (options.count === "all") return units.flat();
    return units.slice(0, Math.min(options.count, units.length)).flat();
  }
  if (options.method === "listen") {
    return pickQuestionsFromPool(pool, {
      ...base,
      types: ["single", "multiple", "boolean"],
      excludePassage: true,
      excludeAudio: true,
    });
  }
  if (options.method === "flash" || options.method === "speed") {
    return pickQuestionsFromPool(pool, {
      ...base,
      types: ["single", "multiple", "boolean", "cloze", "short"],
      excludePassage: true,
    });
  }
  return pickQuestionsFromPool(pool, { ...base, excludePassage: true });
}
