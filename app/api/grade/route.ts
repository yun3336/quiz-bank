import { NextResponse } from "next/server";
import { gradeQuestion } from "@/lib/grade";
import { buildGradeReveal, type GradeReveal } from "@/lib/questionPublic";
import { canAccessQuestion } from "@/lib/access";
import { resolveFullQuestion } from "@/lib/quizPick.server";
import { MAX_GRADE_BATCH, RATE_GRADE_PER_MIN, RATE_WINDOW_MS } from "@/lib/apiLimits";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

type GradeItem = {
  questionId: string;
  selected: string[];
  mode?: "loose" | "strict";
  peek?: boolean;
};

type GradeBody = GradeItem & {
  items?: GradeItem[];
  clientRequestId?: string;
};

function gradeOne(item: GradeItem): { questionId: string; correct: boolean; reveal: GradeReveal } | { error: string } {
  const question = resolveFullQuestion(item.questionId);
  if (!question) return { error: "missing" };
  if (!canAccessQuestion(question.chapter)) return { error: "locked" };
  const strict = item.mode === "strict" || question.type === "translate" || question.type === "dictation";
  const correct = item.peek ? false : gradeQuestion(question, item.selected ?? [], { strict });
  return {
    questionId: question.id,
    correct,
    reveal: buildGradeReveal(question),
  };
}

export async function POST(request: Request) {
  const limited = checkRateLimit(`grade:${clientKeyFromRequest(request)}`, RATE_GRADE_PER_MIN, RATE_WINDOW_MS);
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate-limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  let body: GradeBody;
  try {
    body = (await request.json()) as GradeBody;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  if (Array.isArray(body.items)) {
    if (body.items.length === 0) {
      return NextResponse.json({ error: "empty-batch" }, { status: 400 });
    }
    if (body.items.length > MAX_GRADE_BATCH) {
      return NextResponse.json(
        { error: "batch-too-large", max: MAX_GRADE_BATCH },
        { status: 400 },
      );
    }
    const results = body.items.map(gradeOne);
    if (results.some((item) => "error" in item)) {
      return NextResponse.json({ error: "missing" }, { status: 404 });
    }
    return NextResponse.json({ results, clientRequestId: body.clientRequestId ?? null });
  }

  if (!body.questionId) {
    return NextResponse.json({ error: "need-id" }, { status: 400 });
  }
  const result = gradeOne(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.error === "locked" ? 403 : 404 });
  }
  return NextResponse.json({ ...result, clientRequestId: body.clientRequestId ?? null });
}

export type { GradeReveal };
