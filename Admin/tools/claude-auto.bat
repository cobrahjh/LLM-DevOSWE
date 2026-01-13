@echo off
REM Run Claude Code with auto-approve (skips permission prompts)
REM Usage: claude-auto.bat [optional args]

claude --dangerously-skip-permissions %*
