"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { createSession, execute, prompt } from "@/lib/lab/cli";
import { createVrpSession, vrpExecute, vrpPrompt } from "@/lib/lab/vrp";
import { buildLabState, getLab } from "@/lib/lab/labs";
import type { CliSession, Lab } from "@/lib/lab/types";
import { isLabCompleted, recordLabCompletion } from "@/lib/storage";

type Line = { kind: "cmd" | "out" | "sys"; text: string };

function newSession(lab: Lab): CliSession {
  const state = buildLabState(lab);
  return lab.engine === "vrp" ? createVrpSession(state) : createSession(state);
}

function runLine(lab: Lab, session: CliSession, line: string): string {
  return lab.engine === "vrp" ? vrpExecute(session, line) : execute(session, line);
}

function cliPrompt(lab: Lab, session: CliSession): string {
  return lab.engine === "vrp" ? vrpPrompt(session) : prompt(session);
}

export function LabPlayer({ labId }: { labId: string }) {
  const lab = getLab(labId);
  if (!lab) {
    return (
      <div className="qb-card p-6">
        <p>找不到這個實驗。</p>
        <Link href="/lab" className="mt-3 inline-block text-blue-700">
          回到實驗列表
        </Link>
      </div>
    );
  }

  return <LabWorkspace key={lab.id} lab={lab} />;
}

