import type { Question } from "./types";
import { isChoiceType } from "./types";

export type GradeMode = "loose" | "strict";

export function normalizeAnswer(value: string, mode: GradeMode = "loose"): string {
  let text = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”「」『』"'`]/g, "");
  if (mode === "loose") {
    text = text.replace(/[。．.!?！？,，、;；:：]/g, "");
  } else {
    text = text.replace(/[。．.!?！？]+$/g, "");
  }
  return text.replace(/\s+/g, " ").trim();
}

export function gradeChoice(answer: string[], selected: string[]): boolean {
  if (answer.length !== selected.length) return false;
  const expected = new Set(answer);
  return selected.every((id) => expected.has(id));
}

export function gradeAnswer(answer: string[], selected: string[]): boolean {
  return gradeChoice(answer, selected);
}

function matchesAlias(input: string, aliases: string[], mode: GradeMode): boolean {
  const normalized = normalizeAnswer(input, mode);
  if (!normalized) return false;
  return aliases.map((item) => normalizeAnswer(item, mode)).includes(normalized);
}

export function gradeSpeak(transcript: string, aliases: string[]): boolean {
  if (matchesAlias(transcript, aliases, "loose")) return true;
  const input = normalizeAnswer(transcript, "loose");
  if (!input) return false;
  return aliases.some((alias) => {
    const expected = normalizeAnswer(alias, "loose");
    if (!expected) return false;
    if (input.includes(expected) || expected.includes(input)) {
      return Math.min(input.length, expected.length) >= expected.length * 0.6;
    }
    const inputWords = new Set(input.split(" ").filter(Boolean));
    const expectedWords = expected.split(" ").filter(Boolean);
    if (expectedWords.length === 0) return false;
    const hit = expectedWords.filter((word) => inputWords.has(word)).length;
    return hit / expectedWords.length >= 0.75;
  });
}

export function gradeQuestion(
  question: Question,
  selected: string[],
  options?: { strict?: boolean },
): boolean {
  const mode: GradeMode = options?.strict ? "strict" : "loose";
  switch (question.type) {
    case "single":
    case "multiple":
    case "boolean":
      return gradeChoice(question.answer ?? [], selected);
    case "cloze": {
      const blanks = question.blanks ?? [];
      if (blanks.length === 0 || selected.length !== blanks.length) return false;
      return blanks.every((aliases, index) =>
        aliases.map((item) => normalizeAnswer(item, mode)).includes(normalizeAnswer(selected[index] ?? "", mode)),
      );
    }
    case "short": {
      return matchesAlias(selected[0] ?? "", question.aliases ?? [], mode);
    }
    case "translate":
    case "dictation":
    case "speak": {
      const aliases = question.aliases ?? [];
      if (aliases.length === 0) return false;
      if (question.type === "speak") return gradeSpeak(selected[0] ?? "", aliases);
      return matchesAlias(selected[0] ?? "", aliases, mode);
    }
    case "hotspot":
      return gradeChoice(question.answer ?? [], selected);
    case "order": {
      const ids = (question.tokens ?? []).map((token) => token.id);
      if (ids.length === 0 || selected.length !== ids.length) return false;
      return ids.every((id, index) => selected[index] === id);
    }
    case "match": {
      const pairs = question.pairs ?? [];
      if (pairs.length === 0 || selected.length !== pairs.length) return false;
      return pairs.every(
        (pair, index) => normalizeAnswer(selected[index] ?? "") === normalizeAnswer(pair.right),
      );
    }
    default:
      return false;
  }
}

export function isAnswered(question: Question, selected: string[]): boolean {
  switch (question.type) {
    case "cloze":
      return (question.blanks ?? []).every((_, index) => (selected[index] ?? "").trim().length > 0);
    case "short":
    case "translate":
    case "dictation":
    case "speak":
      return (selected[0] ?? "").trim().length > 0;
    case "hotspot":
      return selected.length > 0;
    case "order":
      return selected.length === (question.tokens ?? []).length && selected.length > 0;
    case "match":
      return (question.pairs ?? []).every((_, index) => (selected[index] ?? "").trim().length > 0);
    default:
      return selected.length > 0;
  }
}

export function questionTypeLabel(type: Question["type"]): string {
  switch (type) {
    case "multiple":
      return "多選";
    case "boolean":
      return "是非";
    case "cloze":
      return "填空";
    case "short":
      return "簡答";
    case "order":
      return "排序";
    case "match":
      return "配對";
    case "translate":
      return "翻譯";
    case "dictation":
      return "聽寫";
    case "hotspot":
      return "看圖";
    case "speak":
      return "口說";
    default:
      return "單選";
  }
}

export function directionLabel(direction?: Question["direction"]): string {
  if (direction === "zh-en") return "中 → 英";
  if (direction === "en-ja") return "英 → 日";
  return "翻譯";
}

export function revealAnswer(question: Question): string {
  switch (question.type) {
    case "cloze":
      return (question.blanks ?? []).map((aliases) => aliases[0] ?? "").filter(Boolean).join("、");
    case "short":
    case "translate":
    case "dictation":
    case "speak":
      return question.aliases?.[0] ?? "";
    case "hotspot":
      return (question.hotspots ?? [])
        .filter((spot) => (question.answer ?? []).includes(spot.id))
        .map((spot) => spot.label ?? spot.id)
        .join("、");
    case "order":
      return (question.tokens ?? []).map((token) => token.text).join(" → ");
    case "match":
      return (question.pairs ?? []).map((pair) => `${pair.left}＝${pair.right}`).join("；");
    default:
      return (question.options ?? [])
        .filter((option) => (question.answer ?? []).includes(option.id))
        .map((option) => option.text)
        .join("、");
  }
}

export function isChoiceQuestion(question: Question): boolean {
  return isChoiceType(question.type) && Array.isArray(question.options);
}

export function spokenText(question: Question): string {
  if (question.type === "dictation" || question.type === "speak") return question.prompt ?? "";
  return question.prompt ?? question.stem;
}
