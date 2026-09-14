import type { Question } from "./types";

export type Vendor = "cisco" | "huawei" | "language" | "math" | "science" | "career";

export const VENDORS: Vendor[] = ["cisco", "huawei", "language", "math", "science", "career"];

export const VENDOR_META: Record<
  Vendor,
  { label: string; short: string; subtitle: string; cli: string; hasLabs: boolean; methods?: string }
> = {
  cisco: {
    label: "Cisco",
    short: "Cisco",
    subtitle: "計算機基礎 · 看圖辨識 · IOS 實驗",
    cli: "IOS",
    hasLabs: true,
  },
  huawei: {
    label: "華為",
    short: "華為",
    subtitle: "HCIA / HCIP / HCIE 數通 · 看圖辨識 · VRP 實驗",
    cli: "VRP",
    hasLabs: true,
  },
  language: {
    label: "語言",
    short: "語言",
    subtitle: "選擇、填空、翻譯、聽寫、看圖與口說",
    cli: "英／中／日／韓",
    hasLabs: false,
    methods: "選擇、填空、閃卡、配對、聽力、速答、翻譯、聽寫、閱讀、看圖、口說、錄音聽力",
  },
  math: {
    label: "數學",
    short: "數學",
    subtitle: "算術、代數、幾何、機率統計",
    cli: "算／代／幾／統",
    hasLabs: false,
    methods: "選擇、填空、閃卡、配對、速答",
  },
  science: {
    label: "自然科學",
    short: "自然",
    subtitle: "物理、化學、生物、地球科學",
    cli: "理／化／生／地",
    hasLabs: false,
    methods: "選擇、填空、閃卡、配對、速答、看圖",
  },
  career: {
    label: "職場與證照",
    short: "職場",
    subtitle: "溝通、倫理、履歷面試、證照規劃",
    cli: "溝／倫／面／證",
    hasLabs: false,
    methods: "選擇、填空、閃卡、配對、速答",
  },
};

export function isHuaweiChapter(chapter: string): boolean {
  return (
    chapter.startsWith("HCIA") ||
    chapter.startsWith("HCIP") ||
    chapter.startsWith("HCIE") ||
    chapter.startsWith("華為")
  );
}

export function isLanguageChapter(chapter: string): boolean {
  return (
    chapter.startsWith("英語") ||
    chapter.startsWith("中文") ||
    chapter.startsWith("日語") ||
    chapter.startsWith("韓語") ||
    chapter.startsWith("語言")
  );
}

export function isMathChapter(chapter: string): boolean {
  return (
    chapter.startsWith("算術") ||
    chapter.startsWith("代數") ||
    chapter.startsWith("幾何") ||
    chapter.startsWith("機率") ||
    chapter.startsWith("數學")
  );
}

export function isScienceChapter(chapter: string): boolean {
  return (
    chapter.startsWith("物理") ||
    chapter.startsWith("化學") ||
    chapter.startsWith("生物") ||
    chapter.startsWith("地球") ||
    chapter.startsWith("自然")
  );
}

export function isCareerChapter(chapter: string): boolean {
  return (
    chapter.startsWith("職場") ||
    chapter.startsWith("履歷") ||
    chapter.startsWith("證照")
  );
}

export function chapterVendor(chapter: string): Vendor {
  if (isHuaweiChapter(chapter)) return "huawei";
  if (isLanguageChapter(chapter)) return "language";
  if (isMathChapter(chapter)) return "math";
  if (isScienceChapter(chapter)) return "science";
  if (isCareerChapter(chapter)) return "career";
  return "cisco";
}

export function questionVendor(question: Question): Vendor {
  return chapterVendor(question.chapter);
}

export function tryParseVendor(value: string | null | undefined): Vendor | null {
  if (
    value === "cisco" ||
    value === "huawei" ||
    value === "language" ||
    value === "math" ||
    value === "science" ||
    value === "career"
  ) {
    return value;
  }
  return null;
}

export function parseVendor(value: string | null | undefined): Vendor {
  return tryParseVendor(value) ?? "cisco";
}

export function getChaptersByVendor(vendor: Vendor, pool: { chapter: string }[]): string[] {
  return [...new Set(pool.filter((item) => chapterVendor(item.chapter) === vendor).map((item) => item.chapter))];
}

export function questionsByVendor<T extends { chapter: string }>(vendor: Vendor, pool: T[]): T[] {
  return pool.filter((item) => chapterVendor(item.chapter) === vendor);
}

export type VendorAccent = {
  btn: string;
  bar: string;
  text: string;
  pill: string;
  selected: string;
  hover: string;
  soft: string;
  option: string;
  wash: string;
  mark: string;
  nav: string;
  ghost: string;
  ring: string;
};

