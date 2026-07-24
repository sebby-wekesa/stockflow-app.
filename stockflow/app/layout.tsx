import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { ToastProvider } from "@/components/Toast";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

export const dynamic = "force-dynamic";

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
      className={theme}
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
