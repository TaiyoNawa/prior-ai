"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useSupabase } from "@/components/shared/supabase-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthMode = "login" | "register";

interface AuthFormProps {
  defaultMode?: AuthMode;
}

export function AuthForm({ defaultMode = "login" }: AuthFormProps) {
  // ログイン・登録フォームの状態を管理
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { signInWithEmail, signUpWithEmail, signInWithGoogle } = useSupabase();

  useEffect(() => {
    setMode(defaultMode);
  }, [defaultMode]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !password) {
      toast.error("メールアドレスとパスワードを入力してください");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "login") {
          await signInWithEmail(email, password);
          toast.success("ログインしました");
        } else {
          await signUpWithEmail(email, password);
          toast.success("登録用メールを送信しました。受信箱をご確認ください。");
        }
        router.push("/");
      } catch (error) {
        console.error(error);
        toast.error("認証に失敗しました。再度お試しください。");
      }
    });
  };

  const handleGoogleSignIn = () => {
    startTransition(async () => {
      try {
        await signInWithGoogle();
      } catch (error) {
        console.error(error);
        toast.error("Googleサインインに失敗しました");
      }
    });
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-6 rounded-2xl border border-border/60 bg-card/80 p-8 shadow-md">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">
          {mode === "login" ? "ログイン" : "アカウント登録"}
        </h1>
        <p className="text-sm text-muted-foreground">
          PriorAIでAIによるタスク整理を体験しましょう。
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="space-y-2" htmlFor="email">
          <span className="text-sm font-medium text-muted-foreground">
            メールアドレス
          </span>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isPending}
            required
          />
        </label>
        <label className="space-y-2" htmlFor="password">
          <span className="text-sm font-medium text-muted-foreground">
            パスワード
          </span>
          <Input
            id="password"
            type="password"
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={isPending}
            required
          />
        </label>
        <Button type="submit" className="w-full" disabled={isPending}>
          {mode === "login" ? "ログイン" : "アカウントを作成"}
        </Button>
      </form>
      <div className="space-y-3">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-dashed border-border/70" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">または</span>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={isPending}
        >
          Googleで続ける
        </Button>
      </div>
      <div className="text-center text-sm text-muted-foreground">
        {mode === "login" ? "初めての方は" : "既にアカウントをお持ちですか？"}
        <button
          type="button"
          onClick={() => {
            const nextMode = mode === "login" ? "register" : "login";
            setMode(nextMode);
            router.push(nextMode === "login" ? "/login" : "/register");
          }}
          className="ml-2 text-primary hover:underline"
        >
          {mode === "login" ? "アカウント登録" : "ログイン"}
        </button>
      </div>
    </div>
  );
}
