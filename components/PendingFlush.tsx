"use client";

import { useEffect, useState } from "react";
import { flushPendingGrades } from "@/lib/flushPending";
import { getPendingSummary, subscribePending } from "@/lib/pendingGradeStore";

/** 連線時沖洗待批改佇列，並顯示未評分數。 */
export function PendingFlush() {
  const [summary, setSummary] = useState({ grades: 0, exams: 0, total: 0 });
  const [flushNote, setFlushNote] = useState("");

  useEffect(() => {
    function sync() {
      setSummary(getPendingSummary());
    }
    sync();
    return subscribePending(sync);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      const report = await flushPendingGrades();
      if (cancelled) return;
      setSummary(getPendingSummary());
      if (report.graded + report.exams > 0) {
        setFlushNote(`已送交批改：練習 ${report.graded}、模考 ${report.exams}`);
      }
    }
    run().catch(() => undefined);
    window.addEventListener("online", () => {
      run().catch(() => undefined);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (summary.total === 0 && !flushNote) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-[calc(var(--qb-header-h,3.5rem)+0.35rem)] z-30 px-3">
      <div className="pointer-events-auto mx-auto flex max-w-5xl items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950 shadow-sm">
        <div className="min-w-0 flex-1">
          {summary.total > 0 ? (
            <p>
              待批改 {summary.grades} 題
              {summary.exams > 0 ? `、待送交模考 ${summary.exams} 場` : ""}
              （未計入對錯／統計；連線後自動送交）。
            </p>
          ) : null}
          {flushNote ? <p className="mt-0.5 text-amber-800">{flushNote}</p> : null}
        </div>
        {summary.total > 0 ? (
          <button
            type="button"
            className="shrink-0 rounded-lg bg-amber-900 px-2.5 py-1 text-xs font-medium text-white"
            onClick={() => {
              flushPendingGrades()
                .then((report) => {
                  setSummary(getPendingSummary());
                  setFlushNote(
                    report.failed > 0
                      ? `部分失敗（${report.failed}），其餘已送交。`
                      : `已送交批改：練習 ${report.graded}、模考 ${report.exams}`,
                  );
                })
                .catch(() => setFlushNote("送交失敗，請稍後再試。"));
            }}
          >
            立即送交
          </button>
        ) : null}
      </div>
    </div>
  );
}
