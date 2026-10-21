import type { Metadata } from "next";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pratinjau Website",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default function CmsPreviewLayout({ children }: { children: ReactNode }) {
  return children;
}
