"use client";

import { useEffect, useState } from "react";
import { MAX_NOTE_LENGTH } from "@/lib/progress";
import { getNote, saveNote, subscribeProgress } from "@/lib/storage";

export function NoteControl({ questionId }: { questionId: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");

  useEffect(() => {
    const sync = () => setText(getNote(questionId));
    sync();
    return subscribeProgress(sync);
  }, [questionId]);

  function commit(value = text) {
    setText(saveNote(questionId, value));
  }

  const hasNote = text.trim().length > 0;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={hasNote ? "編輯筆記" : "新增筆記"}
        onClick={() => {
          if (open) commit();
          setOpen((value) => !value);
        }}
        className={`min-h-11 rounded-full px-3 py-2 text-sm font-medium ${
          hasNote ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50"
        }`}
      >
        {hasNote ? "有筆記" : "筆記"}
      </button>
      {open ? (
        <label className="mt-1 w-full basis-full">
          <span className="sr-only">本題筆記</span>
          <textarea
            value={text}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            placeholder="寫給自己看的提示，存在這個瀏覽器。"
            onChange={(event) => setText(event.target.value)}
            onBlur={() => commit()}
            className="qb-input mt-0 min-h-[5.5rem] resize-y px-3 py-2 text-sm leading-relaxed"
          />
        </label>
      ) : null}
    </>
  );
}
