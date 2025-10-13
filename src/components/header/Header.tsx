"use client";

import { LogOut, Menu, Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { useSupabase } from "@/components/shared/supabase-provider";
import { Button } from "@/components/ui/button";

export function Header() {
  // ナビゲーションとログイン状態を表示するヘッダー
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useSupabase();
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
      router.push("/login");
    });
  };

  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <Menu className="size-4" aria-hidden="true" />
          PriorAI
        </Link>
        <nav className="flex items-center gap-3">
          <Button
            asChild
            variant={pathname === "/" ? "default" : "ghost"}
            size="sm"
          >
            <Link href="/">
              <Plus className="size-4" aria-hidden="true" />
              タスク入力
            </Link>
          </Button>
          <Button
            asChild
            variant={pathname === "/tasks" ? "default" : "ghost"}
            size="sm"
          >
            <Link href="/tasks">履歴</Link>
          </Button>
          {session ? (
            <span className="hidden text-sm text-muted-foreground sm:inline">
              {session.user.email}
            </span>
          ) : null}
          {session ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              disabled={isPending}
            >
              <LogOut className="size-4" aria-hidden="true" />
              ログアウト
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">ログイン</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
