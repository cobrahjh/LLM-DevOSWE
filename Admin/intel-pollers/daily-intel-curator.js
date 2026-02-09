/**
 * Daily Intel Curator
 * Collects from 100+ sources, AI-analyzes for Hive relevance, presents for approval
 */

const fs = require('fs');
const path = require('path');

const CONFIG = {
    dataFile: path.join(__dirname, 'intel-curated.json'),
    maxItemsPerSource: 30,
    maxTotalItems: 100,
    ollamaUrl: 'http://localhost:11434',
    lmStudioUrl: 'http://localhost:1234',
    relayUrl: 'http://localhost:8600',
    relevanceThreshold: 60 // Auto-recommend if score >= this
};

// Hive context for AI analysis
const HIVE_CONTEXT = `
You are evaluating tech news/tools for "Hive" - a modular service ecosystem for:
- MSFS 2024 flight simulation widgets and overlays
- AI agent orchestration (Claude Code, local LLMs like Ollama/LM Studio)
- Real-time dashboards and monitoring
- Voice control and accessibility
- WebSocket/REST APIs and message queues

Tech stack: Node.js, Electron, WebSocket, PowerShell, Windows 10/11
Key services: Oracle (LLM backend), Relay (message queue), KittBox (command center), SimWidget (MSFS overlay)

Evaluate if this item would be USEFUL for improving Hive capabilities.
`;

// ============== DATA STORAGE ==============

function loadData() {
    try {
        if (fs.existsSync(CONFIG.dataFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.dataFile, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load data:', e.message);
    }
    return {
        items: [],
        lastFetch: null,
        stats: { total: 0, approved: 0, rejected: 0, pending: 0 }
    };
}

function saveData(data) {
    // Update stats
    data.stats = {
        total: data.items.length,
        approved: data.items.filter(i => i.status === 'approved').length,
        rejected: data.items.filter(i => i.status === 'rejected').length,
        pending: data.items.filter(i => i.status === 'pending').length,
        implemented: data.items.filter(i => i.status === 'implemented').length
    };
    fs.writeFileSync(CONFIG.dataFile, JSON.stringify(data, null, 2));
}

// ============== SOURCE FETCHERS ==============

async function fetchHackerNews() {
    const items = [];
    try {
        // Get top stories
        const topRes = await fetch('https://hacker-news.firebaseio.com/v0/topstories.json');
        const topIds = await topRes.json();

        // Fetch details for top 30
        const fetches = topIds.slice(0, CONFIG.maxItemsPerSource).map(async (id) => {
            try {
                const res = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
                const item = await res.json();
                if (item && item.title && item.url) {
                    return {
                        id: `hn-${id}`,
                        source: 'Hacker News',
                        sourceIcon: '🟧',
                        title: item.title,
                        url: item.url,
                        score: item.score,
                        comments: item.descendants || 0,
                        timestamp: new Date(item.time * 1000).toISOString()
                    };
                }
            } catch (e) { }
            return null;
        });

        const results = await Promise.all(fetches);
        items.push(...results.filter(Boolean));
    } catch (e) {
        console.error('HN fetch error:', e.message);
    }
    return items;
}

async function fetchGitHubTrending() {
    const items = [];
    try {
        // Use GitHub search API for recently created repos with stars
        const res = await fetch('https://api.github.com/search/repositories?q=created:>2026-01-22+stars:>50&sort=stars&order=desc&per_page=30', {
            headers: { 'Accept': 'application/vnd.github.v3+json' }
        });
        const data = await res.json();

        if (data.items) {
            for (const repo of data.items) {
                items.push({
                    id: `gh-${repo.id}`,
                    source: 'GitHub Trending',
                    sourceIcon: '🐙',
                    title: repo.full_name,
                    url: repo.html_url,
                    description: repo.description || '',
                    stars: repo.stargazers_count,
                    language: repo.language,
                    timestamp: repo.created_at
                });
            }
        }
    } catch (e) {
        console.error('GitHub fetch error:', e.message);
    }
    return items;
}

async function fetchGitHubReleases() {
    const items = [];
    // Key repos to watch for releases
    const watchedRepos = [
        'anthropics/anthropic-sdk-python',
        'anthropics/anthropic-sdk-typescript',
        'ollama/ollama',
        'lmstudio-ai/lms',
        'microsoft/flightsimulator-sdk',
        'electron/electron',
        'nodejs/node',
        'PowerShell/PowerShell',
        'microsoft/vscode'
    ];

    for (const repo of watchedRepos) {
        try {
            const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
                headers: { 'Accept': 'application/vnd.github.v3+json' }
            });
            if (res.ok) {
                const release = await res.json();
                // Only include if released in last 7 days
                const releaseDate = new Date(release.published_at);
                const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                if (releaseDate > weekAgo) {
                    items.push({
                        id: `gh-rel-${repo.replace('/', '-')}-${release.id}`,
                        source: 'GitHub Release',
                        sourceIcon: '📦',
                        title: `${repo} ${release.tag_name}`,
                        url: release.html_url,
                        description: release.name || release.body?.slice(0, 200) || '',
                        timestamp: release.published_at
                    });
                }
            }
        } catch (e) { }
    }
    return items;
}

