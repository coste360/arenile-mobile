#!/usr/bin/env bash
# PostToolUse hook for Claude Code (Edit|Write|MultiEdit).
#
# Formats the file that was just edited with the project's Prettier
# (ts/tsx/js/mjs/cjs/json/md/css/yaml). Generated files are skipped.
#
# Formatting is best effort: a missing tool or a formatter error never fails
# the hook (always exit 0), it only prints a note on stderr.
set -u

input="$(cat || true)"

json_file_path() {
	if command -v jq >/dev/null 2>&1; then
		printf '%s' "$1" | jq -r '.tool_input.file_path // .tool_input.path // empty' 2>/dev/null
		return
	fi
	if command -v python3 >/dev/null 2>&1; then
		printf '%s' "$1" | python3 -I -c '
import json, sys
try:
    data = json.load(sys.stdin)
    ti = data.get("tool_input") or {}
    print(ti.get("file_path") or ti.get("path") or "")
except Exception:
    pass
' 2>/dev/null
	fi
}

note() { printf 'format-file.sh: %s\n' "$1" >&2; }

file_path="$(json_file_path "$input")"
[ -n "$file_path" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-}"
if [ -z "$root" ]; then
	root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
fi
root="${root%/}"

case "$file_path" in
/*) abs="$file_path" ;;
*) abs="$root/${file_path#./}" ;;
esac
[ -f "$abs" ] || exit 0

rel="${abs#"$root"/}"

case "$rel" in
src/api/generated/* | api/openapi.yaml | node_modules/* | dist/* | .expo/* | ios/* | android/*)
	exit 0
	;;
*.ts | *.tsx | *.js | *.jsx | *.mjs | *.cjs | *.json | *.md | *.css | *.yaml | *.yml)
	if command -v npx >/dev/null 2>&1 && [ -d "$root/node_modules" ]; then
		(cd "$root" && npx --no-install prettier --write --log-level warn "$abs") >/dev/null 2>&1 ||
			note "prettier unavailable or failed on $rel"
	else
		note "prettier not installed (run make setup), skipping $rel"
	fi
	;;
esac

exit 0
