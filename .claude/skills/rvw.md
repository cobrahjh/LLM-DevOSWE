# Review Code

Review code for issues, clean up, and optimize.

1. Identify recently changed files
2. Check for:
   - Unused variables/imports
   - Console.log/debug statements to remove
   - Error handling gaps
   - Security issues (OWASP top 10)
   - Performance concerns
   - Code duplication
3. Suggest improvements
4. Apply fixes if approved

```bash
git diff --name-only HEAD~5  # Recent changes
```
