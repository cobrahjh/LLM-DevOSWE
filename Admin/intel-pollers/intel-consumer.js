/**
 * Intel Consumer - Automated consumption of approved intel reports
 * - Generates daily briefings from approved items
 * - Auto-queues high-priority items for implementation
 * - Tracks what's been consumed to avoid duplicates
 *
 * Run: node intel-consumer.js --brief    # Generate briefing
 *      node intel-consumer.js --auto     # Auto-queue high priority
 *      node intel-consumer.js --consume  # Full consumption (brief + queue)
 */

const fs = require('fs');
const path = require('path');
const intelCurator = require('./daily-intel-curator');

const CONFIG = {
    consumedFile: path.join(__dirname, 'intel-consumed.json'),
    briefingFile: path.join(__dirname, 'intel-briefing.md'),
    relayUrl: 'http://localhost:8600',
    ollamaUrl: 'http://localhost:11434',
    autoQueueThreshold: 95, // Auto-queue items with relevance >= 95 (raised from 85 to reduce dead letter noise)
    briefingDays: 7, // Include approved items from last N days
};

// ============== CONSUMPTION TRACKING ==============

function loadConsumed() {
    try {
        if (fs.existsSync(CONFIG.consumedFile)) {
            return JSON.parse(fs.readFileSync(CONFIG.consumedFile, 'utf8'));
        }
    } catch (e) {
        console.error('Failed to load consumed data:', e.message);
    }
    return {
        briefings: [],
        queued: [],
        lastBriefing: null,
        lastAutoQueue: null
    };
}

function saveConsumed(data) {
    fs.writeFileSync(CONFIG.consumedFile, JSON.stringify(data, null, 2));
}

// ============== BRIEFING GENERATION ==============

async function generateBriefing(options = {}) {
    const { forceLLM = false, days = CONFIG.briefingDays } = options;

    console.log(`📰 Generating intel briefing (last ${days} days)...`);

    // Get approved items from last N days
    const report = intelCurator.getIntelReport('approved');
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const recentItems = report.items.filter(item => {
        const decidedDate = new Date(item.decidedAt || item.fetchedAt);
        return decidedDate >= cutoff;
    });

    if (recentItems.length === 0) {
        console.log('ℹ No approved items in the last', days, 'days');
        return { success: false, reason: 'no_items' };
    }

    console.log(`  Found ${recentItems.length} approved items`);

    // Group by category
    const byCategory = {};
    for (const item of recentItems) {
        const cat = item.category || 'other';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(item);
    }

    // Generate briefing content
    let briefing = `# Hive Intel Briefing\n`;
    briefing += `**Generated**: ${new Date().toLocaleString()}\n`;
    briefing += `**Period**: Last ${days} days (${recentItems.length} approved items)\n\n`;
    briefing += `---\n\n`;

    // Executive summary
    briefing += `## Executive Summary\n\n`;
    const categoryNames = {
        tool: 'New Tools',
        library: 'Libraries & SDKs',
        release: 'Software Releases',
        tutorial: 'Tutorials & Guides',
        news: 'Industry News',
        other: 'Other'
    };

    for (const [cat, items] of Object.entries(byCategory)) {
        briefing += `- **${categoryNames[cat] || cat}**: ${items.length} items\n`;
    }

    // High-priority highlights
    const highPriority = recentItems.filter(i => i.relevance >= 80);
    if (highPriority.length > 0) {
        briefing += `\n⭐ **${highPriority.length} high-priority items** (relevance ≥ 80)\n`;
    }

    briefing += `\n---\n\n`;

    // Detailed sections by category
    const categoryOrder = ['tool', 'library', 'release', 'tutorial', 'news', 'other'];
    for (const cat of categoryOrder) {
        const items = byCategory[cat];
        if (!items || items.length === 0) continue;

        briefing += `## ${categoryNames[cat] || cat}\n\n`;

        // Sort by relevance
        items.sort((a, b) => (b.relevance || 0) - (a.relevance || 0));

        for (const item of items) {
            const priority = item.relevance >= 85 ? '🔴' : item.relevance >= 70 ? '🟡' : '🟢';
            briefing += `### ${priority} ${item.title}\n`;
            briefing += `**Source**: ${item.source} | **Relevance**: ${item.relevance}/100\n\n`;
            briefing += `${item.summary}\n\n`;
            briefing += `**Analysis**: ${item.thoughts}\n\n`;
            briefing += `**URL**: ${item.url}\n\n`;

            // Implementation status
            if (item.status === 'queued') {
                briefing += `**Status**: ✅ Queued for implementation\n\n`;
            } else if (item.status === 'implemented') {
                briefing += `**Status**: ✅ Implemented\n\n`;
            }

            briefing += `---\n\n`;
        }
    }

    // AI-generated insights (optional)
    if (forceLLM) {
        briefing += await generateInsights(recentItems);
    }

    // Action items
    briefing += `## Recommended Actions\n\n`;
    const unqueued = recentItems.filter(i => i.status === 'approved' && i.relevance >= 75);
    if (unqueued.length > 0) {
        briefing += `**Queue for Implementation** (${unqueued.length} items):\n`;
        for (const item of unqueued.slice(0, 5)) {
            briefing += `- [ ] ${item.title} (relevance: ${item.relevance})\n`;
        }
        briefing += `\n`;
    }

    const toExplore = recentItems.filter(i => i.category === 'tutorial' || i.category === 'news');
    if (toExplore.length > 0) {
        briefing += `**Explore & Learn** (${toExplore.length} items):\n`;
        for (const item of toExplore.slice(0, 3)) {
            briefing += `- [ ] ${item.title}\n`;
        }
        briefing += `\n`;
    }

    // Save briefing
    fs.writeFileSync(CONFIG.briefingFile, briefing);
    console.log(`✅ Briefing saved: ${CONFIG.briefingFile}`);

    // Track this briefing
    const consumed = loadConsumed();
    consumed.briefings.push({
        timestamp: new Date().toISOString(),
        itemCount: recentItems.length,
        categories: Object.keys(byCategory),
        file: CONFIG.briefingFile
    });
    consumed.lastBriefing = new Date().toISOString();
    saveConsumed(consumed);

    return {
        success: true,
        itemCount: recentItems.length,
        file: CONFIG.briefingFile,
        briefing: briefing
    };
}

