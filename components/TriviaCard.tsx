"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  loadTriviaSave,
  pickTrivia,
  recordTriviaAnswer,
  triviaPlayHref,
  triviaPool,
  TRIVIA,
  type Trivia,
  type TriviaSave,
} from "@/lib/trivia";
import { VENDORS, VENDOR_META, type Vendor } from "@/lib/vendor";

function vendorLabel(vendor: Trivia["vendor"]): string {
  if (vendor === "any") return "題庫";
  return VENDOR_META[vendor].short;
}

const emptySave = (): TriviaSave => ({
  seenIds: [],
  correct: 0,
  answered: 0,
  streak: 0,
  bestStreak: 0,
});

export function TriviaCard({
  vendor,
  compact = false,
  showPractice = false,
  initialItem,
  initialGuess = null,
  initialFilter,
}: {
  vendor?: Vendor;
  compact?: boolean;
  showPractice?: boolean;
  start?: "open" | "closed" | "session";
  initialItem?: Trivia;
  initialGuess?: boolean | null;
  initialFilter?: Vendor | "all";
}) {
  const locked = Boolean(vendor);
  const [filter, setFilter] = useState<Vendor | "all">(vendor ?? initialFilter ?? "all");
  const poolVendor = locked ? vendor : filter === "all" ? undefined : filter;
  const [item, setItem] = useState<Trivia>(initialItem ?? TRIVIA[0]);
  const [revealed, setRevealed] = useState(initialGuess !== null);
  const [picked, setPicked] = useState<boolean | null>(initialGuess);
  const [save, setSave] = useState<TriviaSave>(emptySave);

  const poolSize = triviaPool(poolVendor).length;
  const found = useMemo(
    () => save.seenIds.filter((id) => triviaPool(poolVendor).some((entry) => entry.id === id)).length,
    [save.seenIds, poolVendor],
  );

  const useFullNav = !locked && !compact;

  useEffect(() => {
    setSave(loadTriviaSave());
    if (initialGuess !== null && initialItem) {
      try {
        const key = `quiz-bank:trivia-hit:${initialItem.id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          setSave(recordTriviaAnswer(initialItem.id, initialGuess === initialItem.truth));
        }
      } catch {
        /* 無 storage 時只揭曉 */
      }
      return;
    }
    if (!initialItem) setItem(pickTrivia(locked ? vendor : undefined));
  }, [locked, vendor, initialGuess, initialItem]);

  function deal(nextVendor: Vendor | undefined, excludeId?: string) {
    setItem(pickTrivia(nextVendor, excludeId));
    setRevealed(false);
    setPicked(null);
  }

  function answer(choice: boolean) {
    if (revealed) return;
    setPicked(choice);
    setRevealed(true);
    setSave(recordTriviaAnswer(item.id, choice === item.truth));
  }

  const correct = picked !== null && picked === item.truth;
  const complete = found >= poolSize && poolSize > 0;

  return (
    <aside className="qb-card relative z-10">
      <div className="flex items-start justify-between gap-3 bg-[var(--qb-wash)] px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--qb-navy)]">冷知識對決</p>
          <p className="mt-0.5 text-sm font-extrabold text-slate-900">這句對嗎？</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold text-[var(--qb-navy)]">
            {found}/{poolSize} 已發現
          </p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            {save.streak > 1 ? `連對 ${save.streak}` : save.bestStreak > 0 ? `最佳連對 ${save.bestStreak}` : "先猜再揭曉"}
          </p>
        </div>
      </div>

      <div className="relative z-10 px-4 py-4">
        {revealed ? (
          <>
            <p className={`text-sm font-extrabold ${correct ? "text-emerald-700" : "text-rose-600"}`}>
              {correct ? streakCopy(save.streak) : `其實是「${item.truth ? "對" : "錯"}」`}
            </p>
            <h3 className={`mt-1 font-extrabold text-slate-900 ${compact ? "text-base" : "text-lg"}`}>{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.body}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[var(--qb-wash)] px-2.5 py-1 text-[11px] font-semibold text-[var(--qb-navy)]">
                {vendorLabel(item.vendor)}
              </span>
              {complete ? (
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800">
                  這類圖鑑集滿了
                </span>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {useFullNav ? (
                <a
                  href={triviaPlayHref({ vendor: filter, skip: item.id })}
                  data-full-nav
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--qb-navy)] px-4 text-sm font-extrabold text-white"
                >
                  再來一則
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => deal(poolVendor, item.id)}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--qb-navy)] px-4 text-sm font-extrabold text-white"
                >
                  再來一則
                </button>
              )}
              {showPractice && item.vendor !== "any" ? (
                <Link
                  href={`/practice?vendor=${item.vendor}`}
                  data-full-nav
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--qb-wash)] px-4 text-sm font-extrabold text-[var(--qb-ink)]"
                >
                  去練 {VENDOR_META[item.vendor].short}
                </Link>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {useFullNav ? (
                <>
                  <a
                    href={triviaPlayHref({ tid: item.id, guess: true, vendor: filter })}
                    data-full-nav
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--qb-navy)] text-sm font-extrabold text-white"
                  >
                    對
                  </a>
                  <a
                    href={triviaPlayHref({ tid: item.id, guess: false, vendor: filter })}
                    data-full-nav
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--qb-wash)] text-sm font-extrabold text-[var(--qb-ink)]"
                  >
                    錯
                  </a>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => answer(true)}
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--qb-navy)] text-sm font-extrabold text-white"
                  >
                    對
                  </button>
                  <button
                    type="button"
                    onClick={() => answer(false)}
                    className="inline-flex min-h-12 items-center justify-center rounded-full bg-[var(--qb-wash)] text-sm font-extrabold text-[var(--qb-ink)]"
                  >
                    錯
                  </button>
                </>
              )}
            </div>
            <p className="text-pretty text-lg font-extrabold leading-snug text-slate-900">{item.claim}</p>
          </>
        )}

        {!locked && !compact ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            <a
              href={triviaPlayHref({ vendor: "all" })}
              data-full-nav
              aria-pressed={filter === "all"}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                filter === "all" ? "bg-[var(--qb-navy)] text-white" : "bg-[var(--qb-wash)] text-slate-600"
              }`}
            >
              全部
            </a>
            {VENDORS.map((itemVendor) => (
              <a
                key={itemVendor}
                href={triviaPlayHref({ vendor: itemVendor })}
                data-full-nav
                aria-pressed={filter === itemVendor}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  filter === itemVendor ? "bg-[var(--qb-navy)] text-white" : "bg-[var(--qb-wash)] text-slate-600"
                }`}
              >
                {VENDOR_META[itemVendor].short}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function streakCopy(streak: number): string {
  if (streak >= 5) return `太猛了，連對 ${streak}！`;
  if (streak >= 3) return `手感來了，連對 ${streak}`;
  if (streak >= 2) return "答對，再來！";
  return "答對了！";
}
