#!/usr/bin/env bash
# gemini.sh — Query Google Gemini CLI from Claude Code
# Usage: gemini.sh <task_type> [args...]
#
# Task types:
#   query     <prompt>         — General query (fast, text output)
#   summarize <file_path>      — Summarize a file's purpose and structure
#   review    <file_path>      — Review code for issues
#   diff      [diff_text]      — Analyze a git diff (or pipe stdin)
#   test-gen  <file_path>      — Generate test stubs for a file
#   status                     — Check if Gemini CLI is available

set -euo pipefail

GEMINI_CMD="${GEMINI_CMD:-gemini}"

# ── Helpers ──────────────────────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

check_gemini() {
  if ! command -v "$GEMINI_CMD" >/dev/null 2>&1; then
    die "Gemini CLI not found. Install with: npm install -g @google/gemini-cli"
  fi
}

# Send a prompt to Gemini in non-interactive mode
# $1 = prompt text (may include piped content)
gemini_query() {
  local prompt="$1"
  local output
  output=$("$GEMINI_CMD" -p "$prompt" -s -o text 2>&1) || {
    # Check if it's an auth error
    if echo "$output" | grep -qi "auth\|credential\|login\|token"; then
      die "Gemini authentication failed. Run: gemini (interactive) to re-authenticate"
    fi
    die "Gemini request failed: $output"
  }
  # Filter out the "Loaded cached credentials" line
  echo "$output" | grep -v "^Loaded cached credentials\.$"
}

# ── Commands ─────────────────────────────────────────────────────────

cmd_status() {
  check_gemini
  local version
  version=$("$GEMINI_CMD" --version 2>&1 || echo "unknown")
  echo "Gemini CLI v${version}"

  # Quick auth check
  local test_output
  if test_output=$("$GEMINI_CMD" -p "Reply with: OK" -s -o text 2>&1); then
    echo "Authentication: OK"
  else
    echo "Authentication: FAILED (run 'gemini' interactively to re-auth)"
  fi
}

cmd_query() {
  local prompt="$*"
  [[ -z "$prompt" ]] && die "Usage: gemini.sh query <prompt>"
  check_gemini
  gemini_query "$prompt"
}

cmd_summarize() {
  local file_path="$1"
  [[ -z "$file_path" ]] && die "Usage: gemini.sh summarize <file_path>"
  [[ ! -f "$file_path" ]] && die "File not found: $file_path"
  check_gemini

  local content
  content=$(head -200 "$file_path")
  local ext="${file_path##*.}"

  gemini_query "Summarize this ${ext} file concisely. List: purpose, exports, key functions, dependencies. Use bullet points.

File: ${file_path}

\`\`\`${ext}
${content}
\`\`\`"
}

cmd_review() {
  local file_path="$1"
  [[ -z "$file_path" ]] && die "Usage: gemini.sh review <file_path>"
  [[ ! -f "$file_path" ]] && die "File not found: $file_path"
  check_gemini

  local content
  content=$(head -300 "$file_path")
  local ext="${file_path##*.}"

  gemini_query "Review this ${ext} code for bugs, security issues, performance problems, and style issues. Be specific with line references. If the code looks good, say so briefly.

File: ${file_path}

\`\`\`${ext}
${content}
\`\`\`"
}

cmd_diff() {
  local diff_text="$*"
  if [[ -z "$diff_text" ]]; then
    diff_text=$(cat)
  fi
  [[ -z "$diff_text" ]] && die "Usage: gemini.sh diff <diff_text> or pipe: git diff | gemini.sh diff"
  check_gemini

  gemini_query "Analyze this git diff. Summarize what changed, flag any issues (bugs, security, missing tests), and note if related code elsewhere might need updating.

\`\`\`diff
${diff_text}
\`\`\`"
}

cmd_test_gen() {
  local file_path="$1"
  [[ -z "$file_path" ]] && die "Usage: gemini.sh test-gen <file_path>"
  [[ ! -f "$file_path" ]] && die "File not found: $file_path"
  check_gemini

  local content
  content=$(head -200 "$file_path")
  local ext="${file_path##*.}"

  gemini_query "Generate bun:test unit test stubs for this file. Use 'describe', 'it', 'expect' from 'bun:test'. Include happy path, edge cases, and error cases. Use mock.module() for external deps. Output only the test code.

File: ${file_path}

\`\`\`${ext}
${content}
\`\`\`"
}

# ── Main ─────────────────────────────────────────────────────────────

case "${1:-}" in
  status)    cmd_status ;;
  query)     shift; cmd_query "$@" ;;
  summarize) shift; cmd_summarize "$@" ;;
  review)    shift; cmd_review "$@" ;;
  diff)      shift; cmd_diff "$@" ;;
  test-gen)  shift; cmd_test_gen "$@" ;;
  *)
    echo "Usage: gemini.sh <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  status                 Check Gemini CLI availability"
    echo "  query    <prompt>      General question"
    echo "  summarize <file>       Summarize a file's structure"
    echo "  review   <file>        Review code for bugs/issues"
    echo "  diff     [diff_text]   Analyze a git diff (or pipe stdin)"
    echo "  test-gen <file>        Generate bun:test stubs for a file"
    exit 1
    ;;
esac
