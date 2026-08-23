---
name: release-package
description: Record and release package changes through the repository's local Bumpy workflow.
---

# Release packages

For a consumer-visible package change, follow
`node_modules/@varlock/bumpy/skills/add-change/SKILL.md` and commit its bump file
with the implementation.

An explicit release request authorizes one command after GitHub reports the
generated `bumpy/version-packages` pull request is green:

```sh
pnpm run release:merge
```

Return to useful work. GitHub owns publication and public verification. Inspect
the workflow only when GitHub reports failure. Never version, publish, dispatch,
or poll locally.
