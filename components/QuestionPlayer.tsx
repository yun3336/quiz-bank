"use client";

import { useEffect, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { HotspotBoard } from "@/components/HotspotBoard";
import { QuestionCard } from "@/components/QuestionCard";
import { SpeakPanel } from "@/components/SpeakPanel";
import { PassageBlock, QuestionChips } from "@/components/ui";
import { directionLabel, isChoiceQuestion, questionTypeLabel, revealAnswer, spokenText } from "@/lib/grade";
import { shuffle } from "@/lib/questions";
import type { Question } from "@/lib/types";
import { chapterVendor, vendorAccent } from "@/lib/vendor";

type Props = {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  showResult?: boolean;
  hideStem?: boolean;
  examMode?: boolean;
};

export function QuestionPlayer({
  question,
  selected,
  onChange,
  disabled = false,
  showResult = false,
  hideStem = false,
  examMode = false,
}: Props) {
  if (isChoiceQuestion(question)) {
    return (
      <QuestionCard
        question={question}
        selected={selected}
        onChange={onChange}
        disabled={disabled}
        showResult={showResult}
        hideStem={hideStem}
      />
    );
  }

  const vendor = chapterVendor(question.chapter);

  return (
    <article className="qb-card p-4 sm:p-5">
      <QuestionChips
        vendor={vendor}
        chapter={question.chapter}
        typeLabel={questionTypeLabel(question.type)}
        tags={question.tags}
        questionId={question.id}
      />
      <PassageBlock question={question} />
      {hideStem ? (
        <h2 className="text-lg font-medium text-slate-500">（聽完後作答）</h2>
      ) : (
        <h2 className="text-lg font-medium leading-relaxed text-slate-900">{question.stem}</h2>
      )}
      {question.type === "cloze" ? (
        <ClozeFields question={question} selected={selected} onChange={onChange} disabled={disabled} />
      ) : null}
      {question.type === "short" ? (
        <ShortField selected={selected} onChange={onChange} disabled={disabled} />
      ) : null}
      {question.type === "translate" ? (
        <TranslateFields question={question} selected={selected} onChange={onChange} disabled={disabled} examMode={examMode} />
      ) : null}
      {question.type === "dictation" ? (
        <DictationFields
          question={question}
          selected={selected}
          onChange={onChange}
          disabled={disabled}
          examMode={examMode}
          showResult={showResult}
        />
      ) : null}
      {question.type === "hotspot" ? (
        <HotspotBoard
          question={question}
          selected={selected}
          onChange={onChange}
          disabled={disabled}
          showResult={showResult}
        />
      ) : null}
      {question.type === "speak" ? (
        <SpeakPanel
          question={question}
          selected={selected}
          onChange={onChange}
          disabled={disabled}
          examMode={examMode}
        />
      ) : null}
      {question.type === "order" ? (
        <OrderFields question={question} selected={selected} onChange={onChange} disabled={disabled} />
      ) : null}
      {question.type === "match" ? (
        <MatchFields question={question} selected={selected} onChange={onChange} disabled={disabled} />
      ) : null}
      {showResult && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <p className="font-medium text-slate-900">解析</p>
          <p className="mt-1">參考答案：{revealAnswer(question)}</p>
          {question.type === "dictation" ? <p className="mt-1">原文：{spokenText(question)}</p> : null}
          {question.type === "speak" ? <p className="mt-1">目標句：{spokenText(question)}</p> : null}
          <p className="mt-2">{question.explanation}</p>
        </div>
      )}
    </article>
  );
}

function TranslateFields({
  question,
  selected,
  onChange,
  disabled,
  examMode,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
  examMode: boolean;
}) {
  return (
    <div className="mt-4 space-y-3">
      <p className="rounded-xl bg-slate-50 px-4 py-3 text-base leading-relaxed text-slate-900">{question.source}</p>
      <p className="text-sm text-slate-500">
        {directionLabel(question.direction)}
        {examMode ? " · 模考批改較嚴，請接近標準譯文" : " · 常見同義說法也可"}
      </p>
      <textarea
        value={selected[0] ?? ""}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        rows={3}
        placeholder="在這裡輸入譯文…"
        onChange={(event) => onChange([event.target.value])}
        className="qb-input mt-0 min-h-24 resize-y"
      />
    </div>
  );
}

