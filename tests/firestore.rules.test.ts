/**
 * Firestore セキュリティルールのユニットテスト
 *
 * 前提: Firebase Emulator Suite (Firestore) が起動していること
 *   npm run emulator:start
 *
 * 実行: vitest の設定でデフォルト除外されているため、
 *   npx vitest run tests/firestore.rules.test.ts --exclude=''
 *   のように明示指定して実行する。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
    initializeTestEnvironment,
    RulesTestEnvironment,
    assertFails,
    assertSucceeds,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";
import * as fs from "node:fs";
import * as path from "node:path";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: "utomachi100katen-rules-test",
        firestore: {
            rules: fs.readFileSync(path.resolve(__dirname, "../firestore.rules"), "utf8"),
            host: "127.0.0.1",
            port: 8080,
        },
    });
});

afterAll(async () => {
    await testEnv?.cleanup();
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

describe("firestore.rules", () => {
    it("未認証ユーザーは products を読めない", async () => {
        const unauth = testEnv.unauthenticatedContext().firestore();
        await assertFails(getDoc(doc(unauth, "products/p1")));
    });

    it("認証済みユーザーは products を読み書きできる", async () => {
        const auth = testEnv.authenticatedContext("user-001").firestore();
        await assertSucceeds(setDoc(doc(auth, "products/p1"), { name: "商品1" }));
        await assertSucceeds(getDoc(doc(auth, "products/p1")));
    });

    it("未認証ユーザーは products に書き込めない", async () => {
        const unauth = testEnv.unauthenticatedContext().firestore();
        await assertFails(setDoc(doc(unauth, "products/p1"), { name: "NG" }));
    });

    it("ルール未定義のコレクションはデフォルト deny", async () => {
        const auth = testEnv.authenticatedContext("user-001").firestore();
        await assertFails(setDoc(doc(auth, "unknown_collection/x"), { v: 1 }));
    });
});
