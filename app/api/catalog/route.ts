import { NextResponse } from "next/server";
import { toPublicQuestion } from "@/lib/questionPublic";
import { catalogMeta, filterQuestions } from "@/lib/questions.server";
import { tryParseVendor } from "@/lib/vendor";

export async function GET(request: Request) {
  const vendor = tryParseVendor(new URL(request.url).searchParams.get("vendor"));
  if (!vendor) {
    const questions = filterQuestions({}).map(toPublicQuestion);
    return NextResponse.json({ vendors: catalogMeta(), questions });
  }
  const questions = filterQuestions({ vendor }).map(toPublicQuestion);
  return NextResponse.json({
    vendor,
    chapters: [...new Set(questions.map((item) => item.chapter))],
    questions,
  });
}
