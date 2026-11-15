import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { AppShell } from "@/components/AppShell";
import { PendingFlush } from "@/components/PendingFlush";
import { PwaRegister } from "@/components/PwaRegister";
import { VendorProvider } from "@/lib/useResolvedVendor";
import { VENDOR_COOKIE } from "@/lib/storage";
import { tryParseVendor } from "@/lib/vendor";
import "./globals.css";

export const metadata: Metadata = {
  title: "題庫刷題",
  description: "計算機、語言、數學、自然科學與職場證照刷題",
  applicationName: "題庫刷題",
  appleWebApp: {
    capable: true,
    title: "題庫",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00686b" },
    { media: "(prefers-color-scheme: dark)", color: "#0c1f20" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
};

const themeBoot = `(function(){try{var t=localStorage.getItem("quiz-bank:theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");var v=localStorage.getItem("quiz-bank:vendor");if(v)document.documentElement.dataset.vendor=v;}catch(e){}})();`;

const fullNavBoot = `(function(){function el(e){var t=e.target;if(t&&t.nodeType===3)t=t.parentNode;return t&&t.closest?t:null;}function jump(url){window.location.href=url;}function formUrl(f){var qs=new URLSearchParams(new FormData(f)).toString();var url=f.getAttribute("action")||location.pathname;return qs?url+(url.indexOf("?")>=0?"&":"?")+qs:url;}function go(e){var t=el(e);if(!t)return;var a=t.closest("a[data-full-nav]");if(a&&a.href){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();jump(a.href);return;}var btn=t.closest("button[type=submit],button[data-full-nav]");if(!btn)return;var form=btn.form||(btn.getAttribute("form")&&document.getElementById(btn.getAttribute("form")));if(!form||!form.getAttribute("data-full-nav"))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();jump(formUrl(form));}function send(e){var f=e.target;if(!f||f.tagName!=="FORM"||!f.getAttribute("data-full-nav"))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();jump(formUrl(f));}document.addEventListener("pointerdown",go,true);document.addEventListener("click",go,true);document.addEventListener("submit",send,true);})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  const vendor = tryParseVendor(jar.get(VENDOR_COOKIE)?.value);

  return (
    <html lang="zh-Hant" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <script dangerouslySetInnerHTML={{ __html: fullNavBoot }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+TC:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <VendorProvider initialVendor={vendor}>
          <AppShell>{children}</AppShell>
          <PendingFlush />
        </VendorProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
