import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: { canonical: "/exam/result" },
};

export default function ExamResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
