- 新仕様書の実装。
- 別の LLM モデルを使えるようにしたい。(e.g., Gemini2.5Flash-Lite<GPT-4o-mini<gpt-3.5-turbo)>)
- ドラッグ&ドロップ調整
- TaskInputForm のタイトル以外の部分はクリックで開閉できるようにする
- AI で再評価する機能
- この辺のタスクを再開？する
  [済][1] Refactor OpenAI wrapper — openai.ts
  [済][2] Harden analyze API route — route.ts
  [済][3] Expand shared task/domain types — types.ts
  [済][4] Update Prisma schema & scaffold migration — schema.prisma
  [5] Rebuild TaskInputForm — TaskInputForm.tsx
  [6] Enhance TaskList/TaskCard — TaskList.tsx
  [7] Implement caching & rate limiting storage layer — src/lib/\*\*
  [8] Add test skeletons — tests/utils/estimation.test.ts
  [9] Refresh README と .env.example — README.md
- Youtube 動画作成(動画編集)と自動化(n8n)。
- Gemini 2.5 Flash-Lite 導入手順(Google AI Studio)。
- smoothie で Auth 認証 UI 直す。
- Copilot のレビューを修正
