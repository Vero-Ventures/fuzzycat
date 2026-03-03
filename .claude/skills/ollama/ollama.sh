#!/usr/bin/env bash
# ollama.sh — Query local Ollama instance from Claude Code
# Usage: ollama.sh <task_type> [args...]
#
# Task types:
#   query    <prompt>              — General query (think:false, fast)
#   think    <prompt>              — Query with reasoning enabled (slower, deeper)
#   summarize <file_path>          — Summarize a file's purpose and structure
#   review   <file_path>           — Review code for issues
#   diff     <diff_text>           — Analyze a git diff
#   grep-explain <pattern> <file>  — Explain grep matches in context
#   status                         — Check if Ollama is running and which model is loaded

set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
TIMEOUT=120  # seconds

# ── Helpers ──────────────────────────────────────────────────────────

die() { echo "ERROR: $*" >&2; exit 1; }

check_ollama() {
  if ! curl -sf --max-time 3 "$OLLAMA_URL/api/version" >/dev/null 2>&1; then
    die "Ollama is not running at $OLLAMA_URL. Start it with: ollama serve"
  fi
}

# Discover the first available model dynamically
get_model() {
  local model
  model=$(curl -sf --max-time 5 "$OLLAMA_URL/api/tags" 2>/dev/null \
    | python3 -c "import sys,json; models=json.load(sys.stdin).get('models',[]); print(models[0]['name'] if models else '')" 2>/dev/null)
  if [[ -z "$model" ]]; then
    die "No models available in Ollama. Pull one with: ollama pull qwen3.5:27b"
  fi
  echo "$model"
}