async function fetchReddit() {
    const items = [];
    const subreddits = ['programming', 'LocalLLaMA', 'flightsim', 'node', 'selfhosted'];

    for (const sub of subreddits) {
        try {
            const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=10`, {
                headers: { 'User-Agent': 'HiveIntelBot/1.0' }
            });
            const data = await res.json();

            if (data.data?.children) {
                for (const post of data.data.children) {
                    const p = post.data;
                    if (p.score > 50 && !p.stickied) {
                        items.push({
                            id: `reddit-${p.id}`,
                            source: `r/${sub}`,
                            sourceIcon: '🔴',
                            title: p.title,
                            url: p.url.startsWith('/r/') ? `https://reddit.com${p.url}` : p.url,
                            score: p.score,
                            comments: p.num_comments,
                            timestamp: new Date(p.created_utc * 1000).toISOString()
                        });
                    }
                }
            }
        } catch (e) {
            console.error(`Reddit r/${sub} error:`, e.message);
        }
    }
    return items;
}

async function fetchProductHunt() {
    const items = [];
    try {
        // PH doesn't have a free API, scrape the homepage
        const res = await fetch('https://www.producthunt.com/');
        const html = await res.text();

        // Extract product names and URLs (basic scraping)
        const matches = html.matchAll(/<a[^>]+href="(\/posts\/[^"]+)"[^>]*>([^<]+)</g);
        let count = 0;
        for (const match of matches) {
            if (count >= 15) break;
            const [, path, title] = match;
            if (title.length > 3 && !title.includes('Show')) {
                items.push({
                    id: `ph-${path.replace('/posts/', '')}`,
                    source: 'Product Hunt',
                    sourceIcon: '🐱',
                    title: title.trim(),
                    url: `https://www.producthunt.com${path}`,
                    timestamp: new Date().toISOString()
                });
                count++;
            }
        }
    } catch (e) {
        console.error('PH fetch error:', e.message);
    }
    return items;
}

async function fetchDevTo() {
    const items = [];
    try {
        const res = await fetch('https://dev.to/api/articles?top=7&per_page=20');
        const articles = await res.json();

        for (const article of articles) {
            items.push({
                id: `devto-${article.id}`,
                source: 'Dev.to',
                sourceIcon: '👩‍💻',
                title: article.title,
                url: article.url,
                description: article.description || '',
                tags: article.tag_list || [],
                reactions: article.positive_reactions_count,
                timestamp: article.published_at
            });
        }
    } catch (e) {
        console.error('Dev.to fetch error:', e.message);
    }
    return items;
}

// ============== AI ANALYSIS ==============

