import type { Question } from "./types";
import { normalizeAnswer, revealAnswer } from "./grade";
import type { DifficultyFilter } from "./questions";
import type { Vendor } from "./vendor";

export type { DifficultyFilter };

export type LanguagePracticeMode =
  | "mixed"
  | "choice"
  | "cloze"
  | "flash"
  | "match"
  | "listen"
  | "speed"
  | "translate"
  | "dictation"
  | "reading"
  | "hotspot"
  | "speak"
  | "audio";

export type DrillModeInfo = {
  id: LanguagePracticeMode;
  label: string;
  blurb: string;
};

export const LANGUAGE_MODES: DrillModeInfo[] = [
  { id: "choice", label: "選擇題", blurb: "看選項作答，打好基礎" },
  { id: "cloze", label: "填空默寫", blurb: "不看選項，自己打出答案" },
  { id: "flash", label: "閃卡", blurb: "先想再翻，測記得與否" },
  { id: "match", label: "配對", blurb: "題幹與答案連一連" },
  { id: "listen", label: "聽力", blurb: "朗讀題幹後再作答" },
  { id: "speed", label: "速答", blurb: "每題 12 秒，練反應" },
  { id: "translate", label: "翻譯", blurb: "中→英、英→日，別名表批改" },
  { id: "dictation", label: "聽寫", blurb: "聽完打出原文" },
  { id: "reading", label: "閱讀", blurb: "短文帶 2～4 題，整組出題" },
  { id: "hotspot", label: "看圖", blurb: "在圖上點選正確位置" },
  { id: "speak", label: "口說", blurb: "朗讀句子，瀏覽器辨識（不穩）" },
  { id: "audio", label: "錄音聽力", blurb: "播放錄音檔後作答" },
];

export const SPEED_SECONDS = 12;
export const MATCH_MAX = 8;

const LANGUAGE_ONLY_MODES: LanguagePracticeMode[] = [
  "listen",
  "translate",
  "dictation",
  "reading",
  "speak",
  "audio",
];

const NETWORK_MODES: DrillModeInfo[] = [
  { id: "mixed", label: "綜合", blurb: "選擇、填空、排序、看圖混出" },
  { id: "hotspot", label: "看圖", blurb: "在圖上點選正確位置" },
];

export interface DrillModeGroup {
  id: string;
  label: string;
  hint: string;
  modes: DrillModeInfo[];
}

const MODE_GROUP_DEFS: { id: string; label: string; hint: string; ids: LanguagePracticeMode[] }[] = [
  { id: "basics", label: "基礎", hint: "認、記、寫", ids: ["choice", "cloze", "flash", "match"] },
  { id: "listenSpeak", label: "聽說", hint: "聽與說", ids: ["listen", "dictation", "audio", "speak"] },
  { id: "apply", label: "進階", hint: "活用與限時", ids: ["translate", "reading", "hotspot", "speed"] },
  { id: "network", label: "練習方法", hint: "綜合出題或單練看圖", ids: ["mixed", "hotspot"] },
];

export function drillModesFor(vendor: string): DrillModeInfo[] {
  if (vendor === "cisco" || vendor === "huawei") return NETWORK_MODES;
  if (vendor === "science") {
    return LANGUAGE_MODES.filter(
      (mode) => !LANGUAGE_ONLY_MODES.includes(mode.id) || mode.id === "hotspot",
    );
  }
  if (vendor === "math" || vendor === "career") {
    return LANGUAGE_MODES.filter(
      (mode) => !LANGUAGE_ONLY_MODES.includes(mode.id) && mode.id !== "hotspot",
    );
  }
  if (vendor === "language") return LANGUAGE_MODES;
  return [];
}

