import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "隱私政策 · 題庫刷題",
  description: "題庫刷題如何處理本機資料與可選瀏覽器權限",
};

export default function PrivacyPage() {
  return (
    <div className="space-y-8 qb-in">
      <PageHeader
        title="隱私政策"
        desc="本頁只描述目前產品實際行為。最後更新：2026-11-14。"
      />

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">摘要</h2>
        <p>
          「題庫刷題」是網頁／PWA 練習工具。目前<strong>沒有登入或帳戶</strong>、<strong>沒有付款</strong>、
          <strong>沒有分析或廣告 SDK</strong>，也<strong>沒有伺服器端個人帳號資料庫</strong>。作答進度預設只存在你這個瀏覽器。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">本機儲存</h2>
        <p>應用程式會在你的裝置上使用瀏覽器儲存，前綴為 <code className="qb-mono text-xs">quiz-bank:</code>，例如：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>作答紀錄、模考歷史、實驗完成、收藏與筆記</li>
          <li>練習／模考進行中場次、每日目標、主題（淺色／深色）</li>
          <li>上次選的題庫、安裝提示是否隱藏、回來刷提醒偏好</li>
          <li>題目目錄快取（方便再次開啟時少打一點 API）</li>
          <li>趣味小知識進度；部分提示會暫存於 sessionStorage</li>
        </ul>
        <p>
          另會以 Cookie <code className="qb-mono text-xs">quiz-bank-vendor</code> 記住題庫偏好（非身分識別、非追蹤 Cookie）。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">連線時送出的內容</h2>
        <p>
          抽題與批改會呼叫本站 API（例如 <code className="qb-mono text-xs">/api/quiz</code>、
          <code className="qb-mono text-xs">/api/grade</code>）。請求會帶上題目識別與你選的答案，以便伺服端批改；
          這些請求<strong>不綁登入帳號</strong>。批改結果會寫回你瀏覽器的本機進度。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">可選權限</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>通知：</strong>若你在統計頁開啟「回來刷提醒」並允許通知，瀏覽器可能在該分頁仍開啟時顯示本地提醒。
            目前<strong>沒有伺服器推播</strong>。
          </li>
          <li>
            <strong>麥克風：</strong>僅在口說練習使用瀏覽器語音辨識時需要。語音由瀏覽器／系統處理；本應用不會另外把錄音上傳到自有伺服器。
          </li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">第三方服務</h2>
        <p>
          頁面會向 Google Fonts（fonts.googleapis.com／fonts.gstatic.com）載入字型。這是版面顯示用途，不是廣告或分析 SDK。
          字型請求會依 Google 的網路與隱私實務處理；本應用未另外嵌入其他追蹤程式碼。
        </p>
        <p>網站若託管於 Vercel，連線時會經過其基礎設施；託管商可能依其政策留下技術日誌（例如 IP、User-Agent），本應用未另行收集個人檔案。</p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">匯出、清除與瀏覽器控制</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            在{" "}
            <Link href="/stats" data-full-nav className="font-medium text-slate-900 underline underline-offset-2">
              統計
            </Link>{" "}
            可「匯出 JSON」備份進度，或以檔案匯入合併／覆蓋。
          </li>
          <li>
            同一頁可按「清除全部本機資料」並確認後，刪除這個瀏覽器內所有 <code className="qb-mono text-xs">quiz-bank:</code>{" "}
            本機鍵與 vendor cookie。清除後無法復原，除非你另有備份檔。
          </li>
          <li>你也可在瀏覽器設定清除網站資料、封鎖通知或撤銷麥克風權限。</li>
        </ul>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">兒童與其他</h2>
        <p>本服務不以收集兒童個人資料為目的；亦無帳戶系統可供刪除伺服器端帳號。若產品日後加入登入、付款或分析，會先更新本頁。</p>
      </section>

      <p className="text-sm text-slate-500">
        需要協助請見{" "}
        <Link href="/support" data-full-nav className="underline underline-offset-2">
          支援
        </Link>
        。
      </p>
    </div>
  );
}