async function analyzeWithLLM(item) {
    const prompt = `${HIVE_CONTEXT}

ITEM TO EVALUATE:
Title: ${item.title}
Source: ${item.source}
URL: ${item.url}
Description: ${item.description || 'N/A'}
${item.language ? `Language: ${item.language}` : ''}
${item.tags ? `Tags: ${item.tags.join(', ')}` : ''}

Respond in this EXACT JSON format only:
{
  "relevance": <0-100 score>,
  "recommend": <true or false>,
  "category": "<one of: tool, library, news, tutorial, release, other>",
  "summary": "<1 sentence what it is>",
  "thoughts": "<1-2 sentences on usefulness for Hive, be specific>"
}`;

    // Use Ollama directly (more reliable)
    try {
        const res = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5-coder:7b',
                prompt: prompt,
                stream: false,
                options: { temperature: 0.3, num_predict: 300 }
            })
        });

        if (res.ok) {
            const data = await res.json();
            const content = data.response || '';

            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*?\}/);
            if (jsonMatch) {
                try {
                    const analysis = JSON.parse(jsonMatch[0]);
                    return {
                        relevance: Math.min(100, Math.max(0, parseInt(analysis.relevance) || 50)),
                        recommend: analysis.recommend === true || analysis.recommend === 'true',
                        category: analysis.category || 'other',
                        summary: (analysis.summary || item.title).slice(0, 200),
                        thoughts: (analysis.thoughts || 'No analysis.').slice(0, 300)
                    };
                } catch (parseErr) {
                    console.error('JSON parse error:', parseErr.message);
                }
            }
        }
    } catch (e) {
        console.error('LLM analysis error:', e.message);
    }

    // Fallback: keyword-based scoring
    const keywords = {
        high: ['claude', 'anthropic', 'ollama', 'llm', 'websocket', 'electron', 'node', 'msfs', 'flight', 'dashboard', 'mcp', 'agent'],
        medium: ['api', 'tool', 'cli', 'terminal', 'javascript', 'typescript', 'automation', 'voice', 'tts'],
        low: ['python', 'rust', 'go', 'mobile', 'ios', 'android', 'game', 'crypto', 'blockchain']
    };

    const text = `${item.title} ${item.description || ''} ${item.tags?.join(' ') || ''}`.toLowerCase();
    let score = 40;
    let recommend = false;

    for (const kw of keywords.high) {
        if (text.includes(kw)) { score += 15; recommend = true; }
    }
    for (const kw of keywords.medium) {
        if (text.includes(kw)) { score += 5; }
    }
    for (const kw of keywords.low) {
        if (text.includes(kw)) { score -= 5; }
    }

    return {
        relevance: Math.min(100, Math.max(0, score)),
        recommend: recommend || score >= 60,
        category: 'other',
        summary: (item.description || item.title).slice(0, 200),
        thoughts: 'Auto-scored by keywords (LLM unavailable).'
    };
}

// ============== MAIN COLLECTION ==============

