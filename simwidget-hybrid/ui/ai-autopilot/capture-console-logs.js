/**
 * Capture browser console logs from AI Autopilot page
 * Run: node capture-console-logs.js
 */

const puppeteer = require('puppeteer');

async function captureConsoleLogs() {
    console.log('🔍 Capturing console logs from AI Autopilot...\n');

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        // Capture console messages
        const logs = [];
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            logs.push({ type, text, timestamp: new Date().toISOString() });

            // Print in real-time with colors
            const icon = {
                log: '📝',
                info: 'ℹ️',
                warn: '⚠️',
                error: '❌',
                debug: '🐛'
            }[type] || '💬';

            console.log(`${icon} [${type.toUpperCase()}] ${text}`);
        });

        // Navigate to AI Autopilot
        console.log('🌐 Loading http://192.168.1.42:8080/ui/ai-autopilot/...\n');
        await page.goto('http://192.168.1.42:8080/ui/ai-autopilot/', {
            waitUntil: 'networkidle0',
            timeout: 30000
        });

        // Wait a bit for initialization
        await page.waitForTimeout(3000);

        console.log('\n' + '='.repeat(60));
        console.log('📊 SUMMARY');
        console.log('='.repeat(60) + '\n');

        // Check what modules are loaded
        const moduleStatus = await page.evaluate(() => {
            return {
                ATCController: typeof ATCController !== 'undefined',
                WindCompensation: typeof WindCompensation !== 'undefined',
                LLMAdvisor: typeof LLMAdvisor !== 'undefined',
                RuleEngineCore: typeof RuleEngineCore !== 'undefined',
                RuleEngineGround: typeof RuleEngineGround !== 'undefined',
                widget: typeof window.widget !== 'undefined',
                phase: window.widget?.flightPhase?.phase || 'UNKNOWN',
                conditionalModules: Array.from(window.widget?._conditionalModules || []),
                windCompLoaded: window.widget?._windCompLoaded || false
            };
        });

        console.log('Module Status:');
        console.log(`  RuleEngineCore: ${moduleStatus.RuleEngineCore ? '✅' : '❌'}`);
        console.log(`  ATCController: ${moduleStatus.ATCController ? '✅' : '❌'}`);
        console.log(`  WindCompensation: ${moduleStatus.WindCompensation ? '✅' : '❌'}`);
        console.log(`  LLMAdvisor: ${moduleStatus.LLMAdvisor ? '✅' : '❌'}`);
        console.log(`  RuleEngineGround: ${moduleStatus.RuleEngineGround ? '✅' : '❌'}`);

        console.log('\nWidget State:');
        console.log(`  Widget Initialized: ${moduleStatus.widget ? '✅' : '❌'}`);
        console.log(`  Current Phase: ${moduleStatus.phase}`);
        console.log(`  Conditional Modules Loaded: ${moduleStatus.conditionalModules.join(', ') || 'None'}`);
        console.log(`  Wind Comp Flag: ${moduleStatus.windCompLoaded ? 'Yes' : 'No'}`);

        // Filter and count Phase 2 specific logs
        const phase2Logs = logs.filter(l =>
            l.text.includes('Loaded') &&
            (l.text.includes('ATCController') ||
             l.text.includes('WindCompensation') ||
             l.text.includes('LLMAdvisor') ||
             l.text.includes('module for'))
        );

        console.log('\n🎯 Phase 2 Module Load Messages:');
        if (phase2Logs.length > 0) {
            phase2Logs.forEach(log => {
                console.log(`  ✓ ${log.text}`);
            });
        } else {
            console.log('  (No Phase 2 module load messages found)');
        }

        console.log('\n📈 Analysis:');
        const expectedForTaxi = {
            ATCController: true,
            WindCompensation: false,
            LLMAdvisor: false
        };

        let allCorrect = true;
        if (moduleStatus.phase === 'TAXI' || moduleStatus.phase === 'PREFLIGHT') {
            console.log('  Expected for TAXI/PREFLIGHT phase:');
            for (const [mod, shouldLoad] of Object.entries(expectedForTaxi)) {
                const actual = moduleStatus[mod];
                const matches = actual === shouldLoad;
                allCorrect = allCorrect && matches;
                console.log(`    ${mod}: ${shouldLoad ? 'Should load' : 'Should NOT load'} - ${matches ? '✅ CORRECT' : '❌ WRONG'}`);
            }
        }

        console.log('\n' + '='.repeat(60));
        if (allCorrect && phase2Logs.length > 0) {
            console.log('✅ Phase 2 lazy loading working correctly!');
        } else if (phase2Logs.length === 0) {
            console.log('⚠️  No Phase 2 load messages found - modules may have been loaded before we started monitoring');
        } else {
            console.log('⚠️  Some modules not loading as expected');
        }
        console.log('='.repeat(60) + '\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Run
captureConsoleLogs().catch(console.error);
