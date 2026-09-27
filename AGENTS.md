# 🤖 AGENTS.md — Agent Operating Contract

Welcome, Agent. You are operating on the **Cricket Platform** (`cric-score-overlay`).

---

## 🛠️ Project Standards & Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions), React 19
- **Backend / Database**: Supabase (PostgreSQL, Realtime, Auth, Storage)
- **Styling**: Tailwind CSS + shadcn/ui primitives
- **Testing**: Vitest (`vitest run`), jsdom, `@testing-library/react`
- **Port Allocation**: Dev server runs on port `3001` (`npm run dev`)

---

## 📋 Development Guidelines

1. **Focused & Minimal Changes**:
   - Implement clean, direct solutions without unrequested bloat or synthetic loops.
   - Preserve existing functionality and APIs.

2. **Targeted Verification**:
   - Run targeted unit/integration tests for modified files:
     ```bash
     npx vitest run <path/to/test.ts>
     ```
   - Check TypeScript when modifying types:
     ```bash
     npm run typecheck
     ```
   - Check linting:
     ```bash
     npm run lint
     ```

3. **Frontend Best Practices**:
   - Responsive layouts and accessibility (ARIA semantics, proper labels).
   - Use `text-wrap: balance` for titles/cards and `tabular-nums` for score figures.
   - Defer rendering of heavy lists with `.content-visibility-auto`.
   - Form validation with `[&&:user-invalid]` and proper `autoComplete`/`inputMode`.