# Send a chat request to Ollama
# $1 = system prompt, $2 = user prompt, $3 = think (true/false), $4 = max tokens
ollama_chat() {
  local system_prompt="$1"
  local user_prompt="$2"
  local think="${3:-false}"
  local max_tokens="${4:-500}"
  local model
  model=$(get_model)

  local payload
  payload=$(OLLAMA_MODEL="$model" OLLAMA_USER_PROMPT="$user_prompt" OLLAMA_THINK="$think" OLLAMA_MAX_TOKENS="$max_tokens" python3 -c "
import json, sys, os
system_msg = sys.stdin.read()
data = {
    'model': os.environ['OLLAMA_MODEL'],
    'messages': [
        {'role': 'system', 'content': system_msg},
        {'role': 'user', 'content': os.environ['OLLAMA_USER_PROMPT']},
    ],
    'stream': False,
    'think': os.environ['OLLAMA_THINK'] == 'true',
    'options': {
        'num_predict': int(os.environ['OLLAMA_MAX_TOKENS']),
        'temperature': 0,
    },
}
print(json.dumps(data))
" <<< "$system_prompt")

  local response
  response=$(curl -sf --max-time "$TIMEOUT" "$OLLAMA_URL/api/chat" -d "$payload" 2>/dev/null) \
    || die "Ollama request failed or timed out after ${TIMEOUT}s"

  # Extract content (and thinking if present)
  python3 -c "
import sys, json
d = json.load(sys.stdin)
msg = d.get('message', {})
thinking = msg.get('thinking', '')
content = msg.get('content', '')
duration = d.get('total_duration', 0) / 1e9
tokens = d.get('eval_count', 0)

if thinking and not content:
    print(thinking)
elif content:
    print(content)
else:
    print('[No response generated]')

print(f'\n---\n[Ollama: {d.get(\"model\",\"?\")} | {duration:.1f}s | {tokens} tokens]', file=sys.stderr)
" <<< "$response"
}

# ── Commands ─────────────────────────────────────────────────────────

cmd_status() {
  check_ollama
  local version model
  version=$(curl -sf --max-time 3 "$OLLAMA_URL/api/version" | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','?'))")
  model=$(get_model)

  # Get model details
  local details
  details=$(curl -sf --max-time 5 "$OLLAMA_URL/api/show" -d "{\"model\":\"$model\"}" 2>/dev/null \
    | python3 -c "
import sys,json
d=json.load(sys.stdin)
det = d.get('details',{})
print(f'Family: {det.get(\"family\",\"?\")}')
print(f'Parameters: {det.get(\"parameter_size\",\"?\")}')
print(f'Quantization: {det.get(\"quantization_level\",\"?\")}')
" 2>/dev/null || echo "Could not fetch details")

  # Check if model is loaded in memory
  local loaded
  loaded=$(ollama ps 2>/dev/null | grep -c "$model" || echo "0")

  echo "Ollama v${version} at ${OLLAMA_URL}"
  echo "Model: ${model}"
  echo "$details"
  if [[ "$loaded" -gt 0 ]]; then
    echo "Status: Loaded in memory (fast responses)"
  else
    echo "Status: Not loaded (first request will be slow ~5-10s cold start)"
  fi
}

cmd_query() {
  local prompt="$*"
  [[ -z "$prompt" ]] && die "Usage: ollama.sh query <prompt>"
  check_ollama
  ollama_chat "You are a helpful coding assistant. Be concise and direct. Answer in plain text." "$prompt" "false" "500"
}

cmd_think() {
  local prompt="$*"
  [[ -z "$prompt" ]] && die "Usage: ollama.sh think <prompt>"
  check_ollama
  ollama_chat "You are a helpful coding assistant. Think step by step." "$prompt" "true" "2000"
}

cmd_summarize() {
  local file_path="$1"
  [[ -z "$file_path" ]] && die "Usage: ollama.sh summarize <file_path>"
  [[ ! -f "$file_path" ]] && die "File not found: $file_path"
  check_ollama

  local content
  content=$(head -200 "$file_path")
  local ext="${file_path##*.}"

  ollama_chat \
    "You are a code analysis assistant. Summarize files concisely: purpose, exports, key functions, dependencies. Use bullet points." \
    "Summarize this ${ext} file (${file_path}):\n\n\`\`\`${ext}\n${content}\n\`\`\`" \
    "false" "500"
}

cmd_review() {
  local file_path="$1"
  [[ -z "$file_path" ]] && die "Usage: ollama.sh review <file_path>"
  [[ ! -f "$file_path" ]] && die "File not found: $file_path"
  check_ollama

  local content
  content=$(head -300 "$file_path")
  local ext="${file_path##*.}"

  ollama_chat \
    "You are a senior code reviewer. Identify bugs, security issues, performance problems, and style issues. Be specific with line references. If the code looks good, say so briefly." \
    "Review this ${ext} file (${file_path}):\n\n\`\`\`${ext}\n${content}\n\`\`\`" \
    "false" "800"
}

cmd_diff() {
  local diff_text="$*"
  if [[ -z "$diff_text" ]]; then
    # Read from stdin if no args
    diff_text=$(cat)
  fi
  [[ -z "$diff_text" ]] && die "Usage: ollama.sh diff <diff_text> or pipe diff | ollama.sh diff"
  check_ollama

  ollama_chat \
    "You are a code reviewer analyzing a git diff. Summarize what changed, flag any issues (bugs, security, missing tests), and note if any related code elsewhere might need updating." \
    "Analyze this diff:\n\n\`\`\`diff\n${diff_text}\n\`\`\`" \
    "false" "600"
}

cmd_grep_explain() {
  local pattern="$1"
  local file="$2"
  [[ -z "$pattern" || -z "$file" ]] && die "Usage: ollama.sh grep-explain <pattern> <file>"
  check_ollama

  local matches
  matches=$(grep -n "$pattern" "$file" 2>/dev/null | head -20) || true
  [[ -z "$matches" ]] && die "No matches for '$pattern' in $file"

  ollama_chat \
    "You are a code analysis assistant. Explain what each match means in context." \
    "Explain these grep matches for pattern '${pattern}' in ${file}:\n\n${matches}" \
    "false" "400"
}

# ── Main ─────────────────────────────────────────────────────────────

case "${1:-}" in
  status)       cmd_status ;;
  query)        shift; cmd_query "$@" ;;
  think)        shift; cmd_think "$@" ;;
  summarize)    shift; cmd_summarize "$@" ;;
  review)       shift; cmd_review "$@" ;;
  diff)         shift; cmd_diff "$@" ;;
  grep-explain) shift; cmd_grep_explain "$@" ;;
  *)
    echo "Usage: ollama.sh <command> [args...]"
    echo ""
    echo "Commands:"
    echo "  status                    Check Ollama availability and model info"
    echo "  query    <prompt>         Quick question (no reasoning, fast)"
    echo "  think    <prompt>         Deep question (with reasoning, slower)"
    echo "  summarize <file>          Summarize a file's purpose and structure"
    echo "  review   <file>           Review code for bugs and issues"
    echo "  diff     [diff_text]      Analyze a git diff (or pipe stdin)"
    echo "  grep-explain <pat> <file> Explain grep matches in context"
    exit 1
    ;;
esac
