# Bumpy

This directory contains unreleased entries for [Bumpy](https://bumpy.varlock.dev).

Each bump file maps package names to version levels and contains a changelog entry. Bumpy consumes these files during a release.

## Release flow

1. Create one bump file for each consumer-visible change.
2. If the change grows, update the same file.
3. Keep unreleased bump files on main.

At release time, Bumpy combines the files into a release plan. The plan updates versions and changelogs, then publishes packages.

## Create a bump file

### Interactive command

```bash
pnpm bumpy add
```

### Non-interactive command

```bash
pnpm bumpy add --packages "package-name:minor,other-package:patch" --message "Description of changes" --name "my-change"
```

### Manual file

Create a `.md` file in this directory. Put package names and bump levels in the YAML frontmatter.

Use `major`, `minor`, `patch`, or `none` as each bump level. Put the changelog entry after the frontmatter.

```markdown
---
"package-name": minor
---

Added a new feature.
```

### Conventional Commits

```bash
pnpm bumpy generate
```

### Empty bump file

For a change that does not require a release, create an empty bump file:

```bash
pnpm bumpy add --empty --name "docs-update"
```

## Maintain a bump file

Keep the bump level and description synchronized with the change. If a fix becomes a feature, change the level from patch to minor.

Treat the bump file as part of the change.

## Directory contents

| Path               | Purpose               |
| ------------------ | --------------------- |
| `_config.json`     | Bumpy configuration   |
| `README.md`        | This guide            |
| Other `*.md` files | Unreleased bump files |

Full documentation: https://bumpy.varlock.dev
