"use client";

import type { Question } from "@/lib/types";

export function HotspotBoard({
  question,
  selected,
  onChange,
  disabled,
  showResult,
}: {
  question: Question;
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled: boolean;
  showResult: boolean;
}) {
  const spots = question.hotspots ?? [];
  const answers = question.answer ?? [];
  const multi = answers.length > 1;

  function toggle(id: string) {
    if (disabled) return;
    if (multi) {
      onChange(selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]);
      return;
    }
    onChange([id]);
  }

  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm text-slate-500">{multi ? "可點選多個區域。" : "點選圖上正確的位置。"}</p>
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={question.image} alt={question.stem} className="block w-full select-none" draggable={false} />
        {spots.map((spot) => {
          const checked = selected.includes(spot.id);
          const isAnswer = answers.includes(spot.id);
          let ring = "border-white/70 bg-white/10 hover:bg-white/25";
          if (checked && !showResult) ring = "border-2 border-sky-500 bg-sky-400/35";
          if (showResult && isAnswer) ring = "border-2 border-emerald-500 bg-emerald-400/30";
          if (showResult && checked && !isAnswer) ring = "border-2 border-red-500 bg-red-400/30";
          return (
            <button
              key={spot.id}
              type="button"
              disabled={disabled}
              aria-label={spot.label ?? spot.id}
              onClick={() => toggle(spot.id)}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: `${spot.w}%`,
                height: `${spot.h}%`,
              }}
              className={`absolute rounded-md border border-dashed ${ring}`}
            />
          );
        })}
      </div>
    </div>
  );
}
