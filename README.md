
  # lets_web

  This is a code bundle for lets_web. The original project is available at https://www.figma.com/design/UaHlGJ2z4pJGJBu49ncS9G/lets_web.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ### Figma で作ったコード（アプリ）を Cursor 内ブラウザで見る

  1. **開発サーバーを起動**: `Ctrl+Shift+P` → 「Tasks: Run Task」→ **「Start Dev Server」**
  2. **Cursor 内でアプリを表示**: 「Tasks: Run Task」→ **「Open App in Cursor Browser」**  
     → Figma デザインから実装したアプリ（`http://localhost:3000`）が Cursor 内の Simple Browser で開きます。外部ブラウザは使いません。
  3. またはコマンドパレットで「Simple Browser: Show」を実行し、URL に `http://localhost:3000` を入力

  ### プロジェクト構成（次のステップ済み）

  - **Tailwind CSS**: `@tailwindcss/vite` で導入済み。`src/index.css` で `@import "tailwindcss"` を使用。
  - **レイアウト**: `src/components/layout/Header.tsx` と `MainLayout.tsx` でヘッダー＋メインのレイアウトを構成。
  - **本番UI**: `App.tsx` で `MainLayout` を利用し、Figma リンクと次のステップ案内を表示。
  - Figma デザインに合わせて画面・コンポーネントを追加する場合は、上記レイアウトと既存の Radix UI 依存を流用できます。
