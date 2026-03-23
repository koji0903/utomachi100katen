import type { Metadata } from "next";
import { Noto_Sans_JP, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import AppLayout from "@/components/AppLayout";
import { NotificationContainer } from "@/components/NotificationContainer";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-noto-sans-jp",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ウトマチ百貨店 統合管理ツール",
  description: "ウトマチ百貨店の特産品管理",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ウトマチ百貨店",
    startupImage: ["/apple-touch-icon.png"],
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  formatDetection: {
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${notoSansJP.variable} ${inter.variable} font-sans bg-slate-50 text-slate-800 antialiased`}>
        <AuthProvider>
          <NotificationContainer />
          <AppLayout>
            {children}
          </AppLayout>
        </AuthProvider>
      </body>
    </html>
  );
}
