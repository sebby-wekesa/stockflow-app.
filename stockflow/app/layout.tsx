import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Syne } from "next/font/google";
import { headers } from "next/headers";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const dynamic = "force-dynamic";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-body",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

const syne = Syne({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-head",
});

export const metadata: Metadata = {
  title: "SpringTech(K)Ltd",
  description: "Manufacturing ERP",
};

const themeInitializationScript = `
  (function () {
    try {
      var theme = localStorage.getItem("theme");
      if (theme !== "light" && theme !== "dark") {
        theme = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
      document.documentElement.classList.add(theme);
      document.documentElement.style.colorScheme = theme;
    } catch (_) {
      document.documentElement.classList.add("dark");
    }
  })();
`;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await headers();

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} ${syne.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitializationScript }} />
      </head>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
