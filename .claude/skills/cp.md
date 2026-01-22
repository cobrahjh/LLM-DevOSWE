# Commit and Push

Quick commit and push workflow.

1. Check status: `git status`
2. Review changes: `git diff --stat`
3. Stage files: `git add <files>` (avoid secrets, large files)
4. Commit with message:
   ```bash
   git commit -m "$(cat <<'EOF'
   <type>: <description>

   Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
   EOF
   )"
   ```
5. Push: `git push`

Types: feat, fix, docs, chore, refactor, test
