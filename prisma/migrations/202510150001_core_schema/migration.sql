-- Prisma Migration Placeholder
-- このマイグレーションは旧スキーマから新スキーマへの移行手順を示す雛形です。
-- 実際の適用前にSupabase上の既存データ整合性を確認してください。

-- 1. usage_counter テーブルの新規作成
CREATE TABLE IF NOT EXISTS "UsageCounter" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE,
  "month" TEXT NOT NULL,
  "aiCalls" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UsageCounter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_usage_month" ON "UsageCounter" ("month");

-- 2. 旧logsテーブルを新形式へ拡張
ALTER TABLE "Log"
  ADD COLUMN IF NOT EXISTS "promptHash" TEXT,
  ADD COLUMN IF NOT EXISTS "prompt" JSONB,
  ADD COLUMN IF NOT EXISTS "rawResponse" TEXT,
  ADD COLUMN IF NOT EXISTS "costEstimate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "modelUsed" TEXT;
CREATE INDEX IF NOT EXISTS "idx_log_prompt_hash" ON "Log" ("promptHash");

-- 3. 旧tasksテーブルを正規化済フィールドへ拡張
ALTER TABLE "Task"
  DROP COLUMN IF EXISTS "subtasks",
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "order" INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "estMinutes" INTEGER,
  ADD COLUMN IF NOT EXISTS "actualMin" INTEGER,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "shortReason" TEXT,
  ADD COLUMN IF NOT EXISTS "longExplanation" TEXT,
  ADD COLUMN IF NOT EXISTS "completed" BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "promptHash" TEXT,
  ADD COLUMN IF NOT EXISTS "modelUsed" TEXT,
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS "idx_task_user_created" ON "Task" ("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "idx_task_prompt_hash" ON "Task" ("promptHash");
CREATE INDEX IF NOT EXISTS "idx_task_user_order" ON "Task" ("userId", "order");

-- 4. サブタスク管理テーブルの新規作成
CREATE TABLE IF NOT EXISTS "Subtask" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "taskId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "order" INTEGER NOT NULL DEFAULT 0,
  "completed" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "Subtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "idx_subtask_task_order" ON "Subtask" ("taskId", "order");

-- 5. 旧データの移行については別途INSERT/UPDATEスクリプトを用意
--    TODO: 旧tasks.data JSONから新フィールドへのマッピング処理を実装
