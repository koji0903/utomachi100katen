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
        src: "/logo.jpg",
        sizes: "800x800",
        type: "image/jpeg",
        purpose: "any",
      },
      {
        src: "/logo.jpg",
        sizes: "800x800",
        type: "image/jpeg",
        purpose: "maskable",
      },
    ],
    screenshots: [
      {
        src: "/screenshot-desktop.png",
        sizes: "1280x720",
        type: "image/png",
        form_factor: "wide",
        label: "デスクトップ版 ダッシュボード",
      },
      {
        src: "/screenshot-mobile.png",
        sizes: "750x1334",
        type: "image/png",
        label: "モバイル版 ダッシュボード",
      },
    ],
  };
}
