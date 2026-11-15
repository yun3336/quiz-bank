import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/review" },
};

export default function ReviewLayout({ children }: { children: React.ReactNode }) {
  return children;
}
