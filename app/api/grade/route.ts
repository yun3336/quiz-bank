import { NextResponse } from "next/server";
import { gradeQuestion } from "@/lib/grade";
import { buildGradeReveal, type GradeReveal } from "@/lib/questionPublic";
import { canAccessQuestion } from "@/lib/access";
import { resolveFullQuestion } from "@/lib/quizPick.server";

type GradeItem = {
  questionId: string;
  selected: string[];
  mode?: "loose" | "strict";
  peek?: boolean;
};

type GradeBody = GradeItem & {
  items?: GradeItem[];
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
  let body: GradeBody;
  try {
    body = (await request.json()) as GradeBody;
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }

  if (Array.isArray(body.items)) {
    const results = body.items.map(gradeOne);
    if (results.some((item) => "error" in item)) {
      return NextResponse.json({ error: "missing" }, { status: 404 });
    }
    return NextResponse.json({ results });
  }

  if (!body.questionId) {
    return NextResponse.json({ error: "need-id" }, { status: 400 });
  }
  const result = gradeOne(body);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.error === "locked" ? 403 : 404 });
  }
  return NextResponse.json(result);
}

export type { GradeReveal };
