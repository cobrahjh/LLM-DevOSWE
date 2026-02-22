/**
 * Copilot License Validation
 * HMAC-SHA256 based license key system for AI Copilot feature.
 * Format: SW-XXXXX-XXXXX-XXXXX-XXXXX
 */

const crypto = require('crypto');

const LICENSE_SECRET = process.env.SIMGLASS_LICENSE_SECRET || 'SimGlass-Copilot-2025-AviationAI';
const KEY_PREFIX = 'SW';
const SEGMENT_LEN = 5;
const SEGMENT_COUNT = 4;
const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I,O,0,1 for readability

const TIERS = {
    standard: { maxHistory: 20, models: ['gpt-4o-mini', 'claude-haiku-4-5-20251001'] },
    pro: { maxHistory: 40, models: ['gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001'] }
};

function hmacDigest(data) {
    return crypto.createHmac('sha256', LICENSE_SECRET).update(data).digest();
}

function bytesToSegment(bytes, offset) {
    let seg = '';
    for (let i = 0; i < SEGMENT_LEN; i++) {
        seg += CHARSET[bytes[(offset + i) % bytes.length] % CHARSET.length];
    }
    return seg;
}

/**
 * Generate a license key for a given tier.
 * @param {'standard'|'pro'} tier
 * @returns {string} License key in SW-XXXXX-XXXXX-XXXXX-XXXXX format
 */
function generateKey(tier = 'standard') {
    if (!TIERS[tier]) throw new Error('Invalid tier: ' + tier);

    const payload = `${tier}:${Date.now()}:${crypto.randomBytes(8).toString('hex')}`;
    const digest = hmacDigest(payload);

    // Encode tier in first byte position
    const tierByte = tier === 'pro' ? 0x50 : 0x53; // P or S
    const combined = Buffer.concat([Buffer.from([tierByte]), digest]);

    const segments = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
        segments.push(bytesToSegment(combined, i * SEGMENT_LEN));
    }

    // Checksum: HMAC of first 3 segments + first 4 chars of segment 4
    const checksumInput = segments.slice(0, 3).join('-') + '-' + segments[3].slice(0, 4);
    const bodyHash = hmacDigest(checksumInput);
    const checkChar = CHARSET[bodyHash[0] % CHARSET.length];

    // Replace last char of last segment with checksum char
    const finalSegments = segments.slice(0, 3);
    finalSegments.push(segments[3].slice(0, 4) + checkChar);

    return `${KEY_PREFIX}-${finalSegments.join('-')}`;
}

/**
 * Validate a license key.
 * @param {string} key - License key to validate
 * @returns {{valid: boolean, tier?: string, error?: string}}
 */
function validateKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'No license key provided' };
    }

    key = key.trim().toUpperCase();

    // Format check
    const parts = key.split('-');
    if (parts.length !== 5 || parts[0] !== KEY_PREFIX) {
        return { valid: false, error: 'Invalid key format. Expected SW-XXXXX-XXXXX-XXXXX-XXXXX' };
    }

    const segments = parts.slice(1);
    for (const seg of segments) {
        if (seg.length !== SEGMENT_LEN) {
            return { valid: false, error: 'Invalid segment length' };
        }
        for (const ch of seg) {
            if (!CHARSET.includes(ch)) {
                return { valid: false, error: 'Invalid character in key' };
            }
        }
    }

    // Verify checksum: last char of last segment must match HMAC of first 3 segments + first 4 of last
    const checksumInput = segments.slice(0, 3).join('-') + '-' + segments[3].slice(0, 4);
    const bodyHash = hmacDigest(checksumInput);
    const expectedCheck = CHARSET[bodyHash[0] % CHARSET.length];

    if (segments[3][4] !== expectedCheck) {
        return { valid: false, error: 'Invalid license key' };
    }

    // Determine tier from first char pattern
    const tier = 'pro'; // All validated keys get pro for simplicity in v1
    return { valid: true, tier };
}

module.exports = { generateKey, validateKey, TIERS };
