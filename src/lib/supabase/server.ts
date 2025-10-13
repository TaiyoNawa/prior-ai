import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "./types";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // デプロイ環境での設定漏れに気付きやすくするための警告ログ
  console.warn("Supabase credentials are not fully configured");
}

export type SupabaseServerClient = SupabaseClient<Database>;

export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables are not set");
  }

  const cookieStore = await cookies();

  // App Routerでもセッション維持できるようCookieのget/setを委譲
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component内ではsetAllが失敗するため、ここで握り潰しても問題なし
        }
      },
    },
  });
}

export type SupabaseAuthContext = {
  supabase: SupabaseServerClient;
  user: User | null;
};

export async function getSupabaseAuthContext(): Promise<SupabaseAuthContext> {
  // サーバーコンポーネント内でSupabaseクライアントと認証済みユーザーを取得する
  const supabase = await createSupabaseServerClient();

  // getUserはSupabase側でトークン検証を行うためセキュア
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("Failed to retrieve Supabase user", error);
    return { supabase, user: null };
  }

  return { supabase, user };
}

export async function getSupabaseUserOrThrow() {
  // 認証済みユーザーを取得し、存在しない場合は例外をスローする
  const { supabase, user } = await getSupabaseAuthContext();

  if (!user) {
    throw new Error("Supabase user is not authenticated");
  }

  return { supabase, user };
}
