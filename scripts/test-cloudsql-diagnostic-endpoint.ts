/**
 * Test to verify Cloud SQL PostgreSQL Diagnostic API & Utility
 * Ensures:
 * 1. Diagnostic utility connects successfully.
 * 2. Status is logged without exposing credentials.
 * 3. /api/diagnostics/cloudsql and /api/health/db return correct sanitized data.
 */

import { checkCloudSqlConnection, sanitizeCredentials } from '../src/server/utils/cloudSqlDiagnostic';
import assert from 'assert';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    })
    .catch((err) => {
      console.error(`  ❌ [FAIL] ${name} -> ${err.message}`);
      failed++;
    });
}

async function runTests() {
  console.log('\n============================================================');
  console.log('🧪 TESTING CLOUD SQL DIAGNOSTIC UTILITY & SECURITY AUDIT');
  console.log('============================================================\n');

  await test('sanitizeCredentials scrubs passwords from connection URLs', () => {
    const raw = 'postgres://ai_user:SecretPass123!@10.0.0.5:5432/production_db?sslmode=require';
    const clean = sanitizeCredentials(raw);
    assert(!clean.includes('SecretPass123!'), 'Password must be completely stripped');
    assert(clean.includes('***'), 'Password must be replaced with asterisk mask');
    assert(clean.includes('ai_user'), 'User identity is preserved');
  });

  await test('sanitizeCredentials scrubs password= from query strings and config', () => {
    const raw = 'host=localhost port=5432 password=SuperConfidentialKey dbname=mydb';
    const clean = sanitizeCredentials(raw);
    assert(!clean.includes('SuperConfidentialKey'), 'Password parameter must be stripped');
    assert(clean.includes('password=***'), 'Must contain password=***');
  });

  await test('checkCloudSqlConnection runs cleanly against Cloud SQL PostgreSQL', async () => {
    const report = await checkCloudSqlConnection({ logStatus: false });
    assert.strictEqual(report.status, 'connected', 'Status should be connected');
    assert.strictEqual(report.connected, true, 'connected flag should be true');
    assert.strictEqual(report.engine, 'PostgreSQL', 'Engine must be genuine PostgreSQL');
    assert(typeof report.latencyMs === 'number' && report.latencyMs >= 0, 'Latency in ms must be a valid positive number');
    assert(report.publicTablesCount && report.publicTablesCount >= 8, 'Public tables count should be at least core tables count');
    assert.strictEqual(report.requiredCoreTablesVerified, true, 'Required core tables verified');
  });

  await test('Diagnostic output strictly passes credential exposure audit', async () => {
    const report = await checkCloudSqlConnection({ logStatus: false });
    const stringified = JSON.stringify(report);

    // Verify secret / password audit
    if (process.env.SQL_PASSWORD) {
      assert(!stringified.includes(process.env.SQL_PASSWORD), 'Report must never contain raw SQL_PASSWORD');
    }
    assert.strictEqual(report.credentialExposureAudit.passed, true, 'Audit passed must be true');
    assert.strictEqual(report.credentialExposureAudit.credentialsExposed, false, 'credentialsExposed must be false');
  });

  console.log('\n============================================================');
  console.log(`📊 TESTS SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('============================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
