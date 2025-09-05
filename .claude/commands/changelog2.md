---
description: Gitログからリリースノートを生成し、破壊的変更・移行手順・検証を列挙。
argument-hint: [vX.Y.Z]
allowed-tools: Bash(git log:*), Bash(git tag:*), Read(**), Write(**)
---
Use the release-manager subagent to draft a release note for "$ARGUMENTS" including validations and rollback steps.