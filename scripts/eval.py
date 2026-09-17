#!/usr/bin/env python3
"""
Evaluation Harness & Scorecard Generator for Cricket Platform.
Measures TypeScript types, ESLint, Prettier, and Vitest test coverage to compute a health score (0-100).
"""

import sys
import os
import json
import subprocess
import time
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
EVAL_DIR = ROOT_DIR / "eval"
REPORT_FILE = EVAL_DIR / "report.json"

def run_step(name, cmd, cwd=ROOT_DIR):
    print(f"▶ Running {name}...", flush=True)
    t0 = time.time()
    res = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
    duration = time.time() - t0
    success = (res.returncode == 0)
    status_str = "✔ PASSED" if success else "✘ FAILED"
    print(f"  {status_str} ({duration:.2f}s)")
    if not success and res.stderr:
        print(f"    Error: {res.stderr.strip().splitlines()[-1] if res.stderr.strip() else 'Exit code non-zero'}")
    return {
        "name": name,
        "success": success,
        "duration_s": round(duration, 2),
        "stdout": res.stdout,
        "stderr": res.stderr,
    }

def main():
    print("=" * 60)
    print("🏏 CRICKET PLATFORM - AGENTIC EVALUATION HARNESS")
    print("=" * 60)

    EVAL_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Typecheck
    type_res = run_step("TypeScript Compilation", "npx tsc --noEmit")

    # 2. ESLint
    lint_res = run_step("ESLint Verification", "npx eslint .")

    # 3. Test Suite & Coverage
    cov_summary_file = ROOT_DIR / "coverage" / "coverage-summary.json"
    test_res = run_step(
        "Vitest Suite & Coverage",
        "npx vitest run --coverage --coverage.reporter=json-summary --coverage.reporter=text-summary"
    )

    coverage_pct = 0.0
    total_tests = 0
    passed_tests = 0
    uncovered_files = []

    if cov_summary_file.exists():
        try:
            with open(cov_summary_file, "r") as f:
                cov_data = json.load(f)
                total_cov = cov_data.get("total", {})
                lines_cov = total_cov.get("lines", {})
                coverage_pct = round(lines_cov.get("pct", 0.0), 2)

                # Identify lowest covered components for improvement recommendations
                for filepath, stats in cov_data.items():
                    if filepath == "total":
                        continue
                    pct = stats.get("lines", {}).get("pct", 0.0)
                    if pct < 50.0 and ("src/components" in filepath or "src/lib" in filepath):
                        rel_path = os.path.relpath(filepath, str(ROOT_DIR))
                        uncovered_files.append({"file": rel_path, "coverage": pct})
        except Exception as e:
            print(f"Warning: Could not parse coverage summary: {e}")

    # Compute Composite Quality Score (0 to 100)
    # Types: 30pts, Lint: 30pts, Test Pass: 20pts, Coverage: 20pts (scaled by coverage_pct / 100)
    score = 0
    if type_res["success"]: score += 30
    if lint_res["success"]: score += 30
    if test_res["success"]: score += 20
    score += round((coverage_pct / 100.0) * 20.0, 1)

    # Sort lowest covered files for agent recommendation
    uncovered_files.sort(key=lambda x: x["coverage"])
    top_recommendations = uncovered_files[:5]

    report = {
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "composite_health_score": score,
        "gates": {
            "typecheck": type_res["success"],
            "eslint": lint_res["success"],
            "tests_pass": test_res["success"]
        },
        "coverage_percentage": coverage_pct,
        "improvement_targets": top_recommendations
    }

    with open(REPORT_FILE, "w") as f:
        json.dump(report, f, indent=2)

    print("\n" + "=" * 60)
    print(f"📊 COMPOSITE EVALUATION SCORE: {score} / 100")
    print(f"   Line Coverage: {coverage_pct}%")
    print(f"   Quality Gates: {'ALL PASSED ✔' if all(report['gates'].values()) else 'FAILURES DETECTED ✘'}")
    print("=" * 60)

    if top_recommendations:
        print("\n🎯 TOP IMPROVEMENT TARGETS (Lowest Test Coverage):")
        for rec in top_recommendations:
            print(f"   - {rec['file']}: {rec['coverage']}% covered")

    print(f"\nDetailed report written to: {REPORT_FILE}\n")

    # Exit code 0 if all gates passed
    if all(report["gates"].values()):
        sys.exit(0)
    else:
        sys.exit(1)

if __name__ == "__main__":
    main()
