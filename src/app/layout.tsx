import type { Metadata } from "next";
import { Noto_Sans_JP, Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import AppLayout from "@/components/AppLayout";
import { NotificationContainer } from "@/components/NotificationContainer";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
    <html lang="ja" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (typeof window === 'undefined') return;
                // 1. 旧 Workbox 等による controllerchange -> location.reload() の暴発を無力化
                if ('serviceWorker' in navigator) {
                  try {
                    navigator.serviceWorker.oncontrollerchange = null;
                  } catch(e) {}
                  // 2. 全ての登録済み Service Worker を強制解除
                  navigator.serviceWorker.getRegistrations().then(function(regs) {
                    for (var i = 0; i < regs.length; i++) {
                      regs[i].unregister();
                    }
                  }).catch(function() {});
                }
                // 3. 全ての CacheStorage を完全消去
                if ('caches' in window) {
                  caches.keys().then(function(keys) {
                    for (var i = 0; i < keys.length; i++) {
                      caches.delete(keys[i]);
                    }
                  }).catch(function() {});
                }
              })();
            `,
          }}
        />
      </head>
      <body className={`${notoSansJP.variable} ${inter.variable} font-sans bg-slate-50 text-slate-800 antialiased`}>
        <ErrorBoundary>
          <AuthProvider>
            <NotificationContainer />
            <AppLayout>
              {children}
            </AppLayout>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
