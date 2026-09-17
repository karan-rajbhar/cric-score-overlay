---
name: eval-loop
description: >-
  Autonomous feature improvement and evaluation loop for Cricket Platform.
  Use when asked to "improve features", "run eval loop", "increase test coverage",
  "audit and fix", or when running long-running autonomous improvement sessions.
---

# Eval-Loop: Autonomous Feature Improvement & Evaluation Skill

This skill guides an agent through the continuous, evaluation-driven improvement of the Cricket Platform.

## When to Use

- When executing a `/goal` autonomous loop.
- When tasked with increasing test coverage or improving features systematically.
- During scheduled health and benchmark audits.

---

## The 4-Phase Protocol

### Phase 1: Benchmark Evaluation

1. Run the evaluation harness:
   ```bash
   npm run eval
   ```
2. Read the generated scorecard at `eval/report.json`:
   - Note the `composite_health_score`.
   - Inspect `improvement_targets` (modules with lowest coverage).
3. Read `eval/backlog.json` and select the highest-priority pending item.

### Phase 2: Test-Driven Specification (TDD)

1. Open or create the test file (e.g. `src/components/navigation-bar.test.tsx`).
2. Write unit/integration tests using Vitest and `@testing-library/react`.
3. Verify test behavior:
   ```bash
   npx vitest run <path/to/test.tsx>
   ```

### Phase 3: Minimal & Clean Implementation

1. Implement the feature or test fixtures.
2. Cross-reference `modern-web-guidance` for standards (ARIA semantics, form validation, text-wrapping, scrollbars).
3. Keep changes cohesive and focused on the selected backlog item.

### Phase 4: Gate Verification & Commit

1. Verify that all gates pass:
   ```bash
   npm run check
   ```
2. Re-run the evaluation harness:
   ```bash
   npm run eval
   ```
3. Check the score delta in `eval/report.json`:
   - If `composite_health_score` increased and all gates are green:
     ```bash
     git add -A
     git commit -m "feat(eval-loop): <feature or test description> [score: <old> -> <new>]"
     ```
   - If tests fail or score dropped: revert uncommitted changes immediately (`git checkout -- .`) and iterate with a revised strategy.