async function generateInsights(items) {
    console.log('  Generating AI insights...');

    const itemList = items.slice(0, 10).map(i =>
        `- ${i.title} (${i.category}, relevance: ${i.relevance})`
    ).join('\n');

    const prompt = `Review these approved tech items for the Hive ecosystem:

${itemList}

Provide 2-3 key insights about:
1. Common themes or trends
2. Strategic opportunities for Hive
3. Potential integration synergies

Keep it concise (3-4 sentences total).`;

    try {
        const res = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'qwen2.5-coder:7b',
                prompt: prompt,
                stream: false,
                options: { temperature: 0.5, num_predict: 200 }
            })
        });

        if (res.ok) {
            const data = await res.json();
            return `## AI-Generated Insights\n\n${data.response}\n\n---\n\n`;
        }
    } catch (e) {
        console.error('  LLM insights failed:', e.message);
    }

    return '';
}

// ============== AUTO-QUEUEING ==============

async function autoQueueHighPriority(options = {}) {
    const { threshold = CONFIG.autoQueueThreshold, dryRun = false } = options;

    console.log(`🤖 Auto-queueing items with relevance >= ${threshold}...`);

    // Get approved items that aren't already queued
    const report = intelCurator.getIntelReport('approved');
    const toQueue = report.items.filter(i =>
        i.relevance >= threshold &&
        i.status === 'approved' &&
        !['queued', 'implemented'].includes(i.status)
    );

    if (toQueue.length === 0) {
        console.log('ℹ No high-priority items to queue');
        return { success: true, queued: 0 };
    }

    console.log(`  Found ${toQueue.length} items to queue`);

    const consumed = loadConsumed();
    const results = [];

    for (const item of toQueue) {
        // Check if already consumed
        if (consumed.queued.includes(item.id)) {
            console.log(`  ⏭️  Skipping ${item.title} (already queued)`);
            continue;
        }

        if (dryRun) {
            console.log(`  🔍 Would queue: ${item.title} (${item.relevance})`);
            results.push({ item, queued: false, dryRun: true });
            continue;
        }

        console.log(`  📋 Queueing: ${item.title} (${item.relevance})`);
        const result = await intelCurator.queueForImplementation(item.id);

        if (result.success) {
            consumed.queued.push(item.id);
            results.push({ item, queued: true });
            console.log(`     ✅ Queued successfully`);
        } else {
            console.log(`     ❌ Failed: ${result.error}`);
            results.push({ item, queued: false, error: result.error });
        }
    }

    if (!dryRun) {
        consumed.lastAutoQueue = new Date().toISOString();
        saveConsumed(consumed);
    }

    const queuedCount = results.filter(r => r.queued).length;
    console.log(`✅ Auto-queue complete: ${queuedCount}/${toQueue.length} items queued`);

    return {
        success: true,
        total: toQueue.length,
        queued: queuedCount,
        results: results
    };
}

