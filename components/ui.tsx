import type { ReactNode } from "react";
import type { Question } from "@/lib/types";
import { vendorAccent, VENDOR_META, type Vendor } from "@/lib/vendor";
import { StarControl } from "@/components/StarControl";
import { NoteControl } from "@/components/NoteControl";

export function PageHeader({
  title,
  desc,
}: {
  title: string;
  desc?: string;
}) {
  return (
    <div>
      <h1 className="text-pretty text-[1.85rem] font-extrabold tracking-tight text-slate-900">{title}</h1>
      {desc ? <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">{desc}</p> : null}
    </div>
  );
}

export function LoadingNote({ text = "載入中…" }: { text?: string }) {
  return (
    <div className="qb-card flex items-center gap-3 px-4 py-6 text-sm text-slate-500" role="status" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400 opacity-60" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-slate-500" />
      </span>
      {text}
    </div>
  );
}

export function QuestionChips({
  vendor,
  chapter,
  typeLabel,
  tags,
  questionId,
}: {
  vendor: Vendor;
  chapter: string;
  typeLabel: string;
  tags: string[];
  questionId?: string;
}) {
  const accent = vendorAccent(vendor);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
      <span className={`max-w-full truncate rounded-full px-2.5 py-0.5 font-medium ${accent.pill}`}>{VENDOR_META[vendor].label}</span>
      <span className="max-w-full truncate rounded-full bg-slate-100 px-2.5 py-0.5">{chapter}</span>
      <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-white">{typeLabel}</span>
      {tags.map((tag) => (
        <span key={tag} className="max-w-full truncate rounded-full bg-slate-50 px-2.5 py-0.5 text-slate-500" title={tag}>
          {tag}
        </span>
      ))}
      {questionId ? (
        <>
          <StarControl questionId={questionId} />
          <NoteControl questionId={questionId} />
        </>
      ) : null}
    </div>
  );
}

export function PassageBlock({ question }: { question: Question }) {
  if (!question.passage) return null;
  return (
    <div className="mb-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <p className="text-xs font-medium text-slate-500">閱讀文章</p>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{question.passage}</p>
    </div>
  );
}

export function ScoreRing({
  value,
  total,
  className = "",
}: {
  value: number;
  total: number;
  className?: string;
}) {
  const pct = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className={`relative mx-auto h-32 w-32 ${className}`}>
      <div
        className="h-full w-full rounded-full"
        style={{
          background: `conic-gradient(var(--qb-navy) ${pct}%, var(--qb-wash) 0)`,
        }}
      />
      <div className="absolute inset-2.5 flex flex-col items-center justify-center rounded-full bg-[var(--qb-sheet)]">
        <span className="qb-mono text-3xl font-semibold tracking-tight text-slate-900">{pct}</span>
        <span className="text-[11px] text-slate-500">分</span>
      </div>
    </div>
  );
}

export function VendorMark({ vendor, className = "h-11 w-11" }: { vendor: Vendor; className?: string }) {
  const accent = vendorAccent(vendor);
  return (
    <span className={`inline-flex items-center justify-center rounded-xl shadow-sm ${accent.mark} ${className}`}>
      <VendorGlyph vendor={vendor} />
    </span>
  );
}

function VendorGlyph({ vendor }: { vendor: Vendor }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true,
  };
  if (vendor === "huawei") {
    return (
      <svg {...common}>
        <path d="M12 3 20 8v8l-8 5-8-5V8z" />
        <path d="M12 8v8M8 10.5 12 13l4-2.5" />
      </svg>
    );
  }
  if (vendor === "language") {
    return (
      <svg {...common}>
        <path d="M4 6h10a3 3 0 0 1 3 3v5H8l-4 3z" />
        <path d="M14 11h6l-2 4-1.2-.8" />
      </svg>
    );
  }
  if (vendor === "math") {
    return (
      <svg {...common}>
        <path d="M6 8h12M6 16h12M9 5v6M15 13v6" />
      </svg>
    );
  }
  if (vendor === "science") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3" />
        <ellipse cx="12" cy="12" rx="9" ry="4" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-60 12 12)" />
      </svg>
    );
  }
  if (vendor === "career") {
    return (
      <svg {...common}>
        <path d="M8 9V7a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <rect x="4" y="9" width="16" height="11" rx="2" />
        <path d="M4 13h16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <rect x="4" y="7" width="6" height="10" rx="1" />
      <rect x="14" y="7" width="6" height="10" rx="1" />
      <path d="M10 12h4M7 4v3M17 4v3" />
    </svg>
  );
}

export function EmptyState({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children?: ReactNode;
}) {
  return (
    <div className="qb-card px-6 py-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-500">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <rect x="4" y="5" width="16" height="14" rx="2" />
          <path d="M8 9h8M8 13h5" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-slate-800">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{desc}</p>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}
