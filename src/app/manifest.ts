import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    start_url: "/",
    name: "ウトマチ百貨店 統合管理ツール",
    short_name: "ウトマチ百貨店",
    description: "ウトマチ百貨店の特産品・業務管理ツール",
    lang: "ja",
    dir: "ltr",
    orientation: "any",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshot-desktop.jpg",
        sizes: "640x640",
        type: "image/jpeg",
        form_factor: "wide",
        label: "デスクトップ版 ダッシュボード",
      },
      {
        src: "/screenshot-mobile.jpg",
        sizes: "640x640",
        type: "image/jpeg",
        label: "モバイル版 ダッシュボード",
      },
    ],
  };
}
