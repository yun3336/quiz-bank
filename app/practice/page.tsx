import type { Metadata } from "next";
import { cookies } from "next/headers";
import { PracticeClient } from "@/components/PracticeClient";
import { parsePracticeStart, readSearchParams } from "@/lib/quizStart";
import { VENDOR_COOKIE } from "@/lib/storage";
import { tryParseVendor } from "@/lib/vendor";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  alternates: { canonical: "/practice" },
};

export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const query = readSearchParams(raw);
  const jar = await cookies();
  const start = parsePracticeStart(query, tryParseVendor(jar.get(VENDOR_COOKIE)?.value));
  return <PracticeClient start={start} />;
}
