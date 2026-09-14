"use client";

import { useEffect, useState } from "react";
import { isStarred, subscribeProgress, toggleStar } from "@/lib/storage";

export function StarControl({ questionId }: { questionId: string }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const sync = () => setOn(isStarred(questionId));
    sync();
    return subscribeProgress(sync);
  }, [questionId]);

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={on ? "取消收藏" : "收藏此題"}
      onClick={() => setOn(toggleStar(questionId))}
      className={`ml-auto min-h-11 rounded-full px-3 py-2 text-sm font-medium ${
        on ? "bg-amber-100 text-amber-900" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
      }`}
    >
      {on ? "已收藏" : "收藏"}
    </button>
  );
}
