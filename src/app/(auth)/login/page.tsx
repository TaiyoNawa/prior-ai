import { redirect } from "next/navigation";

import { AuthForm } from "@/components/auth/AuthForm";

import { getSupabaseAuthContext } from "@/lib/supabase/server";

export default async function LoginPage() {
  const { user } = await getSupabaseAuthContext();

  // 既に検証済みユーザーが存在する場合はログイン画面を表示せずホームへ
  if (user) {
    redirect("/");
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 py-10">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">PriorAIへようこそ</h1>
        <p className="text-muted-foreground">
          AIにタスク整理を任せる準備を整えましょう。
        </p>
      </div>
      <AuthForm defaultMode="login" />
    </div>
  );
}
