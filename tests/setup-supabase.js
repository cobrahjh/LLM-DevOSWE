/**
 * SimWidget Supabase Setup
 * 
 * Run this script to test connection and provide setup instructions
 * 
 * Usage: node tests/setup-supabase.js
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\setup-supabase.js
 * Last Updated: 2025-01-08
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Colors
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

// Load environment
const envPath = path.join(__dirname, '../.env.supabase');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

async function main() {
    console.log(`\n${CYAN}${BOLD}SimWidget Supabase Setup${RESET}\n`);
    
    // Check config
    console.log(`${BOLD}Configuration:${RESET}`);
    console.log(`  URL: ${SUPABASE_URL || RED + 'Not set' + RESET}`);
    console.log(`  Key: ${SUPABASE_KEY ? GREEN + '***' + SUPABASE_KEY.slice(-8) + RESET : RED + 'Not set' + RESET}`);
    
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.log(`\n${RED}Missing configuration!${RESET}`);
        console.log(`Create .env.supabase with:`);
        console.log(`  SUPABASE_URL=https://your-project.supabase.co`);
        console.log(`  SUPABASE_ANON_KEY=your-anon-key`);
        process.exit(1);
    }
    
    // Test connection
    console.log(`\n${BOLD}Testing connection...${RESET}`);
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    
    try {
        // Try to select from test_runs
        const { data, error } = await supabase.from('test_runs').select('id').limit(1);
        
        if (error) {
            if (error.message.includes('does not exist') || error.message.includes('schema cache')) {
                console.log(`${YELLOW}Tables not found - need to create them${RESET}`);
                console.log(`\n${BOLD}Run this SQL in Supabase SQL Editor:${RESET}`);
                console.log(`(Dashboard > SQL Editor > New Query)\n`);
                
                const schemaPath = path.join(__dirname, 'supabase-schema.sql');
                if (fs.existsSync(schemaPath)) {
                    console.log(fs.readFileSync(schemaPath, 'utf8'));
                } else {
                    printSchema();
                }
            } else {
                console.log(`${RED}Error: ${error.message}${RESET}`);
            }
        } else {
            console.log(`${GREEN}✓ Connected successfully!${RESET}`);
            console.log(`${GREEN}✓ Tables exist and are accessible${RESET}`);
            
            // Count existing data
            const { count: runCount } = await supabase.from('test_runs').select('*', { count: 'exact', head: true });
            const { count: resultCount } = await supabase.from('test_results').select('*', { count: 'exact', head: true });
            
            console.log(`\n${BOLD}Current data:${RESET}`);
            console.log(`  Test runs: ${runCount || 0}`);
            console.log(`  Test results: ${resultCount || 0}`);
            
            console.log(`\n${GREEN}Supabase is ready!${RESET}`);
            console.log(`Use: node tests/test-runner.js --cloud`);
        }
    } catch (err) {
        console.log(`${RED}Connection failed: ${err.message}${RESET}`);
    }
}

function printSchema() {
    console.log(`
-- Test Runs Table
CREATE TABLE test_runs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    device_id VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INTEGER,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    trigger VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Test Results Table  
CREATE TABLE test_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id UUID REFERENCES test_runs(id) ON DELETE CASCADE,
    device_id VARCHAR(20) NOT NULL,
    test_id VARCHAR(100),
    category VARCHAR(50),
    name VARCHAR(100),
    status VARCHAR(20),
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_runs_device ON test_runs(device_id);
CREATE INDEX idx_runs_timestamp ON test_runs(timestamp DESC);
CREATE INDEX idx_results_run ON test_results(run_id);

-- Enable RLS and allow access
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for test_runs" ON test_runs FOR ALL USING (true);
CREATE POLICY "Allow all for test_results" ON test_results FOR ALL USING (true);
`);
}

main().catch(console.error);
