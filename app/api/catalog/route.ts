import { NextResponse } from "next/server";
import { toPublicQuestion } from "@/lib/questionPublic";
import { catalogMeta, filterQuestions } from "@/lib/questions.server";
import { tryParseVendor } from "@/lib/vendor";
import { MAX_CATALOG_QUESTIONS, RATE_CATALOG_PER_MIN, RATE_WINDOW_MS } from "@/lib/apiLimits";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rateLimit";

export async function GET(request: Request) {
  const limited = checkRateLimit(
    `catalog:${clientKeyFromRequest(request)}`,
    RATE_CATALOG_PER_MIN,
    RATE_WINDOW_MS,
  );
  if (!limited.ok) {
    return NextResponse.json(
      { error: "rate-limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  const vendor = tryParseVendor(new URL(request.url).searchParams.get("vendor"));
  if (!vendor) {
    // 未指定 vendor 時只回 meta，避免一次傾倒全庫公開題幹
    return NextResponse.json({ vendors: catalogMeta(), questions: [] });
  }
  const questions = filterQuestions({ vendor })
    .slice(0, MAX_CATALOG_QUESTIONS)
    .map(toPublicQuestion);
  return NextResponse.json({
    vendor,
    chapters: [...new Set(questions.map((item) => item.chapter))],
    questions,
    truncated: filterQuestions({ vendor }).length > MAX_CATALOG_QUESTIONS,
  });
}
