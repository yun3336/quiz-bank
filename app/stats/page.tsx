"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LabSuggestList } from "@/components/LabSuggest";
import { NeedVendor, VendorBar } from "@/components/VendorBar";
import { EmptyState, PageHeader } from "@/components/ui";
import { practiceChapterHref } from "@/lib/quizStart";
import { buildHeatmap, heatLabel, heatLevel } from "@/lib/heatmap";
import { REMIND_HOURS, type RemindHour, type RemindPref } from "@/lib/remind";
import { getChapterStats, getOverview, getStudyStreak, percent } from "@/lib/stats";
import { allLabs } from "@/lib/lab/labs";
import {
  exportProgressJson,
  importProgressJson,
  loadProgress,
  loadRemindPref,
  saveRemindPref,
  subscribeProgress,
} from "@/lib/storage";
import { cachedCatalog, loadCatalog } from "@/lib/questionClient";
import { isOpenWrong, openWrongCount } from "@/lib/review";
import type { ProgressStore, Question } from "@/lib/types";
import { useActiveVendor } from "@/lib/useResolvedVendor";
import { chapterVendor, questionsByVendor, VENDOR_META, vendorAccent } from "@/lib/vendor";

export default function StatsPage() {
  return <StatsInner />;
}

function StatsInner() {
  const { vendor } = useActiveVendor();
  const [store, setStore] = useState<ProgressStore>(loadProgress);
  const [pool, setPool] = useState<Question[]>(() => cachedCatalog());

  useEffect(() => {
    const sync = () => setStore(loadProgress());
    sync();
    return subscribeProgress(sync);
  }, []);

  useEffect(() => {
    if (!vendor) return;
    let cancelled = false;
    loadCatalog(vendor)
      .then((items) => {
        if (!cancelled) setPool(items);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [vendor]);

  if (!vendor) {
    return <NeedVendor />;
  }

  const accent = vendorAccent(vendor);
  const meta = VENDOR_META[vendor];
  const overview = getOverview(store, vendor, pool);
  const streak = getStudyStreak(store, vendor, pool);
  const chapters = getChapterStats(store, vendor, pool);
  const exams = [...store.examHistory]
    .filter((exam) => chapterVendor(exam.chapter ?? "") === vendor)
    .sort((a, b) => b.startedAt - a.startedAt)
    .slice(0, 7);
  const vendorLabs = meta.hasLabs
    ? allLabs.filter((lab) => (vendor === "huawei" ? lab.engine === "vrp" : lab.engine === "ios"))
    : [];
  const labDone = new Set(store.labCompletions.map((item) => item.labId));
  const wrongCount = openWrongCount(store, vendor, pool);
  const emptyQuiz = overview.totalAttempts === 0;
  const emptyLabs = !meta.hasLabs || vendorLabs.every((lab) => !labDone.has(lab.id));
  const empty = emptyQuiz && emptyLabs;
  const allowedIds = new Set(questionsByVendor(vendor, pool).map((item) => item.id));
  const heat = buildHeatmap(store.attempts.filter((item) => allowedIds.has(item.questionId)));

  return (
    <div className="space-y-6 qb-in">
      <PageHeader title="統計" desc="目前題庫的紀錄只存在這個瀏覽器，可在下方備份。" />
      <VendorBar vendor={vendor} />
      <HeatmapCard cells={heat} />

      {empty ? (
        <EmptyState
          title="還沒有作答紀錄"
          desc={`先做一輪 ${meta.label} 練習或模考${meta.hasLabs ? "，或完成實驗" : ""}。`}
        >
          <div className="flex flex-wrap justify-center gap-2">
            <Link href={`/practice?vendor=${vendor}`} className={`rounded-xl px-4 py-3 text-white ${accent.btn}`}>
              去練習
            </Link>
            {meta.hasLabs ? (
              <Link href={`/lab?vendor=${vendor}`} className="rounded-xl border border-slate-200 px-4 py-3">
                去實驗
              </Link>
            ) : (
              <Link href={`/exam?vendor=${vendor}`} className="rounded-xl border border-slate-200 px-4 py-3">
                去模考
              </Link>
            )}
          </div>
        </EmptyState>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="作答次數" value={String(overview.totalAttempts)} />
            <StatCard label="答對題數" value={String(overview.correct)} />
            <StatCard label="總正確率" value={percent(overview.accuracy)} />
            <StatCard label="模考場次" value={String(overview.examCount)} />
            <Link href={`/review?vendor=${vendor}`} className="qb-card p-4 transition">
              <p className="text-xs font-medium text-slate-500">未訂正錯題</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">{wrongCount}</p>
            </Link>
            <StatCard
              label="連續學習"
              value={`${streak.current} 天`}
              hint={
                streak.studiedToday
                  ? streak.best > streak.current
                    ? `今天已打卡 · 最長 ${streak.best} 天`
                    : "今天已打卡"
                  : streak.best > 0
                    ? `最長 ${streak.best} 天`
                    : undefined
              }
            />
            {meta.hasLabs ? (
              <StatCard
                label="實驗完成"
                value={`${vendorLabs.filter((lab) => labDone.has(lab.id)).length}/${vendorLabs.length}`}
              />
            ) : null}
          </section>

          <section className="qb-card p-5">
            <h2 className="font-semibold">{meta.label} 章節正確率（弱項在前）</h2>
            <ul className="mt-4 space-y-3">
              {chapters.map((item) => (
                <li key={item.chapter}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">{item.chapter}</span>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-slate-500">
                        {item.attempts === 0
                          ? "尚未作答"
                          : `${percent(item.accuracy)} · ${item.correct}/${item.attempts}`}
                      </span>
                      <Link
                        href={practiceChapterHref(vendor, item.chapter)}
                        className={`font-extrabold ${accent.text}`}
                      >
                        {item.attempts === 0 ? "開始練" : "練這個"}
                      </Link>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div className={`h-full rounded-full ${accent.bar}`} style={{ width: `${Math.round(item.accuracy * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="qb-card p-5">
            <h2 className="font-semibold">近 7 次模考</h2>
            {exams.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">還沒有模考紀錄。</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {exams.map((exam) => (
                  <li key={exam.id} className="flex items-center justify-between py-3 text-sm">
                    <div>
                      <p className="font-medium">
                        {exam.score} / {exam.total}
                      </p>
                      <p className="text-slate-500">
                        {exam.chapter ?? "全部章節"} · {new Date(exam.startedAt).toLocaleString("zh-Hant")}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${accent.pill}`}>
                      {Math.round((exam.score / exam.total) * 100)} 分
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {meta.hasLabs ? (
            <LabSuggestList
              questions={questionsByVendor(vendor, pool).filter((question) => isOpenWrong(store.attempts, question.id))}
              vendor={vendor}
              heading="錯題對應實驗"
              completedIds={labDone}
            />
          ) : null}
          {meta.hasLabs ? (
            <section className="qb-card p-5">
              <h2 className="font-semibold">{meta.label} 實驗</h2>
              <ul className="mt-3 divide-y divide-slate-100">
                {vendorLabs.map((lab) => (
                  <li key={lab.id} className="flex items-center justify-between py-3 text-sm">
                    <span>{lab.title}</span>
                    <span className={labDone.has(lab.id) ? "font-medium text-emerald-700" : "text-slate-400"}>
                      {labDone.has(lab.id) ? "已完成" : "未完成"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
      <RemindPanel />
      <BackupPanel />
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="qb-card p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  );
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];
const HEAT_MIX = [8, 22, 40, 62, 88];

function HeatmapCard({ cells }: { cells: ReturnType<typeof buildHeatmap> }) {
  const studied = cells.filter((item) => item.count > 0 && !item.future).length;
  return (
    <section className="qb-card p-5">
      <div className="flex items-end justify-between gap-3">
        <h2 className="font-semibold">近 12 週</h2>
        <p className="text-xs text-slate-400">{studied} 天有作答</p>
      </div>
      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
        <div className="grid grid-rows-7 gap-[3px] pr-1 text-[10px] leading-3 text-slate-400">
          {WEEKDAYS.map((label) => (
            <span key={label} className="grid h-3 place-items-center">
              {label}
            </span>
          ))}
        </div>
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {cells.map((cell) => {
            const level = heatLevel(cell.count);
            return (
              <span
                key={cell.key}
                title={`${heatLabel(cell.key)} · ${cell.count} 題`}
                className={`block h-3 w-3 rounded-[3px] ${cell.future ? "opacity-30" : ""}`}
                style={{
                  background:
                    level === 0
                      ? "color-mix(in srgb, var(--qb-navy) 8%, var(--qb-sheet))"
                      : `color-mix(in srgb, var(--qb-navy) ${HEAT_MIX[level]}%, var(--qb-wash))`,
                }}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

function RemindPanel() {
  const [pref, setPref] = useState<RemindPref>({ enabled: false, hour: 20 });
  const [message, setMessage] = useState("");
  const supported = typeof Notification !== "undefined";

  useEffect(() => {
    setPref(loadRemindPref());
  }, []);

  async function setEnabled(enabled: boolean) {
    if (!enabled) {
      const next = { ...pref, enabled: false };
      setPref(next);
      saveRemindPref(next);
      setMessage("已關閉提醒。");
      return;
    }
    if (!supported) {
      setMessage("這個瀏覽器不支援通知。");
      return;
    }
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setMessage("需要允許通知，到點才叫得動。");
      return;
    }
    const next = { ...pref, enabled: true };
    setPref(next);
    saveRemindPref(next);
    setMessage(`已開啟，每天 ${pref.hour}:00 若還沒刷就提醒。這個分頁開著才會響。`);
  }

  function setHour(hour: RemindHour) {
    const next = { ...pref, hour };
    setPref(next);
    saveRemindPref(next);
  }

  return (
    <section className="qb-card p-5">
      <h2 className="font-semibold">回來刷提醒</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        沒有伺服器推播。這個瀏覽器開著時，到點若今天還沒作答就通知你。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {REMIND_HOURS.map((hour) => (
          <button
            key={hour}
            type="button"
            onClick={() => setHour(hour)}
            className={`rounded-full px-3 py-1.5 text-sm ${
              pref.hour === hour ? "bg-[var(--qb-navy)] text-white" : "border border-slate-200 bg-white"
            }`}
          >
            {hour}:00
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void setEnabled(!pref.enabled)}
          className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white"
        >
          {pref.enabled ? "關閉提醒" : "開啟提醒"}
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}

function BackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const modeRef = useRef<"merge" | "replace">("merge");
  const [message, setMessage] = useState("");

  function download() {
    const blob = new Blob([exportProgressJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quiz-bank-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("已下載進度檔。");
  }

  function pick(mode: "merge" | "replace") {
    modeRef.current = mode;
    inputRef.current?.click();
  }

  function onFile(file: File) {
    const mode = modeRef.current;
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      const confirmed =
        mode === "replace"
          ? window.confirm("會覆蓋這個瀏覽器裡現有的作答、收藏、筆記與實驗紀錄。確定嗎？")
          : window.confirm("會與這個瀏覽器的紀錄合併，不會刪掉現有進度。確定嗎？");
      if (!confirmed) return;
      const result = importProgressJson(text, mode);
      setMessage(result.ok ? (mode === "replace" ? "已覆蓋為檔案內容。" : "已合併進度。") : result.error);
    };
    reader.readAsText(file, "utf-8");
  }

  return (
    <section className="qb-card p-5">
      <h2 className="font-semibold">備份進度</h2>
      <p className="mt-1 text-sm leading-relaxed text-slate-500">
        作答、收藏與筆記只存在這個瀏覽器。清快取前先匯出。換電腦請用「匯入並合併」；只有要完全改成備份檔時才用覆蓋。
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={download} className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white">
          匯出 JSON
        </button>
        <button type="button" onClick={() => pick("merge")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">
          匯入並合併
        </button>
        <button type="button" onClick={() => pick("replace")} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600">
          用檔案覆蓋
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFile(file);
          }}
        />
      </div>
      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}
