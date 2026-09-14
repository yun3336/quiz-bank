import type { Attempt, Question } from "../lib/types";

export function makeQuestion(overrides: Partial<Question> & Pick<Question, "type">): Question {
  return {
    id: "q1",
    chapter: "測試",
    tags: [],
    difficulty: 1,
    stem: "題幹",
    explanation: "解析",
    ...overrides,
  };
}

export function attempt(
  questionId: string,
  correct: boolean,
  at: number,
  extra?: Partial<Attempt>,
): Attempt {
  return { questionId, selected: [], correct, at, mode: "practice", ...extra };
}
