"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LabSuggestLink, LabSuggestList } from "@/components/LabSuggest";
import { QuestionPlayer } from "@/components/QuestionPlayer";
import { EmptyState, LoadingNote, ScoreRing } from "@/components/ui";
import { TriviaCard } from "@/components/TriviaCard";
import { applyReveal } from "@/lib/questionPublic";
import { gradeExamRemote, loadQuiz } from "@/lib/questionClient";
import { loadExamResult } from "@/lib/storage";
import type { ExamResultSnapshot } from "@/lib/types";
import { chapterVendor, vendorAccent } from "@/lib/vendor";

function formatDuration(sec: number): string {
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${seconds} 秒`;
}

async function hydrateSnapshot(snapshot: ExamResultSnapshot): Promise<ExamResultSnapshot> {
  if (snapshot.items.every((item) => item.question)) return snapshot;
  const vendor = chapterVendor(snapshot.record.chapter ?? "");
  const questions = await loadQuiz({
    kind: "ids",
    vendor,
    ids: snapshot.items.map((item) => item.questionId),
  });
  const byId = new Map(questions.map((question) => [question.id, question]));
  const graded = await gradeExamRemote(
    snapshot.items.map((item) => ({ questionId: item.questionId, selected: item.selected })),
  );
  return {
    ...snapshot,
    items: snapshot.items.map((item, index) => {
      const base = item.question ?? byId.get(item.questionId);
      const reveal = graded[index]?.reveal;
      return {
        ...item,
        question: base && reveal ? applyReveal(base, reveal) : base,
      };
    }),
  };
}

export default function ExamResultPage() {
  const [snapshot, setSnapshot] = useState<ExamResultSnapshot | null | undefined>(undefined);

  useEffect(() => {
    const stored = loadExamResult();
    if (!stored) {
      setSnapshot(null);
      return;
    }
    hydrateSnapshot(stored)
      .then(setSnapshot)
      .catch(() => setSnapshot(stored));
  }, []);

  if (snapshot === undefined) {
    return <LoadingNote text="讀取成績中…" />;
  }

  if (!snapshot) {
    return (
      <EmptyState title="還沒有本次考試紀錄" desc="請先完成一場模考。若重新整理後仍看不到，可能是分頁資料已被清除。">
        <Link href="/exam" className="inline-block rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white">
          去模考
        </Link>
      </EmptyState>
    );
  }

  const { record, items } = snapshot;
  const vendor = chapterVendor(record.chapter ?? "");
  const accent = vendorAccent(vendor);
  const wrongQuestions = items
    .filter((item) => !item.correct)
    .map((item) => item.question)
    .filter((question): question is NonNullable<typeof question> => Boolean(question));

  return (
    <div className="space-y-5 qb-in">
      <section className="qb-card px-6 py-8 text-center">
        <p className={`text-sm font-medium ${accent.text}`}>考試結果</p>
        <div className={`mt-5 ${accent.text}`}>
          <ScoreRing value={record.score} total={record.total} />
        </div>
        <p className="qb-mono mt-4 text-2xl font-medium tracking-tight text-slate-900">
          {record.score} / {record.total}
        </p>
        <p className="mt-2 text-sm text-slate-600">
          用時 {formatDuration(record.durationSec)}
          {record.chapter ? ` · ${record.chapter}` : " · 全部章節"}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href={`/exam?vendor=${vendor}`} className={`rounded-xl px-5 py-3 font-medium text-white ${accent.btn}`}>
            再考一次
          </Link>
          <Link href={`/review?vendor=${vendor}`} className="rounded-xl border border-slate-200 px-5 py-3">
            複習錯題
          </Link>
          <Link href={`/stats?vendor=${vendor}`} className="rounded-xl border border-slate-200 px-5 py-3">
            看統計
          </Link>
        </div>
      </section>
      <LabSuggestList questions={wrongQuestions} vendor={vendor} heading="這場錯題對應實驗" />
      <TriviaCard vendor={vendor} compact start="open" />
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">逐題回顧</h2>
        {items.map((item, index) => {
          const question = item.question;
          if (!question) return null;
          return (
            <div key={item.questionId} className="space-y-2">
              <p className={`text-sm font-medium ${item.correct ? "text-emerald-700" : "text-red-600"}`}>
                第 {index + 1} 題 · {item.correct ? "正確" : "錯誤"}
              </p>
              <QuestionPlayer
                question={question}
                selected={item.selected}
                onChange={() => undefined}
                disabled
                showResult
              />
              {!item.correct ? <LabSuggestLink question={question} vendor={vendor} /> : null}
            </div>
          );
        })}
      </section>
    </div>
  );
}