function LabWorkspace({ lab }: { lab: Lab }) {
  const [session, setSession] = useState<CliSession>(() => newSession(lab));
  const [lines, setLines] = useState<Line[]>([
    { kind: "sys", text: lab.engine === "vrp"
      ? "華為 VRP 模擬。輸入 ? 看指令，可縮寫（sys、int GE0/0/1、dis vlan、dis cu）。使用者視圖先 system-view。"
      : "Cisco IOS 風格交換器模擬。輸入 ? 看可用指令，指令可縮寫（conf t、int fa0/1、sh vlan br）。" },
  ]);
  const [input, setInput] = useState("");
  const [hintIndex, setHintIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [historyPos, setHistoryPos] = useState(-1);
  const [completed, setCompleted] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);

  const checks = useMemo(
    () => lab.checks.map((check) => ({ ...check, ok: check.pass(session.state) })),
    [lab.checks, session.state],
  );
  const allPassed = checks.every((check) => check.ok);
  const passedCount = checks.filter((check) => check.ok).length;

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [lines]);

  useEffect(() => {
    if (allPassed && !completed) {
      setCompleted(true);
      recordLabCompletion(lab.id);
      setLines((current) => [
        ...current,
        { kind: "sys", text: "全部目標已達成，實驗完成。可用 show running-config 再核對一次。" },
      ]);
    }
  }, [allPassed, completed, lab.id]);

  useEffect(() => {
    setCompleted(isLabCompleted(lab.id) && allPassed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function reset() {
    setSession(newSession(lab));
    setLines([{ kind: "sys", text: "實驗已重置。從 enable 開始。" }]);
    setInput("");
    setHintIndex(0);
    setHistory([]);
    setHistoryPos(-1);
    setCompleted(false);
    field.current?.focus();
  }

  function run(command: string) {
    const next = {
      ...session,
      state: structuredClone(session.state),
      currentIfs: [...session.currentIfs],
    };
    const output = runLine(lab, next, command);
    const shown = session.awaitingPassword ? "********" : command;
    const added: Line[] = [{ kind: "cmd", text: `${cliPrompt(lab, session)}${shown}` }];
    if (output) added.push({ kind: "out", text: output });
    setSession(next);
    setLines((current) => [...current, ...added]);
    if (command.trim() && !session.awaitingPassword) {
      setHistory((current) => [...current, command]);
    }
    setHistoryPos(-1);
    setInput("");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    run(input);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowUp" && history.length > 0) {
      event.preventDefault();
      const nextPos = historyPos < 0 ? history.length - 1 : Math.max(0, historyPos - 1);
      setHistoryPos(nextPos);
      setInput(history[nextPos] ?? "");
    }
    if (event.key === "ArrowDown" && history.length > 0) {
      event.preventDefault();
      if (historyPos < 0) return;
      const nextPos = historyPos + 1;
      if (nextPos >= history.length) {
        setHistoryPos(-1);
        setInput("");
      } else {
        setHistoryPos(nextPos);
        setInput(history[nextPos] ?? "");
      }
    }
  }

  return (
    <div className="qb-lab space-y-4 qb-in">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-medium ${lab.engine === "vrp" ? "text-red-700" : "text-blue-700"}`}>
            {lab.engine === "vrp" ? "華為 VRP" : "Cisco IOS"} · {lab.level}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{lab.title}</h1>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition hover:bg-slate-50">
            重置
          </button>
          <Link
            href={`/lab?vendor=${lab.engine === "vrp" ? "huawei" : "cisco"}`}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm transition hover:bg-slate-50"
          >
            {lab.engine === "vrp" ? "華為實驗列表" : "Cisco 實驗列表"}
          </Link>
        </div>
      </div>

      <section className="qb-card p-4">
        <h2 className="text-sm font-semibold text-slate-700">情境</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-600">{lab.scenario}</p>
        <p className="mt-2 font-mono text-xs text-slate-500">{lab.topology}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(16rem,0.9fr)] lg:items-start">
        <section className="order-2 flex min-h-[min(52vh,28rem)] flex-col overflow-hidden rounded-2xl border border-slate-800 bg-[#070b14] shadow-xl shadow-slate-900/20 lg:order-1 lg:sticky lg:top-[var(--qb-header-h)] lg:min-h-[min(70vh,36rem)]">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2 text-xs text-slate-400">
            <span className="flex items-center gap-2">
              <span className="flex gap-1">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
              </span>
              CLI · {session.state.hostname} · {lab.engine === "vrp" ? "VRP" : "IOS"}
            </span>
            <span>上鍵可翻指令紀錄</span>
          </div>
          <div
            ref={scroller}
            className="min-h-0 flex-1 overflow-y-auto px-3 py-3 font-mono text-[13px] leading-6 text-emerald-300 max-lg:pb-16"
            onClick={() => field.current?.focus()}
          >
            {lines.map((line, index) => (
              <pre
                key={`${index}-${line.text.slice(0, 12)}`}
                className={`whitespace-pre-wrap break-all ${
                  line.kind === "cmd" ? "text-slate-100" : line.kind === "sys" ? "text-sky-300" : "text-emerald-300"
                }`}
              >
                {line.text}
              </pre>
            ))}
          </div>
          <form
            onSubmit={onSubmit}
            className="qb-lab-input flex items-center gap-0 border-t border-slate-800 bg-[#070b14] py-2 font-mono text-[13px] text-slate-100 max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-20 max-lg:pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
          >
            {!session.awaitingPassword && <span className="shrink-0">{cliPrompt(lab, session)}</span>}
            {session.awaitingPassword && <span className="shrink-0">Password: </span>}
            <input
              ref={field}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent outline-none"
              type={session.awaitingPassword ? "password" : "text"}
              aria-label="交換器指令"
            />
          </form>
        </section>

        <section className="order-1 qb-card p-4 lg:order-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              目標 {passedCount}/{checks.length}
            </h2>
            {completed && <span className="text-sm font-medium text-emerald-700">已完成</span>}
          </div>
          <ul className="space-y-2">
            {checks.map((check) => (
              <li key={check.id} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] text-white ${
                    check.ok ? "bg-emerald-600" : "bg-slate-300"
                  }`}
                >
                  {check.ok ? "✓" : ""}
                </span>
                <span className={check.ok ? "text-emerald-800" : "text-slate-700"}>{check.label}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => setHintIndex((value) => Math.min(lab.hints.length, value + 1))}
            className="mt-3 text-sm text-blue-700"
          >
            {hintIndex >= lab.hints.length ? "提示已全部展開" : "顯示下一則提示"}
          </button>
          {hintIndex > 0 && (
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
              {lab.hints.slice(0, hintIndex).map((hint) => (
                <li key={hint} className="font-mono text-xs sm:text-sm">
                  {hint}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
