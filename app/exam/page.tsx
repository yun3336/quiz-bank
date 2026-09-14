import { cookies } from "next/headers";
import { ExamClient } from "@/components/ExamClient";
import { parseExamStart, readSearchParams } from "@/lib/quizStart";
import { VENDOR_COOKIE } from "@/lib/storage";
import { tryParseVendor } from "@/lib/vendor";

export const dynamic = "force-dynamic";

export default async function ExamPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = readSearchParams(await searchParams);
  const jar = await cookies();
  const start = parseExamStart(query, tryParseVendor(jar.get(VENDOR_COOKIE)?.value));
  return <ExamClient start={start} />;
}
