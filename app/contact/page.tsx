import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "回報問題｜題庫刷題",
  description: "回報 Bug、提出建議，或其他意見回饋",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const endpoint = process.env.PUBLIC_FEEDBACK_ENDPOINT?.trim() || undefined;

  return (
    <div className="space-y-6 qb-in">
      <PageHeader
        title="回報問題"
        desc="遇到錯誤、有功能建議，或想留下其他意見，歡迎在此告訴我們。表單會送到公開聯絡信箱；如需更改收件地址，可於部署環境調整。"
      />
      <ContactForm endpoint={endpoint} />
      {!endpoint ? (
        <p className="text-xs leading-relaxed text-slate-400">
          目前使用 FormSubmit 轉寄。首次送出時，收件信箱會收到 FormSubmit
          確認電郵，必須先完成確認，之後的回報才會正常到達。
        </p>
      ) : null}
    </div>
  );
}