export function groupedDrillModes(vendor: string): DrillModeGroup[] {
  const available = drillModesFor(vendor);
  const byId = new Map(available.map((mode) => [mode.id, mode]));
  const defs =
    vendor === "cisco" || vendor === "huawei"
      ? MODE_GROUP_DEFS.filter((group) => group.id === "network")
      : MODE_GROUP_DEFS.filter((group) => group.id !== "network");

  return defs
    .map((group) => ({
      id: group.id,
      label: group.label,
      hint: group.hint,
      modes: group.ids.map((id) => byId.get(id)).filter((mode): mode is DrillModeInfo => Boolean(mode)),
    }))
    .filter((group) => group.modes.length > 0);
}

export function defaultDrillMode(vendor: Vendor): LanguagePracticeMode {
  if (vendor === "cisco" || vendor === "huawei") return "mixed";
  return "choice";
}

export function languageModeLabel(mode: LanguagePracticeMode): string {
  return (
    LANGUAGE_MODES.find((item) => item.id === mode)?.label ??
    NETWORK_MODES.find((item) => item.id === mode)?.label ??
    "練習"
  );
}

export function correctTexts(question: Question): string[] {
  if (question.options && question.answer) {
    return question.answer
      .map((id) => question.options?.find((option) => option.id === id)?.text ?? "")
      .filter(Boolean);
  }
  const revealed = revealAnswer(question);
  return revealed ? [revealed] : [];
}

export { normalizeAnswer, revealAnswer };

export function gradeCloze(question: Question, typed: string): boolean {
  const expected = correctTexts(question).map((item) => normalizeAnswer(item)).filter(Boolean);
  const input = normalizeAnswer(typed);
  if (!input || expected.length === 0) return false;

  if (question.type === "multiple") {
    const parts = input.split(/[,，、/;／]+/).map((item) => normalizeAnswer(item)).filter(Boolean);
    if (parts.length !== expected.length) return false;
    return expected.every((item) => parts.includes(item));
  }

  const aliases = [...expected, ...(question.answer ?? []).map((id) => normalizeAnswer(id))];
  return aliases.some((item) => item === input);
}

export function speakLang(stem: string, chapter: string, explicit?: string): string {
  if (explicit) return explicit;
  const letters = (stem.match(/[A-Za-z]/g) ?? []).length;
  const compact = stem.replace(/\s/g, "").length;
  if (compact > 0 && letters / compact > 0.45) return "en-US";
  if (chapter.startsWith("日語")) return "ja-JP";
  if (chapter.startsWith("韓語")) return "ko-KR";
  return "zh-TW";
}

export function speakText(text: string, lang: string): boolean {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  const prefix = lang.slice(0, 2).toLowerCase();
  const pickVoice = () =>
    window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(prefix));
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeaking(): void {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
};

function SpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const extra = window as Window & {
    SpeechRecognition?: new () => SpeechRec;
    webkitSpeechRecognition?: new () => SpeechRec;
  };
  return extra.SpeechRecognition ?? extra.webkitSpeechRecognition ?? null;
}

export function canRecognizeSpeech(): boolean {
  return Boolean(SpeechCtor());
}

export function startSpeechRecognition(
  lang: string,
  onResult: (text: string) => void,
  onError: (message: string) => void,
  onEnd: () => void,
): () => void {
  const Ctor = SpeechCtor();
  if (!Ctor) {
    onError("此瀏覽器不支援語音辨識");
    onEnd();
    return () => undefined;
  }
  const rec = new Ctor();
  rec.lang = lang;
  rec.interimResults = false;
  rec.maxAlternatives = 3;
  rec.onresult = (event) => {
    const first = event.results[0]?.[0]?.transcript ?? "";
    onResult(first.trim());
  };
  rec.onerror = (event) => {
    if (event.error === "no-speech") onError("沒有聽到聲音，請再試一次");
    else if (event.error === "not-allowed") onError("沒有麥克風權限");
    else onError("辨識失敗，請再試或改打出你說的內容");
  };
  rec.onend = onEnd;
  rec.start();
  return () => rec.abort();
}