async function collectAndAnalyze(skipAnalysis = false) {
    console.log('🔍 Collecting intel from sources...');

    // Fetch from all sources in parallel
    const [hn, ghTrending, ghReleases, reddit, ph, devto] = await Promise.all([
        fetchHackerNews(),
        fetchGitHubTrending(),
        fetchGitHubReleases(),
        fetchReddit(),
        fetchProductHunt(),
        fetchDevTo()
    ]);

    console.log(`  HN: ${hn.length}, GH Trending: ${ghTrending.length}, GH Releases: ${ghReleases.length}`);
    console.log(`  Reddit: ${reddit.length}, PH: ${ph.length}, Dev.to: ${devto.length}`);

    // Combine and dedupe
    const allItems = [...hn, ...ghTrending, ...ghReleases, ...reddit, ...ph, ...devto];
    const seen = new Set();
    const uniqueItems = allItems.filter(item => {
        const key = item.url || item.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    // Sort by engagement (stars, score, reactions)
    uniqueItems.sort((a, b) => {
        const scoreA = a.stars || a.score || a.reactions || 0;
        const scoreB = b.stars || b.score || b.reactions || 0;
        return scoreB - scoreA;
    });

    // Take top items
    const topItems = uniqueItems.slice(0, CONFIG.maxTotalItems);
    console.log(`📊 Total unique items: ${uniqueItems.length}, processing top ${topItems.length}`);

    // Load existing data to preserve decisions
    const data = loadData();
    const existingIds = new Set(data.items.map(i => i.id));

    // Analyze new items
    const newItems = [];
    for (const item of topItems) {
        if (existingIds.has(item.id)) {
            // Keep existing item with its status
            continue;
        }

        console.log(`  Analyzing: ${item.title.slice(0, 50)}...`);

        let analysis;
        if (skipAnalysis) {
            analysis = {
                relevance: 50,
                recommend: false,
                category: 'other',
                summary: item.description || item.title,
                thoughts: 'Analysis pending.'
            };
        } else {
            analysis = await analyzeWithLLM(item);
        }

        newItems.push({
            ...item,
            ...analysis,
            status: 'pending',
            fetchedAt: new Date().toISOString()
        });
    }

    // Merge with existing (keep decisions, add new)
    const existingPending = data.items.filter(i => i.status !== 'rejected' ||
        new Date(i.fetchedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

    data.items = [...existingPending, ...newItems];
    data.lastFetch = new Date().toISOString();

    // Sort by relevance
    data.items.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

    saveData(data);
    console.log(`✅ Intel updated: ${newItems.length} new items, ${data.items.length} total`);

    return data;
}

// ============== API FUNCTIONS ==============

function getIntelReport(filter = 'pending') {
    const data = loadData();
    let items = data.items;

    if (filter === 'pending') {
        items = items.filter(i => i.status === 'pending');
    } else if (filter === 'approved') {
        items = items.filter(i => i.status === 'approved');
    } else if (filter === 'recommended') {
        items = items.filter(i => i.status === 'pending' && i.recommend);
    }

    return {
        lastFetch: data.lastFetch,
        stats: data.stats,
        items: items.slice(0, 50) // Limit response size
    };
}

function updateItemStatus(itemId, status, notes = '') {
    const data = loadData();
    const item = data.items.find(i => i.id === itemId);

    if (item) {
        item.status = status;
        item.decidedAt = new Date().toISOString();
        if (notes) item.notes = notes;
        saveData(data);
        return { success: true, item };
    }

    return { success: false, error: 'Item not found' };
}

async function queueForImplementation(itemId) {
    const data = loadData();
    const item = data.items.find(i => i.id === itemId);

    if (!item) return { success: false, error: 'Item not found' };

    // Create task in Relay
    try {
        const res = await fetch(`${CONFIG.relayUrl}/api/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Implement: ${item.title}\n\n${item.summary}\n\nSource: ${item.url}\n\nAnalysis: ${item.thoughts}`,
                sessionId: 'intel-curator',
                priority: item.relevance >= 80 ? 'high' : 'normal',
                taskType: item.category || 'other',
                context: {
                    intelId: itemId,
                    category: item.category,
                    relevance: item.relevance,
                    url: item.url
                }
            })
        });

        if (res.ok) {
            item.status = 'queued';
            item.queuedAt = new Date().toISOString();
            saveData(data);
            return { success: true, item };
        }
    } catch (e) {
        console.error('Failed to queue task:', e.message);
    }

    return { success: false, error: 'Failed to create task' };
}

// ============== CLI ==============

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--collect')) {
        const skipAnalysis = args.includes('--skip-analysis');
        collectAndAnalyze(skipAnalysis).then(data => {
            console.log('\nStats:', data.stats);
        });
    } else if (args.includes('--report')) {
        const report = getIntelReport('pending');
        console.log('\n📡 DAILY INTEL REPORT');
        console.log('='.repeat(60));
        console.log(`Last fetch: ${report.lastFetch}`);
        console.log(`Stats: ${report.stats.pending} pending, ${report.stats.approved} approved, ${report.stats.rejected} rejected`);
        console.log('='.repeat(60));

        for (const item of report.items.slice(0, 20)) {
            const thumb = item.recommend ? '👍' : '👎';
            console.log(`\n${thumb} [${item.source}] ${item.title}`);
            console.log(`   ${item.summary}`);
            console.log(`   💭 ${item.thoughts}`);
            console.log(`   📊 Relevance: ${item.relevance}/100 | ${item.url}`);
        }
    } else if (args.includes('--approve')) {
        const id = args[args.indexOf('--approve') + 1];
        const result = updateItemStatus(id, 'approved');
        console.log(result);
    } else if (args.includes('--reject')) {
        const id = args[args.indexOf('--reject') + 1];
        const result = updateItemStatus(id, 'rejected');
        console.log(result);
    } else {
        console.log(`
Daily Intel Curator
===================

Usage:
  node daily-intel-curator.js --collect           # Fetch and analyze intel
  node daily-intel-curator.js --collect --skip-analysis  # Fetch without AI analysis
  node daily-intel-curator.js --report            # Show pending items
  node daily-intel-curator.js --approve <id>      # Approve item
  node daily-intel-curator.js --reject <id>       # Reject item

The curator fetches from:
  - Hacker News (top 30)
  - GitHub Trending & Releases
  - Reddit (programming, LocalLLaMA, flightsim, node, selfhosted)
  - Product Hunt
  - Dev.to

Each item is analyzed by local LLM for Hive relevance.
        `);
    }
}

module.exports = {
    collectAndAnalyze,
    getIntelReport,
    updateItemStatus,
    queueForImplementation
};
