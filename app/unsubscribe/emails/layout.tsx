import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Unsubscribe from Feature emails",
  robots: { index: false, follow: false },
};

export default function UnsubscribeEmailsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
