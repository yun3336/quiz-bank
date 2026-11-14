import "server-only";
import questionsData from "@/data/questions.json";
import huaweiQuestions from "@/data/huawei-questions.json";
import languageQuestions from "@/data/language-questions.json";
import mathQuestions from "@/data/math-questions.json";
import scienceQuestions from "@/data/science-questions.json";
import careerQuestions from "@/data/career-questions.json";
import languagePhase2 from "@/data/language-phase2.json";
import phase3Questions from "@/data/phase3-questions.json";
import phase4Questions from "@/data/phase4-questions.json";
import phase5Questions from "@/data/phase5-questions.json";
import { canAccessQuestion } from "./access";
import type { DifficultyFilter } from "./questions";
import { pickQuestionsFromPool } from "./quizPick.shared";
import type { Question, QuestionType } from "./types";
import { chapterVendor, questionVendor, type Vendor } from "./vendor";

export const questions: Question[] = [
  ...questionsData,
  ...huaweiQuestions,
  ...languageQuestions,
  ...languagePhase2,
  ...phase3Questions,
  ...phase4Questions,
  ...phase5Questions,
  ...mathQuestions,
  ...scienceQuestions,
  ...careerQuestions,
] as Question[];

export function getQuestionMap(): Map<string, Question> {
  return new Map(questions.map((question) => [question.id, question]));
}

export function filterQuestions(options: { vendor?: Vendor; chapter?: string }): Question[] {
  let pool = questions.filter((question) => canAccessQuestion(question.chapter));
  if (options.vendor) {
    pool = pool.filter((question) => questionVendor(question) === options.vendor);
  }
  if (options.chapter && options.chapter !== "全部章節") {
    pool = pool.filter((question) => question.chapter === options.chapter);
  }
  return pool;
}

export function pickQuestions(options: {
  vendor?: Vendor;
  chapter?: string;
  count: number | "all";
  random: boolean;
  types?: QuestionType[];
  preferTypes?: QuestionType[];
  excludePassage?: boolean;
  excludeAudio?: boolean;
  difficulty?: DifficultyFilter;
}): Question[] {
  return pickQuestionsFromPool(filterQuestions({}), options);
}

export function questionsByVendor(vendor: Vendor): Question[] {
  return filterQuestions({ vendor });
}

export function getChaptersByVendor(vendor: Vendor): string[] {
  return [...new Set(filterQuestions({ vendor }).map((question) => question.chapter))];
}

export function catalogMeta() {
  const vendors: Vendor[] = ["cisco", "huawei", "language", "math", "science", "career"];
  return vendors.map((vendor) => ({
    vendor,
    count: filterQuestions({ vendor }).length,
    chapters: getChaptersByVendor(vendor),
  }));
}

export { chapterVendor };
