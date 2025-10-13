"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState, useTransition } from "react";
import { toast } from "sonner";

import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { useSupabase } from "@/components/shared/supabase-provider";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

import type { StructuredTask } from "@/lib/types";

interface TaskInputFormProps {
  onResult?: (tasks: StructuredTask[]) => void;
}

export function TaskInputForm({ onResult }: TaskInputFormProps) {
  // タスク入力テキストを保持
  const [input, setInput] = useState("");
  const [isSubmitting, startTransition] = useTransition();
  const { session } = useSupabase();
  const router = useRouter();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session) {
      toast.error("ログイン後にご利用いただけます");
      router.push("/login");
      return;
    }

    if (!input.trim()) {
      toast.error("タスクを入力してください");
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tasks: input }),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "AI解析に失敗しました");
        }

        const result = (await response.json()) as { tasks: StructuredTask[] };
        onResult?.(result.tasks);
        toast.success("タスクを整理しました");
      } catch (error) {
        console.error(error);
        toast.error("AI解析でエラーが発生しました");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          整理したいタスクを改行区切りで入力
        </span>
        <Textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={`例: \n- 週次レポートを作成する\n- プレゼン資料を準備する\n- 運動を30分する`}
          rows={8}
          disabled={isSubmitting}
        />
      </label>
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? <LoadingSpinner label="AIが整理中..." /> : "AIで整理"}
      </Button>
    </form>
  );
}
