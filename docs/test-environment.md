# テスト環境（staging）構築ガイド

このドキュメントは、`utomachi100katen` の **テスト（staging）環境** の構成・起動手順・運用ルールをまとめたものです。

本番（Golden）は `main` ブランチ + 本番 Firebase プロジェクト `utomachi100katen` で完全に分離されています。**本番を壊さない** ことが最優先の原則です。

---

## 1. 構成図

```
┌─────────────────┐     ┌────────────────────────┐     ┌────────────────────────────┐
│   main branch   │ ──► │ Vercel  Production     │ ──► │ Firebase  prod             │
│  (Golden)       │     │                        │     │ (utomachi100katen)         │
└─────────────────┘     └────────────────────────┘     └────────────────────────────┘

┌─────────────────┐     ┌────────────────────────┐     ┌────────────────────────────┐
│ staging /       │ ──► │ Vercel  Preview        │ ──► │ Firebase  staging          │
│ feature/* branch│     │                        │     │ (utomachi100katen-         │
│                 │     │                        │     │   staging-d6583)           │
└─────────────────┘     └────────────────────────┘     └────────────────────────────┘

┌─────────────────┐     ┌────────────────────────┐
│   local dev     │ ──► │ Firebase Emulator      │
│ (any branch)    │     │  (Auth/Firestore/      │
│                 │     │   Storage/UI)          │
└─────────────────┘     └────────────────────────┘
```

| 環境 | ブランチ | Firebase 接続先 | 起動方法 |
|---|---|---|---|
| Production | `main` | `utomachi100katen` | Vercel が `git push` で自動デプロイ |
| Preview    | `staging`, `feature/*` | `utomachi100katen-staging-d6583` | Vercel が PR / push で自動デプロイ |
| Development | ローカル（任意） | Emulator | `npm run dev:emulator` |

---

## 2. ローカル開発（Emulator 利用）

### 2-1. 初回セットアップ

1. Firebase CLI をインストール（未導入の場合）
   ```sh
   npm install -g firebase-tools
   firebase login
   ```
2. `.env.local` を用意（`.env.example` をコピー）
   ```sh
   cp .env.example .env.local
   ```
3. `.env.local` を編集
   - Emulator 利用時は以下だけ指定すれば動作します
     ```
     NEXT_PUBLIC_USE_EMULATOR=true
     NEXT_PUBLIC_FIREBASE_API_KEY=dummy
     NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=localhost
     NEXT_PUBLIC_FIREBASE_PROJECT_ID=utomachi100katen-staging-d6583
     NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=utomachi100katen-staging-d6583.firebasestorage.app
     NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=000000000000
     NEXT_PUBLIC_FIREBASE_APP_ID=1:000000000000:web:dummy
     ```
   - Admin SDK 側は `npm run dev:emulator` が `FIRESTORE_EMULATOR_HOST` 等を自動設定します

### 2-2. 起動

```sh
npm run dev:emulator
```

- `firebase emulators:start` と `next dev` が並列で起動します
- Emulator UI: http://127.0.0.1:4000
- Next.js: http://localhost:3000

### 2-3. ダミーデータ投入（Emulator）

別ターミナルで:
```sh
npm run seed:emulator
```

- テストユーザー 2名（`admin@test.local`, `user@test.local` / いずれも password: `Test1234!`）
- 基本マスタ（brands / retailStores / suppliers / products）
- Storage にテスト画像 1 枚

### 2-4. Emulator のデータ永続化

`npm run dev:emulator` / `npm run emulator:start` は `--import=./.emulator-data --export-on-exit` を付けているため、**Ctrl+C で終了した際に自動で `./.emulator-data` にデータが保存**されます。次回起動時はその状態から復帰します。

手動でスナップショットを取りたい場合は別ターミナルから:
```sh
npm run emulator:export
```

---

## 3. Firebase staging プロジェクトへの反映

### 3-1. Firebase CLI のプロジェクト指定

このリポジトリの `.firebaserc` は以下のエイリアスを持ちます:

```
default  → utomachi100katen           (本番／Golden)
staging  → utomachi100katen-staging-d6583
```

### 3-2. Firestore / Storage ルール・インデックスのデプロイ

```sh
# staging へ
npm run deploy:rules:staging

# 本番へ（慎重に実施）
npm run deploy:rules:prod
```

デプロイ対象: `firestore.rules`, `storage.rules`, `firestore.indexes.json`

### 3-3. staging へダミーデータを投入

