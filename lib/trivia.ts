import type { Vendor } from "./vendor";

export interface Trivia {
  id: string;
  vendor: Vendor | "any";
  title: string;
  body: string;
  claim: string;
  truth: boolean;
}

export interface TriviaSave {
  seenIds: string[];
  correct: number;
  answered: number;
  streak: number;
  bestStreak: number;
}

const TRIVIA_SAVE_KEY = "quiz-bank:trivia";

export const TRIVIA: Trivia[] = [
  {
    id: "net-ping",
    vendor: "cisco",
    title: "Ping 這個名字從哪來？",
    claim: "網路 ping 的名字，來自聲納探測那一聲回音。",
    truth: true,
    body: "聲納探測會發出「ping」一聲再聽回音。網路 ping 也是丟一顆探測包，等對端回你，用來估延遲與是否通。",
  },
  {
    id: "net-vlan1",
    vendor: "cisco",
    title: "VLAN 1 為什麼常被勸少用？",
    claim: "教材常建議把工作和管理流量都擠在 VLAN 1。",
    truth: false,
    body: "很多交換器出廠就把管理與未劃分的埠放在 VLAN 1。工作流量若也擠在這裡，一旦被掃到，影響面比較大。教材常建議另開管理 VLAN。",
  },
  {
    id: "net-mac",
    vendor: "cisco",
    title: "MAC 位址前半段在說什麼？",
    claim: "MAC 前半段是廠商代號，有時能猜這張網卡哪家出的。",
    truth: true,
    body: "48 位元裡，前面約 24 位是廠商代號（OUI）。所以看前幾碼，有時能猜這張網卡大概是哪家出的。",
  },
  {
    id: "net-rj45",
    vendor: "cisco",
    title: "八芯網路線，百兆只用一半？",
    claim: "常見 RJ-45 有八芯，百兆乙太網路會把八根都用上。",
    truth: false,
    body: "常見 RJ-45 有 8 根銅線。100 Mbps 通常只靠其中 4 根傳資料；千兆才把 8 根都用上。線序做錯，有時百兆能通、千兆卻不行。",
  },
  {
    id: "net-native",
    vendor: "cisco",
    title: "Trunk 上沒打標籤的訊框去哪？",
    claim: "Trunk 兩端 native VLAN 設不一樣，封包可能偷偷換 VLAN。",
    truth: true,
    body: "沒打標籤的訊框會被當成 native VLAN。兩端 native 設不一樣，封包可能「偷偷」換 VLAN，排查時特別容易踩雷。",
  },
  {
    id: "hw-undo",
    vendor: "huawei",
    title: "VRP 的 undo 像遙控器的反向鍵",
    claim: "華為 VRP 取消設定，主要是打 no。",
    truth: false,
    body: "Cisco 常用 no 取消設定；華為 VRP 多用 undo。同一件事：先進入那個檢視，再對指令做反向。",
  },
  {
    id: "hw-sysname",
    vendor: "huawei",
    title: "sysname 不是主機名稱的錯字",
    claim: "VRP 改提示字元上的設備名，指令是 hostname。",
    truth: false,
    body: "IOS 寫 hostname，VRP 寫 sysname，都是改提示字元上的設備名。LAB 裡打錯關鍵字會一直沒反應。",
  },
  {
    id: "hw-batch",
    vendor: "huawei",
    title: "一次建一串 VLAN",
    claim: "vlan batch 10 20 30 可以一口氣建立多個 VLAN。",
    truth: true,
    body: "vlan batch 10 20 30 可以一口氣建立多個 VLAN。IOS 比較常進出 vlan 資料庫逐個 name。",
  },
  {
    id: "hw-filter",
    vendor: "huawei",
    title: "ACL 寫了還不會自己生效",
    claim: "華為只要建好 ACL，流量就會自動被過濾。",
    truth: false,
    body: "清單只是規則本。華為還要把 traffic-filter 套到介面方向，流量才會被過濾。只建 acl 卻忘了套，是常見漏步驟。",
  },
  {
    id: "hw-area0",
    vendor: "huawei",
    title: "OSPF 的 area 0 像廣場",
    claim: "多區域 OSPF 時，其他區域通常要能連到骨幹 area 0。",
    truth: true,
    body: "多區域時，其他區域通常要能連到骨幹 area 0，路由才走得通。單區域練習也常直接宣告在 area 0。",
  },
  {
    id: "lang-e",
    vendor: "language",
    title: "英文最常見的字母",
    claim: "一般英文文章裡，最常出現的字母是 t。",
    truth: false,
    body: "一般英文文章裡，e 出現的次數通常最多。以前有人靠字母頻率破解簡單替換密碼。",
  },
  {
    id: "lang-arigato",
    vendor: "language",
    title: "ありがとう 的字面味道",
    claim: "ありがとう 的語感，接近「難得、不容易有」。",
    truth: true,
    body: "可以想到「有り難い」：難得、不容易有。謝謝的感覺，有一點「這份心意不常見」。",
  },
  {
    id: "lang-hangul",
    vendor: "language",
    title: "韓文看字就能念？",
    claim: "學會韓文字母後，路牌往往可以先念出來再記意思。",
    truth: true,
    body: "한글 是表音文字：子音＋母音拼成音節塊。學會字母後，路牌往往可以先念出來，再慢慢記意思。",
  },
  {
    id: "lang-coffee",
    vendor: "language",
    title: "咖啡是一路借過來的詞",
    claim: "很多語言的「咖啡」聽起來都像同源借詞。",
    truth: true,
    body: "許多語言的「咖啡」聽起來都像 coffee／café／コーヒー／커피。詞跟著豆子一起旅行。",
  },
  {
    id: "lang-an",
    vendor: "language",
    title: "an 看的是聲音不是字母",
    claim: "選 a 或 an，只要看下一個單詞的第一個字母。",
    truth: false,
    body: "honest 的 h 不發音，所以說 an honest man。university 的 u 唸「yu」，反而用 a。用耳朵選冠詞比較穩。",
  },
  {
    id: "math-zero",
    vendor: "math",
    title: "0 讓進位變簡單",
    claim: "有「零」當占位，10 和 100 才分得清楚。",
    truth: true,
    body: "有「零」當占位，10 和 100 才分得清楚。沒有占位時，光看幾個符號很難表達「空的那一位」。",
  },
  {
    id: "math-pi",
    vendor: "math",
    title: "圓周率不是循環小數",
    claim: "π 是循環小數，算到後面就會開始重複。",
    truth: false,
    body: "π 的小數不會週期反覆。3.14 只是好用的近似；算越後面，數字仍不會開始循環。",
  },
  {
    id: "math-coin",
    vendor: "math",
    title: "丟兩次銅板，至少一正有多常？",
    claim: "丟兩次公正銅板，至少出現一次正面的機率是 1/2。",
    truth: false,
    body: "四種同樣可能：正正、正反、反正、反反。至少一正占三格，所以是 3/4，不是 1/2。",
  },
  {
    id: "math-percent",
    vendor: "math",
    title: "打七五折不是減 75 元",
    claim: "400 元打七五折，應付 325 元。",
    truth: false,
    body: "七五折是付原價的 75%，也就是打掉 25%。400 元打七五折是 300，不是 325。",
  },
  {
    id: "sci-thunder",
    vendor: "science",
    title: "為什麼先閃電後打雷？",
    claim: "先看到閃電再聽到雷，是因為光比聲音快太多。",
    truth: true,
    body: "光跑得比聲音快太多。閃電幾乎立刻看到，雷聲要過一段時間才到。數秒差，可粗估雷雨有多遠。",
  },
  {
    id: "sci-tomato",
    vendor: "science",
    title: "番茄在植物學上是果實",
    claim: "番茄在植物學上被歸類為蔬菜。",
    truth: false,
    body: "它由子房發育、裡面有種子，符合果實的定義。廚房裡當蔬菜用，是料理習慣，不是植物分類。",
  },
  {
    id: "sci-g",
    vendor: "science",
    title: "9.8 這個數字從哪來？",
    claim: "近地表的 g 大約 9.8，換星球或登高山就會不一樣。",
    truth: true,
    body: "近地表自由落體，速度每秒大約增加 9.8 公尺／秒。登高山或換星球，這個 g 會不一樣。",
  },
  {
    id: "sci-o2",
    vendor: "science",
    title: "光合作用「順便」產氧",
    claim: "光合作用釋出的氧氣，主要來自把水拆開。",
    truth: true,
    body: "植物用光把水拆開，氧氣是這個過程釋出的。我們呼吸用到的 O₂，很多就來自這條路徑。",
  },
  {
    id: "sci-plates",
    vendor: "science",
    title: "地震愛待在板塊交界",
    claim: "地震比較常發生在板塊內部的穩定區。",
    truth: false,
    body: "板塊互相推、拉、錯動的地方，能量容易一口氣放出來。所以島弧、海溝附近常常既有地震也有火山。",
  },
  {
    id: "car-star",
    vendor: "career",
    title: "面試故事可以用 STAR 收斂",
    claim: "STAR 指的是情境、任務、行動、結果。",
    truth: true,
    body: "情境、任務、行動、結果。對方要聽的是你做了什麼、帶來什麼，不是把職稱念一遍。",
  },
  {
    id: "car-resume",
    vendor: "career",
    title: "履歷不是越長越厲害",
    claim: "履歷頁數越多，越能證明你很資深。",
    truth: false,
    body: "新人常一頁就夠；資深也少見把十年流水帳全貼上。對準職缺、用數字說成果，比頁數更有用。",
  },
  {
    id: "car-cert",
    vendor: "career",
    title: "證照不是錄取保單",
    claim: "拿到證照，幾乎就等於錄取保證。",
    truth: false,
    body: "它證明你通過該測驗範圍。錄取還看經驗、作品與臨場。把它當能力證明，比較不容易失望。",
  },
  {
    id: "car-secret",
    vendor: "career",
    title: "客戶名單不是「方便備份」",
    claim: "把客戶名單傳到私人雲端備份，通常沒問題。",
    truth: false,
    body: "未公開名單常屬營業機密或個資。傳到私人雲端，即使出於好心，也可能違反公司規定。",
  },
  {
    id: "any-cache",
    vendor: "any",
    title: "這份進度存在哪？",
    claim: "作答與收藏存在這個瀏覽器的本機，換裝置不會自動跟著走。",
    truth: true,
    body: "作答與收藏在這個瀏覽器的本機儲存。換電腦或清資料會不見，統計頁可以匯出備份。",
  },
  {
    id: "any-lab",
    vendor: "any",
    title: "選擇題會配，指令要手打",
    claim: "網路設定只要會選選擇題就夠，不必碰實驗頁的 CLI。",
    truth: false,
    body: "VLAN、ACL、OSPF 的觀念可以刷題；真正改 hostname、劃埠、宣告網段，請到實驗頁用模擬 CLI。",
  },
];

