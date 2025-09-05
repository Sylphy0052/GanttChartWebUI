---
description: リリース前チェック & ノート生成。
argument-hint: [version]
allowed-tools: Read(**), Write(**), Bash(git tag:*), Bash(git describe:*), Bash(git log:*)
---
If "$ARGUMENTS" is empty, infer version from the last tag (git describe --tags) and generate for the next patch version.
Use the release-manager subagent to produce checklist/notes.