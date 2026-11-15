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
        desc="本頁只描述目前產品實際行為。最後更新：2026-11-15（待批改佇列；原生包不含正解）。"
      />

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">摘要</h2>
        <p>
          「題庫刷題」是網頁／PWA 練習工具，並可打包為本機原生殼（例如 iOS Capacitor）。目前<strong>沒有登入或帳戶</strong>、<strong>沒有付款</strong>、
          <strong>沒有分析或廣告 SDK</strong>，也<strong>沒有伺服器端個人帳號資料庫</strong>。作答進度預設只存在你這個裝置／瀏覽器。
          正解與解析<strong>不會</strong>打包進網站靜態檔或原生 App 資源；批改只在連線時由伺服端完成。
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
          <li>離線「待批改」佇列（作答暫存；連線後送交批改）</li>
          <li>趣味小知識進度；部分提示會暫存於 sessionStorage</li>
        </ul>
        <p>
          另會以 Cookie <code className="qb-mono text-xs">quiz-bank-vendor</code> 記住題庫偏好（非身分識別、非追蹤 Cookie）。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">連線時送出的內容（網站）</h2>
        <p>
          在一般網站使用時，抽題與批改會呼叫本站 API（例如 <code className="qb-mono text-xs">/api/quiz</code>、
          <code className="qb-mono text-xs">/api/grade</code>）。請求會帶上題目識別與你選的答案，以便伺服端批改；
          網站端回傳的題目會去掉正解與解析。這些請求<strong>不綁登入帳號</strong>。批改結果會寫回你瀏覽器的本機進度。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">離線作答與待批改</h2>
        <p>
          離線時可繼續閱讀<strong>先前已快取的公開題幹</strong>（不含正解），並把作答暫存於本機「待批改」佇列。
          這些暫存<strong>不會</strong>計入對錯或統計，介面會標示待批改／未評分。重新連線後會自動（或手動）送交伺服端批改；
          同一筆暫存以客戶端識別避免重複記分。
        </p>
        <p>
          原生殼載入本機 UI 資源，連線批改時會呼叫設定的網站 API（非把整個 App 做成遠端薄殼）。
          口說題的麥克風語音辨識在離線時可能不可用。
        </p>
      </section>

      <section className="space-y-3 text-sm leading-relaxed text-slate-700">
        <h2 className="text-base font-semibold text-slate-900">抓題／批改限制（如實說明）</h2>
        <p>
          伺服端對抓題與批改設有每連線粗略的批量與頻率上限，用以降低自動化大量請求。目前<strong>沒有登入</strong>，
          限制主要存在於單一伺服程序記憶體，<strong>不是</strong>跨機房／跨實例的強固防爬方案；重啟或分散部署後效果有限。
          手動或自動化蒐集題幹仍無法完全防止。
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
