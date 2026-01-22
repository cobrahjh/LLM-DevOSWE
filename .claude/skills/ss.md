# Save Session (Commit & Push)

Commit current work and push to remote repository.

1. Run `git status` to see changes
2. Run `git diff` to review what changed
3. Stage relevant files (avoid .env, credentials, large binaries)
4. Create commit with descriptive message
5. Push to remote

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
