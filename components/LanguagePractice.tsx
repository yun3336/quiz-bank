"use client";

import { useEffect, useMemo, useState } from "react";
import { QuestionPlayer } from "@/components/QuestionPlayer";
import { shuffle, DIFFICULTY_OPTIONS, type DifficultyFilter } from "@/lib/questions";
import {
  correctTexts,
  groupedDrillModes,
  speakLang,
  speakText,
  stopSpeaking,
  type LanguagePracticeMode,
} from "@/lib/languagePractice";
import { revealAnswer } from "@/lib/grade";
import type { Question } from "@/lib/types";
import { vendorAccent, type Vendor } from "@/lib/vendor";
import { StarControl } from "@/components/StarControl";
import { NoteControl } from "@/components/NoteControl";
import { SegRadios } from "@/components/SegRadios";

const listenAccent = vendorAccent("language");

export function LanguageModePicker({
  value,
  onChange,
  vendor,
}: {
  value: LanguagePracticeMode;
  onChange: (mode: LanguagePracticeMode) => void;
  vendor: Vendor;
}) {
  const groups = groupedDrillModes(vendor);
  const manyGroups = groups.length > 1;
  const speakSelected = groups
    .find((group) => group.id === "listenSpeak")
    ?.modes.some((mode) => mode.id === value);
  const [speakOpen, setSpeakOpen] = useState(true);

  useEffect(() => {
    if (speakSelected) setSpeakOpen(true);
  }, [speakSelected]);

  return (
    <fieldset>
      <legend className="text-sm font-medium text-slate-700">練習方法</legend>
      <div className={manyGroups ? "mt-2 space-y-3" : "mt-2"}>
        {groups.map((group) => {
          const collapsible = manyGroups && group.id === "listenSpeak";
          const modes = (
            <div
              className={`grid gap-2 ${
                group.modes.length >= 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"
              }`}
            >
              {group.modes.map((mode) => (
                <label
                  key={mode.id}
                  className="min-h-11 cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-3 text-left transition hover:bg-slate-50 has-[:checked]:border-[var(--qb-navy)] has-[:checked]:bg-[var(--qb-wash)]"
                >
                  <input
                    type="radio"
                    name="method"
                    value={mode.id}
                    className="sr-only"
                    defaultChecked={value === mode.id}
                    onChange={() => onChange(mode.id)}
                  />
                  <p className="text-sm font-semibold">{mode.label}</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-500">{mode.blurb}</p>
                </label>
              ))}
            </div>
          );

          if (!collapsible) {
            return (
              <div
                key={group.id}
                className={manyGroups ? "rounded-2xl border border-slate-100 bg-slate-50/70 p-3" : undefined}
              >
                {manyGroups ? (
                  <div className="mb-2 flex items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-slate-700">{group.label}</p>
                    <p className="text-xs text-slate-400">{group.hint}</p>
                  </div>
                ) : null}
                {modes}
              </div>
            );
          }

          return (
            <div key={group.id} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
              <button
                type="button"
                onClick={() => setSpeakOpen((value) => !value)}
                className="flex w-full items-baseline justify-between gap-2 text-left"
                aria-expanded={speakOpen}
              >
                <p className="text-sm font-medium text-slate-700">{group.label}</p>
                <p className="text-xs text-slate-400">
                  {speakOpen ? group.hint : `收合 · ${group.modes.length} 種`}
                </p>
              </button>
              {speakOpen ? <div className="mt-2">{modes}</div> : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}

export function DifficultyPicker({
  value,
  onChange,
}: {
  value: DifficultyFilter;
  onChange: (value: DifficultyFilter) => void;
  vendor: Vendor;
}) {
  return (
    <div>
      <p className="qb-section">難度</p>
      <SegRadios
        name="difficulty"
        value={String(value)}
        options={DIFFICULTY_OPTIONS.map((item) => ({ id: String(item.id), label: item.label }))}
        onChange={(id) => onChange((id === "1" || id === "2" || id === "3" ? Number(id) : "all") as DifficultyFilter)}
      />
    </div>
  );
}

export function ClozePanel({
  question,
  typed,
  onTyped,
  onSubmit,
  submitted,
  correct,
}: {
  question: Question;
  typed: string;
  onTyped: (value: string) => void;
  onSubmit: () => void;
  submitted: boolean;
  correct: boolean;
}) {
  return (
    <article className="qb-card p-5">
      <p className="text-xs text-slate-500">{question.chapter} · 填空默寫</p>
      <h2 className="mt-2 text-lg font-medium leading-relaxed">{question.stem}</h2>
      <p className="mt-2 text-sm text-slate-500">
        {question.type === "multiple" ? "多個答案請用逗號分開。" : "請打出完整答案，不要只寫選項代號。"}
      </p>
      <input
        value={typed}
        onChange={(event) => onTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !submitted && typed.trim()) {
            event.preventDefault();
            onSubmit();
          }
        }}
        disabled={submitted}
        autoComplete="off"
        placeholder="在這裡輸入答案…"
        spellCheck={false}
        className="qb-input mt-4"
      />
      {submitted && (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <p className={`font-medium ${correct ? "text-emerald-700" : "text-red-600"}`}>
            {correct ? "正確" : "再記一次"}
          </p>
          <p className="mt-1">參考答案：{correctTexts(question).join("、")}</p>
          <p className="mt-2">{question.explanation}</p>
        </div>
      )}
    </article>
  );
}

export function FlashPanel({
  question,
  revealed,
  onReveal,
}: {
  question: Question;
  revealed: boolean;
  onReveal: () => void;
}) {
  return (
    <article className="qb-card p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <p>{question.chapter} · 閃卡</p>
        <StarControl questionId={question.id} />
        <NoteControl questionId={question.id} />
      </div>
      <h2 className="mt-2 text-lg font-medium leading-relaxed">{question.stem}</h2>
      {!revealed ? (
        <button
          type="button"
          onClick={onReveal}
          className="mt-6 w-full rounded-2xl border border-dashed border-slate-300 bg-gradient-to-b from-slate-50 to-white px-4 py-12 text-slate-700 transition hover:border-slate-400 hover:bg-white"
        >
          先自己想，再點這裡看答案
        </button>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <p className="font-medium text-slate-900">答案：{revealAnswer(question)}</p>
          <p className="mt-2">{question.explanation}</p>
        </div>
      )}
    </article>
  );
}

export function ListenPanel({
  question,
  selected,
  onChange,
  submitted,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  submitted: boolean;
}) {
  const [showStem, setShowStem] = useState(false);
  const lang = speakLang(question.stem, question.chapter);

  useEffect(() => {
    setShowStem(false);
    speakText(question.stem, lang);
    return () => stopSpeaking();
  }, [question.id, question.stem, lang]);

  useEffect(() => {
    if (submitted) setShowStem(true);
  }, [submitted]);

  return (
    <div className="space-y-3">
      <div className="qb-card p-5">
        <p className="text-xs text-slate-500">{question.chapter} · 聽力</p>
        <p className="mt-2 text-sm text-slate-600">先聽題幹，再選答案。請開聲音；若沒有聲音，可顯示文字。</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => speakText(question.stem, lang)}
            className={`rounded-xl px-4 py-3 text-sm font-medium text-white ${listenAccent.btn}`}
          >
            再聽一次
          </button>
          <button
            type="button"
            onClick={() => setShowStem((value) => !value)}
            className="rounded-xl border border-slate-200 px-4 py-3 text-sm"
          >
            {showStem ? "隱藏文字" : "顯示文字"}
          </button>
        </div>
        {showStem && <p className="mt-4 text-base leading-relaxed text-slate-800">{question.stem}</p>}
      </div>
      <QuestionPlayer
        question={question}
        selected={selected}
        onChange={onChange}
        disabled={submitted}
        showResult={submitted}
        hideStem={!showStem}
      />
    </div>
  );
}

type MatchItem = { id: string; label: string };

export function MatchPanel({
  questions,
  onFinished,
}: {
  questions: Question[];
  onFinished: (correct: number, results: { question: Question; correct: boolean }[]) => void;
}) {
  const left = useMemo(
    () => questions.map((question) => ({ question, label: correctTexts(question).join("、") })),
    [questions],
  );
  const [right, setRight] = useState<MatchItem[]>([]);
  const [pickedLeft, setPickedLeft] = useState<string | null>(null);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [missed, setMissed] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);

  useEffect(() => {
    setRight(shuffle(left.map((item) => ({ id: item.question.id, label: item.label }))));
    setPickedLeft(null);
    setSolved(new Set());
    setMissed(new Set());
    setWrong(null);
  }, [left]);

  function finishIfDone(nextSolved: Set<string>, nextMissed: Set<string>) {
    if (nextSolved.size !== left.length) return;
    const results = left.map((item) => ({
      question: item.question,
      correct: !nextMissed.has(item.question.id),
    }));
    onFinished(results.filter((item) => item.correct).length, results);
  }

  function pickRight(item: MatchItem) {
    if (!pickedLeft || solved.has(item.id)) return;
    if (item.id === pickedLeft) {
      const nextSolved = new Set(solved).add(pickedLeft);
      setSolved(nextSolved);
      setPickedLeft(null);
      setWrong(null);
      finishIfDone(nextSolved, missed);
      return;
    }
    const nextMissed = new Set(missed).add(pickedLeft);
    setMissed(nextMissed);
    setWrong(pickedLeft);
    setPickedLeft(null);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">先點左邊題目，再點右邊對應答案。第一次配對會計分。</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="space-y-2">
          {left.map((item) => {
            const id = item.question.id;
            const done = solved.has(id);
            return (
              <li key={id}>
                <button
                  type="button"
                  disabled={done}
                  onClick={() => {
                    setPickedLeft(id);
                    setWrong(null);
                  }}
                  className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${
                    done
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : wrong === id
                        ? "border-red-500 bg-red-50"
                        : pickedLeft === id
                          ? listenAccent.selected
                          : "border-slate-200 bg-white"
                  }`}
                >
                  {item.question.stem}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="space-y-2">
          {right.map((item) => {
            const done = solved.has(item.id);
            return (
              <li key={item.id}>
                <button
                  type="button"
                  disabled={done || !pickedLeft}
                  onClick={() => pickRight(item)}
                  className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${
                    done ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white"
                  } disabled:opacity-60`}
                >
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function SpeedHud({ remaining }: { remaining: number }) {
  return (
    <span
      className={`qb-mono rounded-full px-3 py-1 text-sm font-medium tabular-nums ${
        remaining <= 3 ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-700"
      }`}
    >
      剩餘 {remaining} 秒
    </span>
  );
}
