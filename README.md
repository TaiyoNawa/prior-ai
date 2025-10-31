# prior-ai

AI assisted task planner built with Next.js App Router. Users draft tasks, ask the AI to enrich or regroup them, and review structured results in a sortable task board.

## Features

- AI analysis pipeline that expands tasks into subtasks, estimates effort, and suggests priorities
- Unified drag and drop across task lists, subtasks, and draft inputs without drag handles
- Collapsible AI options per draft task so the form stays compact
- History view that groups prior AI runs by prompt and exposes the generated task breakdowns
- Supabase auth integration with Prisma-backed persistence

## Prerequisites

- Node.js 18+
- Yarn (project scripts assume yarn)
- Supabase project and OAuth credentials
- OpenAI compatible API key for analysis (In the future, support for other LLMs like Gemini2.5Flash-Lite will be added)

## Getting Started

1. Install dependencies
   ```bash
   yarn install
   ```
2. Copy the sample environment file and fill in required secrets
   ```bash
   cp .env.example .env.local
   ```
3. Run database migrations and generate the Prisma client
   ```bash
   yarn prisma migrate dev
   ```
4. Launch the development server
   ```bash
   yarn dev
   ```
5. Open http://localhost:3000 to access the app.

## Key Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY` (or compatible provider key)

## Available Scripts

- `yarn dev` – start Next.js in development
- `yarn build` – produce a production build
- `yarn start` – serve the production build
- `yarn lint` – run eslint with the project config

## Tech Stack

- Next.js 14 (App Router, TypeScript)
- Prisma + PostgreSQL
- Supabase Auth
- @dnd-kit for drag and drop interactions
- shadcn/ui components with Tailwind CSS
