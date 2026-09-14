export type QuestionType =
  | "single"
  | "multiple"
  | "boolean"
  | "cloze"
  | "short"
  | "order"
  | "match"
  | "translate"
  | "dictation"
  | "hotspot"
  | "speak";

export type TranslateDirection = "zh-en" | "en-ja";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface OrderToken {
  id: string;
  text: string;
}

export interface MatchPair {
  left: string;
  right: string;
}

export interface Hotspot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
}

export interface Question {
  id: string;
  chapter: string;
  tags: string[];
  difficulty: 1 | 2 | 3;
  type: QuestionType;
  stem: string;
  explanation: string;
  options?: QuestionOption[];
  answer?: string[];
  blanks?: string[][];
  aliases?: string[];
  tokens?: OrderToken[];
  pairs?: MatchPair[];
  source?: string;
  direction?: TranslateDirection;
  prompt?: string;
  speakLang?: string;
  passageId?: string;
  passage?: string;
  image?: string;
  hotspots?: Hotspot[];
  audioSrc?: string;
}

export interface Attempt {
  questionId: string;
  selected: string[];
  correct: boolean;
  at: number;
  mode: "practice" | "exam";
}

export interface ExamRecord {
  id: string;
  startedAt: number;
  durationSec: number;
  score: number;
  total: number;
  chapter?: string;
}

export interface LabCompletion {
  labId: string;
  at: number;
}

export interface ProgressStore {
  attempts: Attempt[];
  examHistory: ExamRecord[];
  labCompletions: LabCompletion[];
  starredIds: string[];
  notes: Record<string, string>;
}

export interface ExamResultItem {
  questionId: string;
  selected: string[];
  correct: boolean;
  question?: Question;
}

export interface ExamResultSnapshot {
  record: ExamRecord;
  items: ExamResultItem[];
}

export function isChoiceType(type: QuestionType): boolean {
  return type === "single" || type === "multiple" || type === "boolean";
}
