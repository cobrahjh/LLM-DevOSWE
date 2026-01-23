---
name: ss
description: Save session - commit current work and push to remote
---

# Save Session (Commit & Push)

Commit current work and push to remote repository.

## Process

1. Run `git status` to see changes
2. Run `git diff --stat` to review what changed
3. Stage relevant files (avoid .env, credentials, large binaries)
4. Create commit with descriptive message
5. Push to remote

## Commands

```bash
git status
git diff --stat
git add <specific files>
git commit -m "$(cat <<'EOF'
<commit message>

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
git push
```

## Guidelines

- Don't commit sensitive files (.env, credentials.json, etc.)
- Use descriptive commit messages
- Always include Co-Authored-By line
