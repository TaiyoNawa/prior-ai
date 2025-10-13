"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "./types";

export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // ブラウザ側で必須の環境変数が欠けている場合は早めに検知して中断する
    throw new Error("Supabase credentials are not configured");
  }

  // App Router対応のブラウザクライアントを生成
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}