const ACCENTS: Record<Vendor, VendorAccent> = {
  cisco: {
    btn: "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
    bar: "bg-blue-600",
    text: "text-blue-700",
    pill: "bg-blue-50 text-blue-800",
    selected: "border-blue-600 bg-blue-50 text-blue-800 shadow-sm shadow-blue-600/10",
    hover: "hover:border-blue-300",
    soft: "bg-blue-50",
    option: "border-blue-600 bg-blue-50",
    wash: "from-blue-700 via-blue-600 to-indigo-500",
    mark: "bg-blue-600 text-white",
    nav: "bg-blue-600 text-white shadow-sm shadow-blue-600/25",
    ghost: "border-slate-200 hover:border-blue-300 hover:bg-blue-50",
    ring: "ring-blue-500/30",
  },
  huawei: {
    btn: "bg-red-600 hover:bg-red-700 active:bg-red-800",
    bar: "bg-red-600",
    text: "text-red-700",
    pill: "bg-red-50 text-red-800",
    selected: "border-red-600 bg-red-50 text-red-800 shadow-sm shadow-red-600/10",
    hover: "hover:border-red-300",
    soft: "bg-red-50",
    option: "border-red-600 bg-red-50",
    wash: "from-red-700 via-rose-600 to-orange-500",
    mark: "bg-red-600 text-white",
    nav: "bg-red-600 text-white shadow-sm shadow-red-600/25",
    ghost: "border-slate-200 hover:border-red-300 hover:bg-red-50",
    ring: "ring-red-500/30",
  },
  language: {
    btn: "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800",
    bar: "bg-emerald-600",
    text: "text-emerald-700",
    pill: "bg-emerald-50 text-emerald-800",
    selected: "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm shadow-emerald-600/10",
    hover: "hover:border-emerald-300",
    soft: "bg-emerald-50",
    option: "border-emerald-600 bg-emerald-50",
    wash: "from-emerald-700 via-emerald-600 to-teal-500",
    mark: "bg-emerald-600 text-white",
    nav: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/25",
    ghost: "border-slate-200 hover:border-emerald-300 hover:bg-emerald-50",
    ring: "ring-emerald-500/30",
  },
  math: {
    btn: "bg-amber-600 hover:bg-amber-700 active:bg-amber-800",
    bar: "bg-amber-600",
    text: "text-amber-800",
    pill: "bg-amber-50 text-amber-900",
    selected: "border-amber-600 bg-amber-50 text-amber-900 shadow-sm shadow-amber-600/10",
    hover: "hover:border-amber-300",
    soft: "bg-amber-50",
    option: "border-amber-600 bg-amber-50",
    wash: "from-amber-600 via-orange-500 to-yellow-500",
    mark: "bg-amber-600 text-white",
    nav: "bg-amber-600 text-white shadow-sm shadow-amber-600/25",
    ghost: "border-slate-200 hover:border-amber-300 hover:bg-amber-50",
    ring: "ring-amber-500/30",
  },
  science: {
    btn: "bg-violet-600 hover:bg-violet-700 active:bg-violet-800",
    bar: "bg-violet-600",
    text: "text-violet-800",
    pill: "bg-violet-50 text-violet-900",
    selected: "border-violet-600 bg-violet-50 text-violet-900 shadow-sm shadow-violet-600/10",
    hover: "hover:border-violet-300",
    soft: "bg-violet-50",
    option: "border-violet-600 bg-violet-50",
    wash: "from-violet-700 via-purple-600 to-fuchsia-500",
    mark: "bg-violet-600 text-white",
    nav: "bg-violet-600 text-white shadow-sm shadow-violet-600/25",
    ghost: "border-slate-200 hover:border-violet-300 hover:bg-violet-50",
    ring: "ring-violet-500/30",
  },
  career: {
    btn: "bg-teal-600 hover:bg-teal-700 active:bg-teal-800",
    bar: "bg-teal-600",
    text: "text-teal-800",
    pill: "bg-teal-50 text-teal-900",
    selected: "border-teal-600 bg-teal-50 text-teal-900 shadow-sm shadow-teal-600/10",
    hover: "hover:border-teal-300",
    soft: "bg-teal-50",
    option: "border-teal-600 bg-teal-50",
    wash: "from-teal-700 via-teal-600 to-cyan-500",
    mark: "bg-teal-600 text-white",
    nav: "bg-teal-600 text-white shadow-sm shadow-teal-600/25",
    ghost: "border-slate-200 hover:border-teal-300 hover:bg-teal-50",
    ring: "ring-teal-500/30",
  },
};

export function vendorAccent(vendor: Vendor): VendorAccent {
  return ACCENTS[vendor];
}

export function allChapterLabel(vendor: Vendor): string {
  if (vendor === "huawei") return "華為 · 全部";
  if (vendor === "language") return "語言 · 全部";
  if (vendor === "math") return "數學 · 全部";
  if (vendor === "science") return "自然科學 · 全部";
  if (vendor === "career") return "職場與證照 · 全部";
  return "Cisco · 全部";
}

/** Stay on the current page when switching banks; lab detail pages fall back to the list. */
export function vendorPageHref(pathname: string, search: string, vendor: Vendor): string {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const params = new URLSearchParams(query);
  params.set("vendor", vendor);
  const path = /^\/lab\/.+/.test(pathname) ? "/lab" : pathname;
  return `${path}?${params.toString()}`;
}

export function hasDrillModes(vendor: Vendor): boolean {
  return (
    vendor === "language" ||
    vendor === "math" ||
    vendor === "science" ||
    vendor === "career" ||
    vendor === "cisco" ||
    vendor === "huawei"
  );
}
