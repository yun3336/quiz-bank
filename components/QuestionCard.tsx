"use client";

import type { Question } from "@/lib/types";
import { isChoiceQuestion, questionTypeLabel } from "@/lib/grade";
import { QuestionChips, PassageBlock } from "@/components/ui";
import { AudioPlayer } from "@/components/AudioPlayer";
import { chapterVendor, vendorAccent } from "@/lib/vendor";

type Props = {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  showResult?: boolean;
  hideStem?: boolean;
};

export function QuestionCard({
  question,
  selected,
  onChange,
  disabled = false,
  showResult = false,
  hideStem = false,
}: Props) {
  if (!isChoiceQuestion(question) || !question.options) {
    return null;
  }
  const isMultiple = question.type === "multiple";
  const answers = question.answer ?? [];

  function toggle(id: string) {
    if (disabled) return;
    if (isMultiple) {
      onChange(
        selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
      );
      return;
    }
    onChange([id]);
  }

  const typeLabel = questionTypeLabel(question.type);
  const vendor = chapterVendor(question.chapter);
  const accent = vendorAccent(vendor);

  return (
    <article className="qb-card p-4 sm:p-5">
      <QuestionChips vendor={vendor} chapter={question.chapter} typeLabel={typeLabel} tags={question.tags} questionId={question.id} />
      <PassageBlock question={question} />
      {question.audioSrc ? (
        <div className="mb-3">
          <AudioPlayer question={question} autoPlay label="播放錄音" />
        </div>
      ) : null}
      {hideStem ? (
        <h2 className="text-lg font-medium text-slate-500">（聽完後選擇）</h2>
      ) : (
        <h2 className="text-lg font-medium leading-relaxed text-slate-900">{question.stem}</h2>
      )}
      {isMultiple && (
        <p className="mt-2 text-sm text-slate-500">可選多個答案，需全部選對才算正確。</p>
      )}
      <ul className="mt-4 space-y-2">
        {question.options.map((option) => {
          const checked = selected.includes(option.id);
          const isAnswer = answers.includes(option.id);
          let stateClass = "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";
          if (checked && !showResult) stateClass = accent.option;
          if (showResult && isAnswer) stateClass = "border-emerald-500 bg-emerald-50";
          if (showResult && checked && !isAnswer) stateClass = "border-red-400 bg-red-50";

          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => toggle(option.id)}
                disabled={disabled}
                aria-pressed={checked}
                className={`flex min-h-11 w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left text-base transition ${stateClass} ${
                  disabled ? "cursor-not-allowed" : "cursor-pointer"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${
                    showResult && isAnswer
                      ? "bg-emerald-600 text-white"
                      : showResult && checked
                        ? "bg-red-500 text-white"
                        : checked
                          ? `${accent.mark}`
                          : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {option.id}
                </span>
                <span className="min-w-0 flex-1 leading-relaxed text-slate-800">{option.text}</span>
                {showResult && isAnswer ? (
                  <span className="mt-0.5 shrink-0 text-xs font-semibold text-emerald-800">正確答案</span>
                ) : null}
                {showResult && checked && !isAnswer ? (
                  <span className="mt-0.5 shrink-0 text-xs font-semibold text-red-700">你的選擇</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {showResult && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-700">
          <p className="font-medium text-slate-900">解析</p>
          <p className="mt-1">{question.explanation}</p>
        </div>
      )}
    </article>
  );
}