1. Firebase Console から staging プロジェクトのサービスアカウント JSON をダウンロードし、`secrets/` 配下に置く（コミット禁止）
2. 実行:
   ```sh
   GOOGLE_APPLICATION_CREDENTIALS=./secrets/<staging-service-account>.json npm run seed:staging
   ```

安全装置として、`SEED_TARGET=staging` でも接続先 projectId が本番 (`utomachi100katen`) の場合は即 abort します。

---

## 4. Vercel 環境変数

Vercel ダッシュボード → Project Settings → Environment Variables で以下のように設定してください（秘密情報はリポジトリに入れないこと）。

| Key | Production | Preview | Development |
|---|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | 本番値 | staging値 | (.env.local) |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | 本番値 | staging値 | (.env.local) |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `utomachi100katen` | `utomachi100katen-staging-d6583` | (.env.local) |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 本番値 | staging値 | (.env.local) |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | 本番値 | staging値 | (.env.local) |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | 本番値 | staging値 | (.env.local) |
| `NEXT_PUBLIC_USE_EMULATOR` | **未設定** | **未設定** | `true`（ローカルのみ） |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | 本番 SA JSON | staging SA JSON | (.env.local) |
| `GEMINI_API_KEY` | 本番 | 本番流用可 | (.env.local) |
| `OPENWEATHER_API_KEY` | 本番 | 本番流用可 | (.env.local) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | 本番 | 本番流用可 | (.env.local) |
| `CRON_SECRET` | 本番 | staging用に別値推奨 | (.env.local) |
| `AMAZON_*` | 本番 | sandbox値 (`AMAZON_USE_SANDBOX=true`) | (.env.local) |
| `SHOPIFY_*` | 本番 | テストストア値 | (.env.local) |
| `SQUARE_*` | 本番 (`SQUARE_ENVIRONMENT=production`) | sandbox (`SQUARE_ENVIRONMENT=sandbox`) | (.env.local) |

> **重要**: Vercel Production には **必ず本番値** を入れてください。Preview / Development に本番 Firebase を指さないこと。

---

## 5. ユニットテスト

### 5-1. 実行

```sh
# lib のピュアユーティリティテスト（デフォルト）
npm test

# 監視モード
npm run test:watch
```

### 5-2. ルールテスト（要 Emulator）

ルールテスト（`tests/firestore.rules.test.ts`, `tests/storage.rules.test.ts`）は Emulator 起動が必要なため `vitest.config.ts` でデフォルト除外しています。

手動実行:
```sh
# 別ターミナルで Emulator を起動
npm run emulator:start

# テスト実行
npx vitest run tests/firestore.rules.test.ts --exclude=''
npx vitest run tests/storage.rules.test.ts --exclude=''
```

---

## 6. 本番との切り分けルール

1. **main ブランチを直接変更しない** — staging 構築作業は `feature/*` ブランチで行い、PR 経由でマージする
2. **本番 Firebase プロジェクトを触るオペレーションは `deploy:rules:prod` のみ** — シードスクリプトは本番 projectId を検知すると abort するように実装されている
3. **秘密情報（サービスアカウント JSON / API Key）は絶対にコミットしない**
   - `secrets/` は `.gitignore` 済み
   - Firebase Admin SDK の JSON は `secrets/<project>-adminsdk.json` に保存するか、環境変数 `FIREBASE_SERVICE_ACCOUNT_KEY` に JSON 文字列として保持する
4. **staging でテストした機能を本番へ反映する流れ**
   ```
   feature/xxx → PR → main にマージ
      ├── Vercel Production が自動デプロイ (本番Firebase)
      └── ルール変更を含む場合は `npm run deploy:rules:prod` を手動実行
   ```
5. **Emulator は本番・staging のいずれとも通信しない** — `NEXT_PUBLIC_USE_EMULATOR=true` 時はすべてローカルに閉じる

---

## 7. よくある質問

**Q. Preview デプロイで Firebase の初期化エラーが出る**  
→ Vercel Preview に `NEXT_PUBLIC_FIREBASE_*` と `FIREBASE_SERVICE_ACCOUNT_KEY` が設定されているか確認してください。

**Q. Emulator 起動中に `npm run dev` してしまった**  
→ その場合 `NEXT_PUBLIC_USE_EMULATOR` がセットされないため本番/staging に接続します。必ず `npm run dev:emulator` を使ってください。

**Q. staging に本番データが欲しい**  
→ 個人情報マスキングを含む export/import スクリプトが必要で、今回のスコープ外です。必要になったら別タスクとして依頼してください。
