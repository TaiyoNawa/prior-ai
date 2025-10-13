import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";

import { getSupabaseAuthContext } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const { user } = await getSupabaseAuthContext();

  // 既に検証済みユーザーが存在する場合は登録画面をスキップ
  if (user) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">アカウントを作成</h1>
        <p className="text-muted-foreground">
          PriorAIでタスク管理を加速させるために登録を完了してください。
        </p>
      </div>
      <AuthForm defaultMode="register" />
    </div>
  );
}
