#!/usr/bin/env bash
# Claude Code pre-commit quality gate
# Runs on PreToolUse(Bash) when a git commit is detected.
# Exit 0 = allow, Exit 2 = block with message.

set -euo pipefail

TOOL_INPUT="$1"

# Only intercept git commit commands
if ! echo "$TOOL_INPUT" | grep -q "git commit"; then
  exit 0
fi

echo "🔍 Claude Code pre-commit: running quality checks..."

cd "$(git rev-parse --show-toplevel)"

# 1. Biome check
echo "→ Running biome check..."
if ! bunx biome check . 2>&1; then
  echo "❌ Biome check failed. Fix lint/format issues before committing."
  exit 2
fi

# 2. TypeScript type check
echo "→ Running typecheck..."
if ! bun run typecheck 2>&1; then
  echo "❌ TypeScript check failed. Fix type errors before committing."
  exit 2
fi

# 3. Secrets detection on staged files
echo "→ Running secrets detection..."
if ! gitleaks protect --staged --no-banner 2>&1; then
  echo "❌ Secrets detected in staged files. Remove secrets before committing."
  exit 2
fi

echo "✅ All pre-commit checks passed."
exit 0
