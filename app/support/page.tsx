import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "支援 · 題庫刷題",
  description: "題庫刷題功能說明與常見問題",
};

export default function SupportPage() {
  return (
    <div className="space-y-8 qb-in">
      <PageHeader title="支援" desc="本頁說明產品現況與常見操作。最後更新：2026-11-14。" />

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">這個應用做什麼</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>多題庫練習（計算機、華為、語言、數學、自然、職場等）</li>
          <li>計時模考與結果回顧</li>
          <li>錯題複習（間隔複習）、收藏與筆記</li>
          <li>Cisco IOS／華為 VRP 風格 CLI 實驗（網頁模擬）</li>
          <li>統計、熱力圖與本機進度備份</li>
          <li>可選擇加入主畫面（PWA）；已開過的頁面可有限度離線瀏覽，批改需連線</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">聯絡方式</h2>
        <p>
          倉庫內目前<strong>沒有</strong>已公布的專用支援電郵或電話。正式聯絡方式將由擁有者確認後補上。
        </p>
        <p>
          暫時可在公開 GitHub 倉庫提出 Issue（僅適合公開、不含私隱敏感內容的回報）：{" "}
          <a
            href="https://github.com/yun3336/quiz-bank/issues"
            className="font-medium text-slate-900 underline underline-offset-2"
            rel="noopener noreferrer"
            target="_blank"
          >
            github.com/yun3336/quiz-bank/issues
          </a>
          。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">常見問題</h2>
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-slate-900">進度不見了？</h3>
            <p>
              進度存在這個瀏覽器。換裝置、無痕模式或清除網站資料會令紀錄消失。請先到{" "}
              <Link href="/stats" data-full-nav className="underline underline-offset-2">
                統計
              </Link>{" "}
              匯出 JSON 備份。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">如何刪除本機資料？</h3>
            <p>
              統計頁「清除全部本機資料」（需確認），或瀏覽器設定清除本站資料。詳見{" "}
              <Link href="/privacy" data-full-nav className="underline underline-offset-2">
                隱私政策
              </Link>
              。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">離線顯示「需連線批改」？</h3>
            <p>題幹或可離線作答，但批改必須連線呼叫伺服端。連線後再提交即可。</p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">提醒沒有響？</h3>
            <p>
              回來刷提醒依賴瀏覽器通知，且目前需要相關分頁保持開啟；並非伺服器推播。請確認已允許通知，並在統計頁開啟提醒。
            </p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">口說無法錄音？</h3>
            <p>需瀏覽器支援語音辨識並允許麥克風。亦可手動輸入朗讀內容交卷。</p>
          </div>
          <div>
            <h3 className="font-medium text-slate-900">有帳戶或付費嗎？</h3>
            <p>目前沒有登入、帳戶或應用內付款。</p>
          </div>
        </div>
      </section>

      <p className="text-sm text-slate-500">
        <Link href="/privacy" data-full-nav className="underline underline-offset-2">
          隱私政策
        </Link>
        {" · "}
        <Link href="/" data-full-nav className="underline underline-offset-2">
          回首頁
        </Link>
      </p>
    </div>
  );
}
