import "../styles.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Owuja",
  description:
    "The business suite and marketplace built for custom African fashion. Designers manage orders, measurements, and invoices in one place; shoppers browse and order custom pieces with confidence.",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
