import { shuffle } from "./questions";
import { revealAnswer } from "./grade";
import { pickLabForQuestion, labEngineForVendor, type LabHit } from "./labMatch";
import type { Hotspot, MatchPair, OrderToken, Question } from "./types";
import { chapterVendor } from "./vendor";

export type GradeReveal = {
  explanation: string;
  answer?: string[];
  blanks?: string[][];
  aliases?: string[];
  prompt?: string;
  tokens?: OrderToken[];
  pairs?: MatchPair[];
  hotspots?: Hotspot[];
  revealText: string;
  lab: LabHit | null;
};

export function toPublicQuestion(question: Question): Question {
  const published: Question = {
    ...question,
    explanation: "",
    answer: undefined,
    aliases: undefined,
  };

  if (question.type === "cloze") {
    published.blanks = (question.blanks ?? []).map(() => []);
  } else {
    published.blanks = undefined;
  }

  if (question.type === "dictation") {
    published.prompt = undefined;
  }

  if (question.type === "order" && question.tokens) {
    published.tokens = shuffle(question.tokens);
  }

  if (question.type === "match" && question.pairs) {
    const rights = shuffle(question.pairs.map((pair) => pair.right));
    published.pairs = question.pairs.map((pair, index) => ({
      left: pair.left,
      right: rights[index] ?? "",
    }));
  }

  if (question.hotspots) {
    published.hotspots = question.hotspots.map((spot) => ({
      id: spot.id,
      x: spot.x,
      y: spot.y,
      w: spot.w,
      h: spot.h,
    }));
  }

  return published;
}

export function buildGradeReveal(question: Question): GradeReveal {
  const engine = labEngineForVendor(chapterVendor(question.chapter));
  return {
    explanation: question.explanation,
    answer: question.answer,
    blanks: question.blanks,
    aliases: question.aliases,
    prompt: question.prompt,
    tokens: question.tokens,
    pairs: question.pairs,
    hotspots: question.hotspots,
    revealText: revealAnswer(question),
    lab: engine ? pickLabForQuestion(question, engine) : null,
  };
}

export function applyReveal(question: Question, reveal: GradeReveal): Question {
  return {
    ...question,
    explanation: reveal.explanation,
    answer: reveal.answer,
    blanks: reveal.blanks ?? question.blanks,
    aliases: reveal.aliases,
    prompt: reveal.prompt ?? question.prompt,
    tokens: reveal.tokens ?? question.tokens,
    pairs: reveal.pairs ?? question.pairs,
    hotspots: reveal.hotspots ?? question.hotspots,
  };
}

export function publicQuestionHasSecrets(question: Question): boolean {
  if (question.explanation.trim()) return true;
  if (question.answer && question.answer.length > 0) return true;
  if (question.aliases && question.aliases.length > 0) return true;
  if (question.type === "cloze" && (question.blanks ?? []).some((blank) => blank.length > 0)) return true;
  if (question.type === "dictation" && question.prompt) return true;
  return false;
}
