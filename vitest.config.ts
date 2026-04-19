import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        environment: "node",
        include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
        // @firebase/rules-unit-testing を使うルールテストは
        // エミュレータ起動を前提とするため、通常は別ターゲット推奨。
        // 現状は最小構成として lib のユニットテストのみ include させる。
        exclude: [
            "node_modules/**",
            "scratch/**",
            ".next/**",
            // ルールテストはエミュレータ必須につきデフォルトでは除外する
            "tests/firestore.rules.test.ts",
            "tests/storage.rules.test.ts",
        ],
        testTimeout: 20000,
    },
});
