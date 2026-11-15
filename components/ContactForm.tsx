"use client";

import { useState, type FormEvent } from "react";

const FEEDBACK_TYPES = [
  { value: "bug", label: "問題／Bug" },
  { value: "suggestion", label: "建議" },
  { value: "other", label: "其他" },
] as const;

const FEEDBACK_EMAIL = "3toolsbox@gmail.com";

type Status = "idle" | "submitting" | "success" | "error";

type ContactFormProps = {
  endpoint?: string;
};

export function ContactForm({ endpoint }: ContactFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);

    // Honeypot: bots fill hidden fields; real users leave it empty.
    if (String(data.get("company") ?? "").trim()) {
      setStatus("success");
      form.reset();
      return;
    }

    const type = String(data.get("type") ?? "").trim();
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim();
    const message = String(data.get("message") ?? "").trim();

    if (!type || !message) {
      setStatus("error");
      setErrorMessage("請選擇類型並填寫訊息內容。");
      return;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus("error");
      setErrorMessage("回覆電郵格式不正確，請再檢查一次。");
      return;
    }

    const typeLabel = FEEDBACK_TYPES.find((item) => item.value === type)?.label ?? type;
    const payload: Record<string, string> = {
      type: typeLabel,
      message,
      _subject: `[題庫刷題] ${typeLabel}`,
    };
    if (name) payload.name = name;
    if (email) {
      payload.email = email;
      payload._replyto = email;
    }

    setStatus("submitting");
    setErrorMessage("");

    const target = endpoint?.trim() || `https://formsubmit.co/ajax/${FEEDBACK_EMAIL}`;

    try {
      const response = await fetch(target, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      let body: { success?: string | boolean; ok?: boolean; message?: string; error?: string } | null =
        null;
      try {
        body = (await response.json()) as {
          success?: string | boolean;
          ok?: boolean;
          message?: string;
          error?: string;
        };
      } catch {
        body = null;
      }

      const rejected =
        body?.success === false ||
        body?.success === "false" ||
        body?.ok === false ||
        Boolean(body?.error);

      if (!response.ok || rejected) {
        setStatus("error");
        setErrorMessage(
          body?.message?.trim() ||
            body?.error?.trim() ||
            "送出失敗，請稍後再試，或直接電郵聯絡我們。",
        );
        return;
      }

      setStatus("success");
      form.reset();
    } catch {
      setStatus("error");
      setErrorMessage("網絡錯誤，未能送出。請檢查連線後再試，或直接電郵聯絡我們。");
    }
  }

  return (
    <form className="qb-card relative space-y-4 p-5 sm:p-6" onSubmit={onSubmit} noValidate>
      <div>
        <label htmlFor="contact-type" className="text-sm font-medium text-slate-700">
          類型 <span className="text-[var(--qb-bad)]">*</span>
        </label>
        <select id="contact-type" name="type" required className="qb-input" defaultValue="bug">
          {FEEDBACK_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="contact-name" className="text-sm font-medium text-slate-700">
          名稱 <span className="font-normal text-slate-400">（選填）</span>
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          autoComplete="name"
          maxLength={80}
          className="qb-input"
          placeholder="可留空"
        />
      </div>

      <div>
        <label htmlFor="contact-email" className="text-sm font-medium text-slate-700">
          回覆電郵 <span className="font-normal text-slate-400">（選填）</span>
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={120}
          className="qb-input"
          placeholder="方便我們回覆你"
        />
      </div>

      <div>
        <label htmlFor="contact-message" className="text-sm font-medium text-slate-700">
          訊息 <span className="text-[var(--qb-bad)]">*</span>
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={4000}
          className="qb-input min-h-[9rem] resize-y"
          placeholder="請描述問題、重現步驟或建議內容"
        />
      </div>

      {/* Honeypot — visually hidden; leave empty */}
      <div className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden" aria-hidden>
        <label htmlFor="contact-company">公司</label>
        <input id="contact-company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {status === "success" ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--qb-ok)_12%,var(--qb-sheet))] px-4 py-3 text-sm text-[var(--qb-ok)]" role="status">
          已送出，多謝你的回報。若這是首次使用 FormSubmit
          收件，收件信箱可能會先收到一封確認電郵，請點選確認後後續訊息才會送達。
        </p>
      ) : null}

      {status === "error" ? (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--qb-bad)_10%,var(--qb-sheet))] px-4 py-3 text-sm text-[var(--qb-bad)]" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-slate-400">
          亦可直接電郵{" "}
          <a className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600" href={`mailto:${FEEDBACK_EMAIL}`}>
            {FEEDBACK_EMAIL}
          </a>
        </p>
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--qb-navy)] px-5 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {status === "submitting" ? "送出中…" : "送出回報"}
        </button>
      </div>
    </form>
  );
}
