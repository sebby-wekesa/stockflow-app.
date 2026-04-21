import type { Metadata } from "next";
import { DM_Sans, DM_Mono, Syne } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/Toast";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: '--font-dm-sans' });
const dmMono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: '--font-dm-mono' });
const syne = Syne({ subsets: ["latin"], weight: ["600", "700", "800"], variable: '--font-syne' });

export const metadata: Metadata = {
  title: "StockFlow — Manufacturing Platform",
  description: "Manufacturing ERP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
