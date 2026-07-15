#!/usr/bin/env python3
"""
Pre-tool hook: guard against destructive / unsafe git and filesystem operations.

Wired as a Claude Code PreToolUse hook on the Bash matcher (see .claude/settings.json).
Exit code 2 blocks the command; the message on stderr is shown to Claude as feedback.

This is a SPEED BUMP, not a security boundary. It is regex-only and only inspects the
shell command string. It does NOT see Python/Node runtimes, the Write/Edit tools, or
shell indirection (variables, pipes, subshells). Always confirm destructive intent with
the user rather than relying on this hook.

Guards:
  - rm / rm -rf targeting a registered target repo (by directory name)
  - git rm / find ... -delete inside a target repo
  - echo <path> | xargs rm  (pipeline heuristic)
  - git push --force / -f to main / master   (protects the merge gate)
  - git push directly to main / master        (feature-branch-only rule)
"""

import json
import re
import sys

# Directory names of the pipeline's target product repos, guarded against deletion.
# Extend this as more repos are registered in plugins/ai-sdlc/config/repos.yaml.
GUARDED_DIRS = ["ai-sdlc-demo-app", "demo-app"]

DESTRUCTIVE_PATTERNS = [
    # force-push to a protected branch
    r"\bgit\s+push\b.*(--force|-f)\b.*\b(main|master)\b",
    r"\bgit\s+push\b.*\b(main|master)\b.*(--force|-f)\b",
]
for _d in GUARDED_DIRS:
    DESTRUCTIVE_PATTERNS.append(r"\brm\b.*" + re.escape(_d) + r"/")
    DESTRUCTIVE_PATTERNS.append(r"\bgit\s+rm\b.*" + re.escape(_d) + r"/")
    DESTRUCTIVE_PATTERNS.append(r"\bfind\b.*" + re.escape(_d) + r"/.*-delete\b")

_COMPILED = [re.compile(p) for p in DESTRUCTIVE_PATTERNS]

_BAD_PAYLOAD_MSG = (
    "[guard-destructive] Hook payload could not be read or 'command' is not a string.\n"
    "Refusing to run without a verified command string."
)


def extract_command(payload: dict) -> str:
    # Claude Code nests the command under tool_input; some runners pass it top-level.
    if isinstance(payload.get("command"), str):
        return payload["command"]
    ti = payload.get("tool_input")
    if isinstance(ti, dict) and isinstance(ti.get("command"), str):
        return ti["command"]
    return ""


def is_destructive(command: str) -> bool:
    if any(p.search(command) for p in _COMPILED):
        return True
    if any(d + "/" in command for d in GUARDED_DIRS) and re.search(r"\bxargs\b", command) and re.search(r"\brm\b", command):
        return True
    return False


def main():
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print(_BAD_PAYLOAD_MSG, file=sys.stderr)
        sys.exit(2)

    if not isinstance(payload, dict):
        print(_BAD_PAYLOAD_MSG, file=sys.stderr)
        sys.exit(2)

    command = extract_command(payload)
    # Empty command → nothing to inspect; let it through (Claude Code will still run its own checks).
    if command and is_destructive(command):
        print(
            "[guard-destructive] Potentially destructive or protected-branch operation detected.\n"
            "This could delete files under a target repo or force/push to a protected branch.\n"
            "Confirm with the user before proceeding. Generated code belongs on feature branches;\n"
            "main is merged only through the /sdlc:ship gate.",
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
