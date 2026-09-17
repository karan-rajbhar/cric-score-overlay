# 🤖 AGENTS.md — Autonomous Agent Operating Contract

Welcome, Agent. You are operating on the **Cricket Platform** (`cric-score-overlay`).
Your primary objective is to **continuously evaluate, test, and improve** the features, performance, reliability, and code quality of this application.

---

## 🔁 The Autonomous Self-Improvement Loop

When working autonomously (e.g. during a `/goal` session or scheduled iteration), you **MUST** follow this 4-step loop:

```
    [1. EVALUATE] ──▶ [2. TEST FIRST (TDD)] ──▶ [3. IMPLEMENT] ──▶ [4. VERIFY & COMMIT]
          ▲                                                                 │
          └───────────────────── (Next Iteration) ──────────────────────────┘
```

### Step 1: Evaluate & Target

- Run the evaluation harness:
  ```bash
  npm run eval
  ```
- Inspect `eval/report.json` to read the composite score (0-100) and review `improvement_targets` (lowest covered or untested modules).
- Review `eval/backlog.json` for pending feature enhancements or bug fixes.
- Select **one** clear target per iteration.

### Step 2: Test-Driven Development (TDD)

- **Always write or expand test coverage first**:
  - Unit/integration tests live next to the code as `*.test.ts` or `*.test.tsx`.
  - Use `vitest` and `@testing-library/react`.
- Run `npm test` to verify that your new test fails for the right reason.

### Step 3: Implement Feature or Fix

- Write the minimal, robust implementation to satisfy the test.
- Follow modern web best practices:
  - Responsive layouts and accessibility (ARIA, semantic HTML).
  - Use `text-wrap: balance` for titles/cards and `tabular-nums` for score figures.
  - Defer rendering of heavy lists with `.content-visibility-auto`.
  - Interaction-driven form validation with `[&&:user-invalid]` and proper `autoComplete`/`inputMode`.

### Step 4: Verification & Quality Gate

- Run the full quality check:
  ```bash
  npm run check
  ```
- Re-run the evaluation harness:
  ```bash
  npm run eval
  ```
- **Commit Criteria**:
  1. TypeScript (`tsc --noEmit`) passes with **0 errors**.
  2. ESLint (`eslint .`) passes with **0 warnings and 0 errors**.
  3. Test suite passes with **100% success rate**.
  4. Composite score in `eval/report.json` is **equal or higher** than the baseline.
- If all 4 criteria pass, stage and commit with conventional commit format:
  ```bash
  git add -A && git commit -m "feat(eval-loop): <describe improvement> [score: <old> -> <new>]"
  ```
- **Self-Healing Rule**: If the evaluation fails or regressions occur, revert the uncommitted changes (`git checkout -- .`) and re-evaluate with a refined approach. Never leave the working tree in a broken state.

---

## 🛠️ Project Standards & Tech Stack

- **Framework**: Next.js 16 (App Router, Server Actions), React 19
- **Backend / Database**: Supabase (PostgreSQL, Realtime, Auth, Storage)
- **Styling**: Tailwind CSS + shadcn/ui primitives
- **Testing**: Vitest (`vitest run`), jsdom, `@testing-library/react`
- **Quality Gates**: ESLint flat config + Prettier + Husky pre-commit hooks
- **Port Allocation**: Dev server runs on port `3001` (`npm run dev`)
