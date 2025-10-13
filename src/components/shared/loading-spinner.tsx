"use client";

import { Loader2 } from "lucide-react";

export function LoadingSpinner({ label }: { label?: string }) {
  // API呼び出し中の状態を示すインジケータ
  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </div>
  );
}
