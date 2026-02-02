/**
 * Git Tracker - Track git changes for Dev Tracker
 * Provides git diff, commit info, and file change metrics
 */

const { execSync, exec } = require('child_process');
const path = require('path');

class GitTracker {
    constructor(repoPath = process.cwd()) {
        this.repoPath = repoPath;
    }

    /**
     * Execute git command and return output
     */
    execGit(command, options = {}) {
        try {
            const result = execSync(`git ${command}`, {
                cwd: options.cwd || this.repoPath,
                encoding: 'utf8',
                timeout: 10000,
                shell: true,
                windowsHide: true
            });
            return result.trim();
        } catch (err) {
            if (options.silent) return null;
            console.error(`[GitTracker] Error executing: git ${command}`, err.message);
            return null;
        }
    }

    /**
     * Check if path is a git repository
     */
    isGitRepo(repoPath = this.repoPath) {
        const result = this.execGit('rev-parse --is-inside-work-tree', { cwd: repoPath, silent: false });
        console.log(`[GitTracker] isGitRepo check for ${repoPath}: result="${result}"`);
        return result === 'true';
    }

    /**
     * Get current branch name
     */
    getCurrentBranch() {
        return this.execGit('branch --show-current');
    }

    /**
     * Get the latest commit info
     */
    getLatestCommit() {
        const hash = this.execGit('rev-parse --short HEAD');
        const message = this.execGit('log -1 --format=%s');
        const author = this.execGit('log -1 --format=%an');
        const timestamp = this.execGit('log -1 --format=%aI');

        if (!hash) return null;

        return {
            hash,
            message,
            author,
            timestamp
        };
    }

    /**
     * Get diff stats for a specific file
     */
    getFileDiff(filePath) {
        const stat = this.execGit(`diff --stat -- "${filePath}"`, { silent: true });
        const numstat = this.execGit(`diff --numstat -- "${filePath}"`, { silent: true });

        let linesAdded = 0;
        let linesRemoved = 0;

        if (numstat) {
            const parts = numstat.split(/\s+/);
            linesAdded = parseInt(parts[0]) || 0;
            linesRemoved = parseInt(parts[1]) || 0;
        }

        return {
            path: filePath,
            linesAdded,
            linesRemoved,
            status: this.getFileStatus(filePath)
        };
    }

    /**
     * Get status of a file (modified, added, deleted, untracked)
     */
    getFileStatus(filePath) {
        const status = this.execGit(`status --porcelain -- "${filePath}"`, { silent: true });
        if (!status) return 'unchanged';

        const code = status.substring(0, 2).trim();
        const statusMap = {
            'M': 'modified',
            'A': 'added',
            'D': 'deleted',
            'R': 'renamed',
            'C': 'copied',
            '??': 'untracked',
            'MM': 'modified',
            'AM': 'added'
        };

        return statusMap[code] || 'modified';
    }

    /**
     * Get all changed files with diff stats
     */
    getChangedFiles() {
        const files = [];

        // Get staged + unstaged changes
        const status = this.execGit('status --porcelain', { silent: true });
        if (!status) return files;

        const lines = status.split('\n').filter(l => l.trim());

        for (const line of lines) {
            const filePath = line.substring(3).trim();
            // Handle renamed files (R  old -> new)
            const actualPath = filePath.includes(' -> ') ? filePath.split(' -> ')[1] : filePath;

            const diff = this.getFileDiff(actualPath);
            files.push(diff);
        }

        return files;
    }

    /**
     * Get aggregate metrics for all changed files
     */
    getChangeMetrics() {
        const files = this.getChangedFiles();

        return {
            totalLinesAdded: files.reduce((sum, f) => sum + f.linesAdded, 0),
            totalLinesRemoved: files.reduce((sum, f) => sum + f.linesRemoved, 0),
            filesCreated: files.filter(f => f.status === 'added' || f.status === 'untracked').length,
            filesModified: files.filter(f => f.status === 'modified').length,
            filesDeleted: files.filter(f => f.status === 'deleted').length,
            filesRenamed: files.filter(f => f.status === 'renamed').length,
            totalFiles: files.length
        };
    }

    /**
     * Get recent commits (last N)
     */
    getRecentCommits(count = 10) {
        // Use --pretty=format with quotes for Windows compatibility
        const log = this.execGit(`log -${count} --pretty="format:%H|%h|%s|%an|%aI"`, { silent: false });
        if (!log) return [];

        return log.split('\n').filter(l => l).map(line => {
            const [fullHash, hash, message, author, timestamp] = line.split('|');
            return { fullHash, hash, message, author, timestamp };
        });
    }

    /**
     * Check if there are uncommitted changes
     */
    hasUncommittedChanges() {
        const status = this.execGit('status --porcelain', { silent: true });
        return status && status.length > 0;
    }

    /**
     * Get diff for specific files (for task tracking)
     */
    getTaskFileDiffs(filePaths) {
        const results = [];

        for (const filePath of filePaths) {
            // Try to find the file in the repo
            const fullPath = path.isAbsolute(filePath) ? filePath : path.join(this.repoPath, filePath);
            const relativePath = path.relative(this.repoPath, fullPath);

            const diff = this.getFileDiff(relativePath);
            if (diff.status !== 'unchanged') {
                results.push(diff);
            }
        }

        return results;
    }

    /**
     * Watch for new commits (returns commit if changed since lastHash)
     */
    checkForNewCommit(lastHash) {
        const currentHash = this.execGit('rev-parse --short HEAD');
        if (currentHash && currentHash !== lastHash) {
            return this.getLatestCommit();
        }
        return null;
    }
}

module.exports = GitTracker;