function emptySave(): TriviaSave {
  return { seenIds: [], correct: 0, answered: 0, streak: 0, bestStreak: 0 };
}

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function loadTriviaSave(): TriviaSave {
  if (!canUseStorage()) return emptySave();
  try {
    const raw = localStorage.getItem(TRIVIA_SAVE_KEY);
    if (!raw) return emptySave();
    const parsed = JSON.parse(raw) as Partial<TriviaSave>;
    const seenIds = Array.isArray(parsed.seenIds) ? parsed.seenIds.filter((id) => typeof id === "string") : [];
    const correct = typeof parsed.correct === "number" ? parsed.correct : 0;
    const answered = typeof parsed.answered === "number" ? parsed.answered : 0;
    const streak = typeof parsed.streak === "number" ? parsed.streak : 0;
    const bestStreak = typeof parsed.bestStreak === "number" ? parsed.bestStreak : 0;
    return { seenIds, correct, answered, streak, bestStreak };
  } catch {
    return emptySave();
  }
}

function saveTriviaSave(save: TriviaSave): void {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(TRIVIA_SAVE_KEY, JSON.stringify(save));
  } catch {
    /* 私人模式或配額滿時仍可當場玩 */
  }
}

export function recordTriviaAnswer(id: string, correct: boolean): TriviaSave {
  const save = loadTriviaSave();
  if (!save.seenIds.includes(id)) save.seenIds.push(id);
  save.answered += 1;
  if (correct) {
    save.correct += 1;
    save.streak += 1;
    save.bestStreak = Math.max(save.bestStreak, save.streak);
  } else {
    save.streak = 0;
  }
  try {
    saveTriviaSave(save);
  } catch {
    /* 揭曉不依賴寫入 */
  }
  return save;
}