// ============== FULL CONSUMPTION ==============

async function consumeIntel(options = {}) {
    console.log('🔄 Starting full intel consumption...\n');

    const results = {
        briefing: null,
        autoQueue: null,
        timestamp: new Date().toISOString()
    };

    // Generate briefing
    results.briefing = await generateBriefing(options);
    console.log('');

    // Auto-queue high priority
    results.autoQueue = await autoQueueHighPriority(options);
    console.log('');

    console.log('✅ Intel consumption complete!');
    console.log('   Briefing:', results.briefing.success ? CONFIG.briefingFile : 'skipped');
    console.log('   Queued:', results.autoQueue.queued || 0, 'items');

    return results;
}

// ============== STATUS REPORTING ==============

function getConsumptionStatus() {
    const consumed = loadConsumed();
    const report = intelCurator.getIntelReport('approved');

    return {
        lastBriefing: consumed.lastBriefing,
        lastAutoQueue: consumed.lastAutoQueue,
        totalBriefings: consumed.briefings.length,
        totalQueued: consumed.queued.length,
        approvedItems: report.items.length,
        unqueuedHighPriority: report.items.filter(i =>
            i.relevance >= CONFIG.autoQueueThreshold &&
            i.status === 'approved' &&
            !consumed.queued.includes(i.id)
        ).length
    };
}

// ============== CLI ==============

if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.includes('--brief')) {
        const days = args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) : undefined;
        const forceLLM = args.includes('--llm');
        generateBriefing({ days, forceLLM }).then(result => {
            if (result.success) {
                console.log('\nView briefing:', result.file);
            }
        });
    } else if (args.includes('--auto')) {
        const threshold = args.includes('--threshold') ? parseInt(args[args.indexOf('--threshold') + 1]) : undefined;
        const dryRun = args.includes('--dry-run');
        autoQueueHighPriority({ threshold, dryRun });
    } else if (args.includes('--consume')) {
        consumeIntel();
    } else if (args.includes('--status')) {
        const status = getConsumptionStatus();
        console.log('\n📊 INTEL CONSUMPTION STATUS');
        console.log('='.repeat(60));
        console.log('Last briefing:', status.lastBriefing || 'Never');
        console.log('Last auto-queue:', status.lastAutoQueue || 'Never');
        console.log('Total briefings:', status.totalBriefings);
        console.log('Total queued:', status.totalQueued);
        console.log('Approved items:', status.approvedItems);
        console.log('Unqueued high-priority:', status.unqueuedHighPriority);
        console.log('='.repeat(60));
    } else {
        console.log(`
Intel Consumer - Automated Consumption of Approved Intel
=========================================================

Usage:
  node intel-consumer.js --brief              # Generate briefing from approved items
  node intel-consumer.js --brief --days 14    # Briefing from last 14 days
  node intel-consumer.js --brief --llm        # Add AI-generated insights

  node intel-consumer.js --auto               # Auto-queue high-priority items (≥85)
  node intel-consumer.js --auto --threshold 90  # Custom threshold
  node intel-consumer.js --auto --dry-run     # Show what would be queued

  node intel-consumer.js --consume            # Full consumption (briefing + auto-queue)
  node intel-consumer.js --status             # Show consumption status

Configuration:
  - Auto-queue threshold: ${CONFIG.autoQueueThreshold}
  - Briefing period: ${CONFIG.briefingDays} days
  - Briefing file: ${CONFIG.briefingFile}
  - Tracking file: ${CONFIG.consumedFile}

Examples:
  node intel-consumer.js --brief               # Generate weekly briefing
  node intel-consumer.js --auto --dry-run      # Preview auto-queue
  node intel-consumer.js --consume             # Daily consumption routine
        `);
    }
}

module.exports = {
    generateBriefing,
    autoQueueHighPriority,
    consumeIntel,
    getConsumptionStatus
};
