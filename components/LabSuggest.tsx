import Link from "next/link";
import {
  labEngineForVendor,
  labHref,
  pickLabForQuestion,
  suggestLabsForQuestions,
  type LabHit,
} from "@/lib/labMatch";
import type { Question } from "@/lib/types";
import { vendorAccent, type Vendor } from "@/lib/vendor";

export function LabSuggestLink({
  question,
  vendor,
  className,
}: {
  question: Question;
  vendor: Vendor;
  className?: string;
}) {
  const engine = labEngineForVendor(vendor);
  if (!engine) return null;
  const hit = pickLabForQuestion(question, engine);
  if (!hit) return null;
  const accent = vendorAccent(vendor);
  return (
    <Link href={labHref(hit.id, vendor)} className={className ?? `text-sm font-extrabold ${accent.text}`}>
      去做實驗：{hit.title}
    </Link>
  );
}

export function LabSuggestList({
  questions,
  vendor,
  heading = "這幾題對應實驗",
  completedIds,
  limit = 3,
}: {
  questions: Question[];
  vendor: Vendor;
  heading?: string;
  completedIds?: ReadonlySet<string>;
  limit?: number;
}) {
  const engine = labEngineForVendor(vendor);
  if (!engine) return null;
  const hits = suggestLabsForQuestions(questions, engine, limit, completedIds);
  if (hits.length === 0) return null;
  return (
    <section className="qb-card p-5">
      <h2 className="font-semibold">{heading}</h2>
      <p className="mt-1 text-xs text-slate-500">題錯了就去打指令，不要再開一輪選擇題。</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {hits.map((hit) => (
          <LabSuggestRow key={hit.id} hit={hit} vendor={vendor} />
        ))}
      </ul>
    </section>
  );
}

function LabSuggestRow({ hit, vendor }: { hit: LabHit; vendor: Vendor }) {
  const accent = vendorAccent(vendor);
  return (
    <li>
      <Link href={labHref(hit.id, vendor)} className="flex items-center justify-between gap-3 py-3 active:bg-slate-50">
        <span className="min-w-0">
          <span className="block text-sm font-semibold leading-snug">{hit.title}</span>
          {hit.hits > 1 ? <span className="text-xs text-slate-500">對應 {hit.hits} 題</span> : null}
        </span>
        <span className={`shrink-0 text-sm font-extrabold ${accent.text}`}>去做</span>
      </Link>
    </li>
  );
}