export function getTrivia(id: string | undefined | null): Trivia | undefined {
  if (!id) return undefined;
  return TRIVIA.find((item) => item.id === id);
}

export function parseTriviaGuess(value: string | undefined | null): boolean | null {
  if (value === "1") return true;
  if (value === "0") return false;
  return null;
}

export function triviaPlayHref(opts: {
  tid?: string;
  guess?: boolean | null;
  vendor?: Vendor | "all";
  skip?: string;
}): string {
  const params = new URLSearchParams();
  if (opts.tid) params.set("tid", opts.tid);
  if (opts.guess === true) params.set("guess", "1");
  if (opts.guess === false) params.set("guess", "0");
  if (opts.vendor && opts.vendor !== "all") params.set("v", opts.vendor);
  if (opts.skip) params.set("skip", opts.skip);
  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function triviaPool(vendor?: Vendor): Trivia[] {
  return vendor ? TRIVIA.filter((item) => item.vendor === vendor || item.vendor === "any") : TRIVIA;
}

export function pickTrivia(vendor?: Vendor, excludeId?: string): Trivia {
  const pool = triviaPool(vendor);
  const seen = new Set(loadTriviaSave().seenIds);
  const unseen = pool.filter((item) => item.id !== excludeId && !seen.has(item.id));
  const rest = pool.filter((item) => item.id !== excludeId);
  const list = unseen.length > 0 ? unseen : rest.length > 0 ? rest : pool;
  return list[Math.floor(Math.random() * list.length)] ?? TRIVIA[0];
}
