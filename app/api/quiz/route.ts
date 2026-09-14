import { NextResponse } from "next/server";
import { toPublicQuestion } from "@/lib/questionPublic";
import { ALL_CHAPTER, type DifficultyFilter } from "@/lib/questions";
import { expandPassage, pickLanguageQuiz, resolveFullQuestion } from "@/lib/quizPick.server";
import { pickQuestions, questionsByVendor } from "@/lib/questions.server";
import { defaultDrillMode, type LanguagePracticeMode } from "@/lib/languagePractice";
import { pickTodayQuiz } from "@/lib/todayPlan";
import type { ProgressStore, Question } from "@/lib/types";
import { tryParseVendor } from "@/lib/vendor";

type QuizBody = {
  kind?: "practice" | "exam" | "today" | "ids";
  vendor?: string;
  chapter?: string;
  count?: number | "all";
  random?: boolean;
  method?: LanguagePracticeMode;
  difficulty?: DifficultyFilter;
  qid?: string;
  ids?: string[];
  store?: ProgressStore;
};

function asPublic(items: Question[]): Question[] {
  return items.map(toPublicQuestion);
}

export async function POST(request: Request) {
  let body: QuizBody;
  try {
    body = (await request.json()) as QuizBody;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  const vendor = tryParseVendor(body.vendor);
  if (!vendor && body.kind !== "ids") {
    return NextResponse.json({ error: "need-vendor" }, { status: 400 });
  }

  const chapter = body.chapter?.trim() || ALL_CHAPTER;
  const count = body.count ?? 10;
  const random = body.random !== false;
  const difficulty = body.difficulty ?? "all";

  if (body.kind === "ids" || (body.ids && body.ids.length > 0)) {
    const picked = (body.ids ?? []).flatMap((id) => {
      const question = resolveFullQuestion(id);
      return question ? expandPassage(question) : [];
    });
    return NextResponse.json({ questions: asPublic(picked) });
  }

  if (!vendor) {
    return NextResponse.json({ error: "need-vendor" }, { status: 400 });
  }

  if (body.qid) {
    const question = resolveFullQuestion(body.qid);
    if (!question) return NextResponse.json({ questions: [] });
    return NextResponse.json({ questions: asPublic(expandPassage(question)) });
  }

  if (body.kind === "today") {
    const store: ProgressStore = body.store ?? {
      attempts: [],
      examHistory: [],
      labCompletions: [],
      starredIds: [],
      notes: {},
    };
    const size = typeof count === "number" ? count : 10;
    const picked = pickTodayQuiz({
      store,
      pool: questionsByVendor(vendor),
      count: size,
      random,
    });
    return NextResponse.json({ questions: asPublic(picked.questions) });
  }

  if (body.kind === "exam") {
    const examCount = typeof count === "number" ? count : 20;
    const picked = pickQuestions({ vendor, chapter, count: examCount, random: true, difficulty });
    return NextResponse.json({ questions: asPublic(picked) });
  }

  const method = body.method ?? defaultDrillMode(vendor);
  const picked = pickLanguageQuiz({
    vendor,
    chapter,
    count,
    random,
    method,
    difficulty,
  });
  return NextResponse.json({ questions: asPublic(picked) });
}
