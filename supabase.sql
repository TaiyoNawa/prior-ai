-- usersテーブルはSupabase Authで自動管理されます

create table if not exists public.tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz default timezone('utc', now())
);

create table if not exists public.logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  prompt text not null,
  response jsonb not null,
  created_at timestamptz default timezone('utc', now())
);

alter table public.tasks enable row level security;
alter table public.logs enable row level security;

create policy "ユーザー自身のタスクのみ参照" on public.tasks
  for select using (auth.uid() = user_id);

create policy "ユーザー自身のタスクのみ挿入" on public.tasks
  for insert with check (auth.uid() = user_id);

create policy "ユーザー自身のログのみ参照" on public.logs
  for select using (auth.uid() = user_id);

create policy "ユーザー自身のログのみ挿入" on public.logs
  for insert with check (auth.uid() = user_id);
