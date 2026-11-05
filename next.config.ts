import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: true, // Disable service worker to prevent unintended reloads and cache conflicts
  register: false,
  reloadOnOnline: false,
});

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {},
};

export default withPWA(nextConfig);
