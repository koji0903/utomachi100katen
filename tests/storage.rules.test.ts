/**
 * Storage セキュリティルールのユニットテスト
 *
 * 前提: Firebase Emulator Suite (Storage) が起動していること
 *   npm run emulator:start
 *
 * 実行: vitest の設定でデフォルト除外されているため、
 *   npx vitest run tests/storage.rules.test.ts --exclude=''
 *   のように明示指定して実行する。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
    initializeTestEnvironment,
    RulesTestEnvironment,
    assertFails,
    assertSucceeds,
} from "@firebase/rules-unit-testing";
import { ref, uploadString, getDownloadURL } from "firebase/storage";
import * as fs from "node:fs";
import * as path from "node:path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: "utomachi100katen-rules-test",
        storage: {
            rules: fs.readFileSync(path.resolve(__dirname, "../storage.rules"), "utf8"),
            host: "127.0.0.1",
            port: 9199,
        },
    });
});

afterAll(async () => {
    await testEnv?.cleanup();
});

beforeEach(async () => {
    await testEnv.clearStorage();
});

describe("storage.rules", () => {
    it("未認証ユーザーはアップロードできない", async () => {
        const unauth = testEnv.unauthenticatedContext().storage();
        const fileRef = ref(unauth, "uploads/test.txt");
        await assertFails(uploadString(fileRef, "hello"));
    });

    it("認証済みユーザーはアップロードできる", async () => {
        const auth = testEnv.authenticatedContext("user-001").storage();
        const fileRef = ref(auth, "uploads/test.txt");
        await assertSucceeds(uploadString(fileRef, "hello"));
    });

    it("未認証ユーザーは既存ファイルの URL を取得できない", async () => {
        await testEnv.withSecurityRulesDisabled(async (ctx) => {
            const fileRef = ref(ctx.storage(), "uploads/seed.txt");
            await uploadString(fileRef, "seed");
        });
        const unauth = testEnv.unauthenticatedContext().storage();
        const fileRef = ref(unauth, "uploads/seed.txt");
        await assertFails(getDownloadURL(fileRef));
    });
});
