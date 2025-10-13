export function Footer() {
  // フッターでシンプルな著作権表記を表示
  return (
    <footer className="border-t border-border/60 bg-background/80">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4 text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} PriorAI</span>
        <span className="hidden sm:inline">AIでタスク整理をもっと手軽に。</span>
      </div>
    </footer>
  );
}
