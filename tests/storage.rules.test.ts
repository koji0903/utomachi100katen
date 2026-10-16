/**
 * Storage セキュリティルールのユニットテスト
 *
 * `npm run test:storage-rules` で Storage Emulator を起動して実行する。
 */
import { describe, it, beforeAll, afterAll, beforeEach } from "vitest";
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
    it("未認証ユーザーは見積書PDFをアップロードできない", async () => {
        const unauth = testEnv.unauthenticatedContext().storage();
        const fileRef = ref(unauth, "estimates/EST-2026-002.pdf");
        await assertFails(uploadString(fileRef, "pdf-data", "raw", { contentType: "application/pdf" }));
    });

    it("認証済みユーザーは見積書PDFをアップロードできる", async () => {
        const auth = testEnv.authenticatedContext("user-001").storage();
        const fileRef = ref(auth, "estimates/EST-2026-001.pdf");
        await assertSucceeds(uploadString(fileRef, "pdf-data", "raw", { contentType: "application/pdf" }));
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
