#!/usr/bin/env node
/**
 * 建置 Capacitor 本機 www（靜態匯出 + 離線題庫）。
 * 不指向 production Vercel URL。
 *
 * 步驟：產生 offline-bank → 暫時移走 API／動態路由 → next export → 還原 → 寫入 www/
 */
import { spawnSync } from "node:child_process";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
  access,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wwwDir = path.join(root, "www");
const nativeBank = path.join(root, "native", "offline-bank.json");
const publicBank = path.join(root, "public", "offline-bank.json");

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, ...env },
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with ${result.status}`);
  }
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function moveAside(relPath, backupRoot) {
  const from = path.join(root, relPath);
  if (!(await exists(from))) return null;
  const to = path.join(backupRoot, relPath);
  await mkdir(path.dirname(to), { recursive: true });
  await rename(from, to);
  return { from, to, relPath };
}

async function restore(entry) {
  if (!entry) return;
  await mkdir(path.dirname(entry.from), { recursive: true });
  if (await exists(entry.from)) await rm(entry.from, { recursive: true, force: true });
  await rename(entry.to, entry.from);
}

const backupRoot = await mkdtemp(path.join(os.tmpdir(), "quiz-bank-cap-"));
const moved = [];
/** @type {{ full: string, before: string }[]} */
const patchBackups = [];
const originalConfig = await readFile(path.join(root, "next.config.ts"), "utf8");

try {
  console.log("→ build offline bank");
  run("node", ["scripts/build-offline-bank.mjs"]);

  console.log("→ stage offline-bank into public/ for static export (temporary)");
  await cp(nativeBank, publicBank);

  console.log("→ move aside server-only / dynamic routes");
  // icons/[size] 已是 force-static + generateStaticParams，可一併匯出
  for (const rel of ["app/api", "proxy.ts"]) {
    moved.push(await moveAside(rel, backupRoot));
  }

  console.log("→ write native next.config.ts (static export)");
  await writeFile(
    path.join(root, "next.config.ts"),
    `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: false,
};

export default nextConfig;
`,
    "utf8",
  );

  // static export 不能在 Server Component await searchParams／cookies：改寫為 client
  const patches = [
    {
      file: "app/layout.tsx",
      transform: (src) =>
        src
          .replace(/import \{ cookies \} from "next\/headers";\n/, "")
          .replace(/import \{ VENDOR_COOKIE \} from "@\/lib\/storage";\n/, "")
          .replace(
            /export default async function RootLayout\(\{ children \}: \{ children: React\.ReactNode \}\) \{\n  const jar = await cookies\(\);\n  const vendor = tryParseVendor\(jar\.get\(VENDOR_COOKIE\)\?\.value\);\n\n  return \(/,
            `export default function RootLayout({ children }: { children: React.ReactNode }) {
  const vendor = null;

  return (`,
          ),
    },
    {
      file: "app/page.tsx",
      transform: () => `"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { HomePage } from "@/components/HomePage";
import { filterHomeVendors, type HomeQuery } from "@/lib/homeSearch";
import { getTrivia, parseTriviaGuess, pickTrivia } from "@/lib/trivia";
import { tryParseVendor } from "@/lib/vendor";
import { LoadingNote } from "@/components/ui";

function HomeInner() {
  const params = useSearchParams();
  const homeQuery: HomeQuery = {
    tid: params.get("tid") ?? undefined,
    guess: params.get("guess") ?? undefined,
    v: params.get("v") ?? undefined,
    skip: params.get("skip") ?? undefined,
    search: params.get("search") ?? undefined,
    q: params.get("q") ?? undefined,
  };
  const filter = tryParseVendor(homeQuery.v) ?? "all";
  const poolVendor = filter === "all" ? undefined : filter;
  const guess = parseTriviaGuess(homeQuery.guess);
  const fromId = getTrivia(homeQuery.tid);
  const trivia = useMemo(
    () => (guess !== null && fromId ? fromId : pickTrivia(poolVendor, homeQuery.skip)),
    [guess, fromId, poolVendor, homeQuery.skip],
  );
  const searchQuery = homeQuery.q?.trim() ?? "";
  return (
    <HomePage
      trivia={trivia}
      guess={guess !== null && fromId ? guess : null}
      filter={filter}
      homeQuery={homeQuery}
      searchQuery={searchQuery}
      vendors={filterHomeVendors(searchQuery)}
    />
  );
}

export default function Page() {
  return (
    <Suspense fallback={<LoadingNote text="載入首頁…" />}>
      <HomeInner />
    </Suspense>
  );
}
`,
    },
    {
      file: "app/practice/page.tsx",
      transform: () => `"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { PracticeClient } from "@/components/PracticeClient";
import { LoadingNote } from "@/components/ui";
import { parsePracticeStart } from "@/lib/quizStart";

function PracticeInner() {
  const params = useSearchParams();
  const start = useMemo(() => {
    const query: Record<string, string> = {};
    params.forEach((value, key) => {
      query[key] = value;
    });
    return parsePracticeStart(query, null);
  }, [params]);
  return <PracticeClient start={start} />;
}

export default function PracticePage() {
  return (
    <Suspense fallback={<LoadingNote text="載入練習…" />}>
      <PracticeInner />
    </Suspense>
  );
}
`,
    },
    {
      file: "app/exam/page.tsx",
      transform: () => `"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ExamClient } from "@/components/ExamClient";
import { LoadingNote } from "@/components/ui";
import { parseExamStart } from "@/lib/quizStart";

function ExamInner() {
  const params = useSearchParams();
  const start = useMemo(() => {
    const query: Record<string, string> = {};
    params.forEach((value, key) => {
      query[key] = value;
    });
    return parseExamStart(query, null);
  }, [params]);
  return <ExamClient start={start} />;
}

export default function ExamPage() {
  return (
    <Suspense fallback={<LoadingNote text="載入模考…" />}>
      <ExamInner />
    </Suspense>
  );
}
`,
    },
  ];

  for (const patch of patches) {
    const full = path.join(root, patch.file);
    const before = await readFile(full, "utf8");
    patchBackups.push({ full, before });
    await writeFile(full, patch.transform(before), "utf8");
  }

  console.log("→ next build (NATIVE_SHELL static export)");
  run("npx", ["next", "build"], { NEXT_PUBLIC_NATIVE_SHELL: "1" });

  console.log("→ copy out/ → www/");
  await rm(wwwDir, { recursive: true, force: true });
  await mkdir(wwwDir, { recursive: true });
  await cp(path.join(root, "out"), wwwDir, { recursive: true });
  await cp(nativeBank, path.join(wwwDir, "offline-bank.json"));

  console.log(`✓ Capacitor www ready at ${wwwDir}`);
  console.log("  Next: npx cap sync ios   (on macOS with Xcode for archive)");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  for (const item of patchBackups) {
    try {
      await writeFile(item.full, item.before, "utf8");
    } catch {
      /* ignore */
    }
  }
  await writeFile(path.join(root, "next.config.ts"), originalConfig, "utf8");
  for (const entry of moved.reverse()) {
    await restore(entry);
  }
  if (await exists(publicBank)) await rm(publicBank, { force: true });
  await rm(backupRoot, { recursive: true, force: true });
  // 確保網站 public 不殘留離線包
  if (await exists(publicBank)) {
    console.error("FATAL: public/offline-bank.json still present");
    process.exitCode = 1;
  }
}
