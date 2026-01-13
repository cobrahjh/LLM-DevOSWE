-- SimWidget Test Framework - Supabase Schema
-- Version: 1.0.0
-- Last Updated: 2025-01-08
-- 
-- Run this in Supabase SQL Editor to create tables
-- Path: C:\DevClaude\SimWidget_Engine\tests\supabase-schema.sql

-- Test Runs Table
CREATE TABLE IF NOT EXISTS test_runs (
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
CREATE TABLE IF NOT EXISTS test_results (
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_runs_device ON test_runs(device_id);
CREATE INDEX IF NOT EXISTS idx_runs_timestamp ON test_runs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_results_run ON test_results(run_id);
CREATE INDEX IF NOT EXISTS idx_results_status ON test_results(status);
CREATE INDEX IF NOT EXISTS idx_results_category ON test_results(category);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations with anon key (for simplicity)
CREATE POLICY "Allow all for test_runs" ON test_runs FOR ALL USING (true);
CREATE POLICY "Allow all for test_results" ON test_results FOR ALL USING (true);

-- View: Daily summary
CREATE OR REPLACE VIEW daily_summary AS
SELECT 
    DATE(timestamp) as date,
    device_id,
    COUNT(*) as runs,
    SUM(passed) as total_passed,
    SUM(failed) as total_failed,
    SUM(skipped) as total_skipped,
    ROUND(AVG(duration_ms)) as avg_duration_ms
FROM test_runs
GROUP BY DATE(timestamp), device_id
ORDER BY date DESC;

-- View: Test health (pass rate by test)
CREATE OR REPLACE VIEW test_health AS
SELECT 
    category,
    name,
    COUNT(*) as total_runs,
    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passes,
    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
    ROUND(100.0 * SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) / COUNT(*), 1) as pass_rate
FROM test_results
GROUP BY category, name
ORDER BY pass_rate ASC, failures DESC;

-- Function: Cleanup old data
CREATE OR REPLACE FUNCTION cleanup_old_runs(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM test_runs
    WHERE timestamp < NOW() - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
