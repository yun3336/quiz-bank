"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { VendorMark } from "@/components/ui";
import { saveLastVendor } from "@/lib/storage";
import { VENDORS, VENDOR_META, vendorAccent, vendorPageHref, type Vendor } from "@/lib/vendor";

export function VendorBar({ vendor }: { vendor: Vendor }) {
  const router = useRouter();
  const pathname = usePathname();
  const accent = vendorAccent(vendor);

  function switchVendor(next: Vendor) {
    if (next === vendor) return;
    saveLastVendor(next);
    const search = typeof window === "undefined" ? "" : window.location.search;
    router.replace(vendorPageHref(pathname, search, next));
  }

  return (
    <div className="qb-group">
      <label className="qb-row">
        <VendorMark vendor={vendor} className="h-8 w-8 rounded-lg" />
        <span className="text-sm text-slate-500">題庫</span>
        <select
          value={vendor}
          onChange={(event) => switchVendor(event.target.value as Vendor)}
          className={`qb-row-value cursor-pointer ${accent.text}`}
          aria-label="切換題庫"
          name="vendor"
          autoComplete="off"
        >
          {VENDORS.map((item) => (
            <option key={item} value={item}>
              {VENDOR_META[item].label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

export function NeedVendor() {
  return (
    <div className="qb-card mx-auto max-w-md px-6 py-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--qb-navy)] text-white">
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M5 7h14v12H5z" />
          <path d="M9 7V5h6v2" />
        </svg>
      </div>
      <p className="text-lg font-semibold text-slate-900">請先選擇題庫</p>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Cisco、華為、語言、數學、自然或職場證照，在首頁選一次即可，裡面不會再問。
      </p>
      <Link href="/" className="mt-6 inline-block rounded-2xl bg-[var(--qb-navy)] px-5 py-3 text-sm font-extrabold text-white qb-press">
        回首頁選題庫
      </Link>
    </div>
  );
}
