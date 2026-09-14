"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { VENDOR_META } from "@/lib/vendor";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useActiveVendor } from "@/lib/useResolvedVendor";

const links = [
  { href: "/", label: "首頁" },
  { href: "/practice", label: "練習" },
  { href: "/exam", label: "模考" },
  { href: "/review", label: "複習" },
  { href: "/lab", label: "實驗" },
  { href: "/stats", label: "統計" },
];

const tabLinks = [
  { href: "/", label: "首頁", icon: HomeIcon },
  { href: "/practice", label: "練習", icon: PracticeIcon },
  { href: "/exam", label: "模考", icon: ExamIcon },
  { href: "/review", label: "複習", icon: ReviewIcon },
  { href: "/stats", label: "統計", icon: StatsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { vendor } = useActiveVendor();
  const isHome = pathname === "/";

  useEffect(() => {
    const header = document.getElementById("qb-header");
    if (!header) return;
    const apply = () => {
      document.documentElement.style.setProperty("--qb-header-h", `${header.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
  }, [vendor, pathname]);

  return (
    <div className={`qb-shell flex min-h-screen flex-col ${isHome ? "qb-home" : ""}`}>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--qb-navy)] focus:px-4 focus:py-2.5 focus:text-sm focus:font-medium focus:text-[var(--qb-sheet)]"
      >
        跳到主要內容
      </a>
      <header
        id="qb-header"
        className="pointer-events-none sticky top-0 z-20 border-b border-[color-mix(in_srgb,var(--qb-navy)_10%,transparent)] bg-[var(--qb-sheet)] pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
      >
        <div className="pointer-events-auto mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2 md:py-3">
          <Link href="/" data-full-nav className="flex min-h-11 items-center gap-2 text-slate-900">
            <span className="qb-chop">題</span>
            <span className="text-[15px] font-extrabold tracking-tight">題庫刷題</span>
          </Link>
          <div className="flex items-center gap-1">
            <nav className="hidden flex-wrap items-center justify-end gap-1 text-sm md:flex" aria-label="主要">
              {links
                .filter((link) => link.href !== "/lab" || Boolean(vendor && VENDOR_META[vendor].hasLabs))
                .map((link) => {
                  const active =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href || pathname.startsWith(`${link.href}/`);
                  const href = link.href === "/" || !vendor ? link.href : `${link.href}?vendor=${vendor}`;
                  return (
                    <Link
                      key={link.href}
                      href={href}
                      data-full-nav
                      className={`inline-flex min-h-11 items-center rounded-full px-3.5 transition-colors ${
                        active
                          ? "bg-[var(--qb-navy)] text-white"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <main
        id="main"
        tabIndex={-1}
        className="relative z-0 mx-auto w-full max-w-5xl flex-1 scroll-mt-[var(--qb-header-h)] py-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:py-7 sm:pl-[max(1.25rem,env(safe-area-inset-left))] sm:pr-[max(1.25rem,env(safe-area-inset-right))]"
      >
        {children}
      </main>
      <footer className="mx-auto hidden w-full max-w-5xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] text-center text-xs text-slate-400 md:block">
        作答進度只存在這個瀏覽器，可在統計頁備份
        <span className="qb-install-hint">
          。可用瀏覽器選單加入主畫面；連線時打開過的頁面，之後能離線刷
        </span>
      </footer>
      <nav className="qb-bottom-nav" aria-label="主要分頁">
        {tabLinks.map((link) => {
          const active =
            link.href === "/"
              ? pathname === "/"
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          const href = link.href === "/" || !vendor ? link.href : `${link.href}?vendor=${vendor}`;
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={href}
              data-full-nav
              className={`flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium leading-none ${
                active ? "text-[var(--qb-navy)]" : "text-slate-400"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon active={active} />
              <span>{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function iconClass(active: boolean) {
  return `h-5 w-5 ${active ? "stroke-[2]" : "stroke-[1.7]"}`;
}

function NavIcon({ active, filled, children }: { active: boolean; filled?: boolean; children: ReactNode }) {
  return (
    <svg
      className={iconClass(active)}
      viewBox="0 0 24 24"
      fill={filled && active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active} filled>
      <path d="M4 11.5 12 5l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </NavIcon>
  );
}

function PracticeIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <path d="M8 9h8M8 13h6" />
    </NavIcon>
  );
}

function ExamIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </NavIcon>
  );
}

function ReviewIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <path d="M12 5 9 12h6l-3 7" />
    </NavIcon>
  );
}

function StatsIcon({ active }: { active: boolean }) {
  return (
    <NavIcon active={active}>
      <path d="M6 18V10M12 18V6M18 18v-5" />
    </NavIcon>
  );
}
