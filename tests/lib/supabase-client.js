/**
 * SimWidget Supabase Client v1.0.0
 * 
 * Cloud storage for test results and sync
 * 
 * Path: C:\LLM-DevOSWE\SimWidget_Engine\tests\lib\supabase-client.js
 * Last Updated: 2025-01-08
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// Load environment
const envPath = path.join(__dirname, '../../.env.supabase');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
        const [key, value] = line.split('=');
        if (key && value && !key.startsWith('#')) {
            process.env[key.trim()] = value.trim();
        }
    }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

class SupabaseSync {
    constructor() {
        if (!SUPABASE_URL || !SUPABASE_KEY) {
            this.enabled = false;
            console.log('[Supabase] Not configured - cloud sync disabled');
            return;
        }
        
        this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        this.enabled = true;
        this.deviceId = this.getDeviceId();
    }

    /**
     * Get unique device identifier
     */
    getDeviceId() {
        const os = require('os');
        const crypto = require('crypto');
        const id = `${os.hostname()}-${os.platform()}-${os.arch()}`;
        return crypto.createHash('md5').update(id).digest('hex').substring(0, 12);
    }

    /**
     * Check connection to Supabase
     */
    async checkConnection() {
        if (!this.enabled) return { connected: false, reason: 'Not configured' };
        
        try {
            const { data, error } = await this.supabase
                .from('test_runs')
                .select('id')
                .limit(1);
            
            if (error) throw error;
            return { connected: true };
        } catch (err) {
            return { connected: false, reason: err.message };
        }
    }

    /**
     * Upload a test run to cloud
     */
    async uploadRun(run, results = []) {
        if (!this.enabled) return { success: false, reason: 'Not configured' };

        try {
            // Insert run
            const { data: runData, error: runError } = await this.supabase
                .from('test_runs')
                .insert({
                    device_id: this.deviceId,
                    timestamp: run.timestamp,
                    duration_ms: run.duration_ms,
                    passed: run.passed,
                    failed: run.failed,
                    skipped: run.skipped,
                    total: run.total,
                    trigger: run.trigger,
                    notes: run.notes
                })
                .select()
                .single();

            if (runError) throw runError;

            // Insert results if provided
            if (results.length > 0) {
                const resultsToInsert = results.map(r => ({
                    run_id: runData.id,
                    device_id: this.deviceId,
                    test_id: r.test_id,
                    category: r.category,
                    name: r.name,
                    status: r.status,
                    duration_ms: r.duration_ms,
                    error_message: r.error_message
                }));

                const { error: resultsError } = await this.supabase
                    .from('test_results')
                    .insert(resultsToInsert);

                if (resultsError) throw resultsError;
            }

            return { success: true, cloudId: runData.id };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    /**
     * Sync local database to cloud
     */
    async syncToCloud(localDb) {
        if (!this.enabled) return { success: false, reason: 'Not configured' };

        try {
            // Get runs not yet synced (no cloud_id)
            const unsyncedRuns = localDb.db.prepare(`
                SELECT * FROM runs WHERE cloud_id IS NULL ORDER BY timestamp
            `).all();

            let synced = 0;
            for (const run of unsyncedRuns) {
                const results = localDb.db.prepare(`
                    SELECT * FROM results WHERE run_id = ?
                `).all(run.id);

                const uploadResult = await this.uploadRun(run, results);
                
                if (uploadResult.success) {
                    // Mark as synced
                    localDb.db.prepare(`
                        UPDATE runs SET cloud_id = ? WHERE id = ?
                    `).run(uploadResult.cloudId, run.id);
                    synced++;
                }
            }

            return { success: true, synced, total: unsyncedRuns.length };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    /**
     * Get cloud runs for this device
     */
    async getCloudRuns(limit = 50) {
        if (!this.enabled) return { success: false, reason: 'Not configured' };

        try {
            const { data, error } = await this.supabase
                .from('test_runs')
                .select('*')
                .eq('device_id', this.deviceId)
                .order('timestamp', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return { success: true, runs: data };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    /**
     * Get all devices that have uploaded runs
     */
    async getDevices() {
        if (!this.enabled) return { success: false, reason: 'Not configured' };

        try {
            const { data, error } = await this.supabase
                .from('test_runs')
                .select('device_id')
                .order('device_id');

            if (error) throw error;
            
            const devices = [...new Set(data.map(d => d.device_id))];
            return { success: true, devices, current: this.deviceId };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    /**
     * Get aggregated stats from cloud
     */
    async getCloudStats() {
        if (!this.enabled) return { success: false, reason: 'Not configured' };

        try {
            const { data: runs, error: runsError } = await this.supabase
                .from('test_runs')
                .select('id, passed, failed, device_id');

            if (runsError) throw runsError;

            const { data: results, error: resultsError } = await this.supabase
                .from('test_results')
                .select('id');

            if (resultsError) throw resultsError;

            const devices = [...new Set(runs.map(r => r.device_id))];
            const totalPassed = runs.reduce((sum, r) => sum + (r.passed || 0), 0);
            const totalFailed = runs.reduce((sum, r) => sum + (r.failed || 0), 0);

            return {
                success: true,
                stats: {
                    totalRuns: runs.length,
                    totalResults: results.length,
                    totalPassed,
                    totalFailed,
                    passRate: runs.length > 0 ? Math.round((totalPassed / (totalPassed + totalFailed)) * 100) : 0,
                    devices: devices.length
                }
            };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    /**
     * Get failure trends across all devices
     */
    async getCloudTrends(days = 7) {
        if (!this.enabled) return { success: false, reason: 'Not configured' };

        try {
            const since = new Date();
            since.setDate(since.getDate() - days);

            const { data, error } = await this.supabase
                .from('test_runs')
                .select('timestamp, passed, failed, device_id')
                .gte('timestamp', since.toISOString())
                .order('timestamp');

            if (error) throw error;

            // Group by date
            const byDate = {};
            for (const run of data) {
                const date = run.timestamp.split('T')[0];
                if (!byDate[date]) {
                    byDate[date] = { passed: 0, failed: 0, runs: 0 };
                }
                byDate[date].passed += run.passed || 0;
                byDate[date].failed += run.failed || 0;
                byDate[date].runs++;
            }

            return { success: true, trends: byDate };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }

    /**
     * Delete old cloud data (retention cleanup)
     */
    async cleanupOldData(days = 90) {
        if (!this.enabled) return { success: false, reason: 'Not configured' };

        try {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - days);

            const { data, error } = await this.supabase
                .from('test_runs')
                .delete()
                .lt('timestamp', cutoff.toISOString())
                .select();

            if (error) throw error;
            return { success: true, deleted: data.length };
        } catch (err) {
            return { success: false, reason: err.message };
        }
    }
}

module.exports = SupabaseSync;
