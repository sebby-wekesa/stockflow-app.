import type { Metadata } from "next";
import { DM_Mono, DM_Sans, Syne } from "next/font/google";
import { cookies, headers } from "next/headers";
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await headers();
  const cookieStore = await cookies();
  const storedTheme = cookieStore.get("theme")?.value;
  const theme = storedTheme === "light" ? "light" : "dark";

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${dmMono.variable} ${syne.variable} ${theme}`}
      style={{ colorScheme: theme }}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