function DictationFields({
  question,
  selected,
  onChange,
  disabled,
  examMode,
  showResult,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
  examMode: boolean;
  showResult: boolean;
}) {
  const [peek, setPeek] = useState(false);
  const text = spokenText(question);
  const hasFile = Boolean(question.audioSrc);

  useEffect(() => {
    setPeek(false);
  }, [question.id]);

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-500">
        {examMode
          ? hasFile
            ? "模考聽寫較嚴。考試中不顯示原文，請聽錄音檔。"
            : "模考聽寫較嚴，請盡量連標點一併寫出。考試中不顯示原文。"
          : hasFile
            ? "播放錄音後打出原文。沒聽到可再播。"
            : "聽完後打出原文。大小寫不拘。"}
      </p>
      <AudioPlayer question={question} autoPlay={!(disabled && showResult)} label="再聽一次" />
      {!examMode ? (
        <button
          type="button"
          onClick={() => setPeek((value) => !value)}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm"
        >
          {peek || showResult ? "隱藏原文" : "顯示原文"}
        </button>
      ) : null}
      {(peek || showResult) && !examMode ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-800">{text}</p>
      ) : null}
      <textarea
        value={selected[0] ?? ""}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        rows={3}
        placeholder="在這裡聽寫…"
        onChange={(event) => onChange([event.target.value])}
        className="qb-input mt-0 min-h-24 resize-y"
      />
    </div>
  );
}

function ClozeFields({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
}) {
  const blanks = question.blanks ?? [];
  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-500">依空格順序填入，大小寫不拘。</p>
      {blanks.map((_, index) => (
        <label key={index} className="block">
          <span className="text-xs text-slate-500">第 {index + 1} 格</span>
          <input
            value={selected[index] ?? ""}
            disabled={disabled}
            autoComplete="off"
            onChange={(event) => {
              const next = blanks.map((__, inner) => selected[inner] ?? "");
              next[index] = event.target.value;
              onChange(next);
            }}
            className="qb-input mt-1"
          />
        </label>
      ))}
    </div>
  );
}

function ShortField({
  selected,
  onChange,
  disabled,
}: {
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
}) {
  return (
    <input
      value={selected[0] ?? ""}
      disabled={disabled}
      autoComplete="off"
      placeholder="請輸入答案…"
      spellCheck={false}
      onChange={(event) => onChange([event.target.value])}
      className="qb-input mt-4"
    />
  );
}

function OrderFields({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
}) {
  const tokens = question.tokens ?? [];
  const [pool, setPool] = useState(() => shuffle(tokens));

  useEffect(() => {
    setPool(shuffle(tokens));
  }, [question.id]);

  const remaining = pool.filter((token) => !selected.includes(token.id));
  const chosen = selected
    .map((id) => tokens.find((token) => token.id === id))
    .filter((item): item is (typeof tokens)[number] => Boolean(item));

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-500">依正確順序點選。點已選項目可取消。</p>
      <div className="flex min-h-14 flex-wrap gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3">
        {chosen.length === 0 ? (
          <span className="text-sm text-slate-400">尚未排序</span>
        ) : (
          chosen.map((token, index) => (
            <button
              key={token.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(selected.filter((id) => id !== token.id))}
              className="rounded-lg border border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 shadow-sm"
            >
              {index + 1}. {token.text}
            </button>
          ))
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {remaining.map((token) => (
          <button
            key={token.id}
            type="button"
            disabled={disabled}
            onClick={() => onChange([...selected, token.id])}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {token.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function MatchFields({
  question,
  selected,
  onChange,
  disabled,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
}) {
  const pairs = question.pairs ?? [];
  const accent = vendorAccent(chapterVendor(question.chapter));
  const [right, setRight] = useState(() => shuffle(pairs.map((pair) => pair.right)));
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => {
    setRight(shuffle(pairs.map((pair) => pair.right)));
    setPicked(null);
  }, [question.id]);

  const used = new Set(selected.filter(Boolean));

  function chooseRight(label: string) {
    if (picked === null || disabled) return;
    const next = pairs.map((_, index) => selected[index] ?? "");
    const previous = next[picked];
    next[picked] = label;
    onChange(next);
    setPicked(null);
    void previous;
  }

  return (
    <div className="mt-4 space-y-3">
      <p className="text-sm text-slate-500">先點左邊，再點右邊對應項。</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <ul className="space-y-2">
          {pairs.map((pair, index) => {
            const chosen = selected[index] ?? "";
            return (
              <li key={`${pair.left}-${index}`}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => setPicked(index)}
                  className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${
                    chosen
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
                      : picked === index
                        ? `${accent.option} ring-2 ${accent.ring}`
                        : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <span className="block">{pair.left}</span>
                  {chosen ? <span className="mt-1 block text-xs">→ {chosen}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
        <ul className="space-y-2">
          {right.map((label, index) => (
            <li key={`${label}-${index}`}>
              <button
                type="button"
                disabled={disabled || used.has(label) || picked === null}
                onClick={() => chooseRight(label)}
                className={`w-full rounded-xl border px-3 py-3 text-left text-sm ${
                  used.has(label) ? "border-emerald-600 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-white"
                } disabled:opacity-60`}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
