import { VENDORS, VENDOR_META, type Vendor } from "./vendor";

export function filterHomeVendors(query: string): Vendor[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return VENDORS;
  return VENDORS.filter((vendor) => {
    const meta = VENDOR_META[vendor];
    return `${meta.label} ${meta.subtitle} ${meta.short}`.toLowerCase().includes(needle);
  });
}

export type HomeQuery = {
  tid?: string;
  guess?: string;
  v?: string;
  skip?: string;
  search?: string;
  q?: string;
};

export function homeHref(
  base: HomeQuery,
  opts?: { search?: boolean; q?: string; hash?: string },
): string {
  const params = new URLSearchParams();
  if (base.tid) params.set("tid", base.tid);
  if (base.guess === "1" || base.guess === "0") params.set("guess", base.guess);
  if (base.v) params.set("v", base.v);
  if (base.skip) params.set("skip", base.skip);

  const open = opts?.search ?? (base.search === "1" || Boolean(base.q?.trim()));
  const q = opts && "q" in opts ? opts.q : base.q;
  if (open) params.set("search", "1");
  if (open && q?.trim()) params.set("q", q.trim());

  const qs = params.toString();
  const hash = opts?.hash ? `#${opts.hash}` : "";
  return qs ? `/?${qs}${hash}` : `/${hash}`;
}

export function isHomeSearchOpen(base: HomeQuery): boolean {
  return base.search === "1" || Boolean(base.q?.trim());
}
