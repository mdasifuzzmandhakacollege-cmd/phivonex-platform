let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string, detail?: string) {
  if (condition) {
    console.log(`  [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${desc}${detail ? ` -> ${detail}` : ''}`);
    failed++;
  }
}

async function runLiveHttpTests() {
  console.log('====================================================');
  console.log('PHIVONEX LIVE HTTP API & RUNTIME VERIFICATION');
  console.log('====================================================\n');

  const baseUrl = 'http://localhost:3000';

  // 1. Health & Node Stats (Public)
  console.log('--- 1. Public Endpoints ---');
  const healthRes = await fetch(`${baseUrl}/api/health`);
  assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');

  const statsRes = await fetch(`${baseUrl}/api/nodes/stats`);
  assert(statsRes.status === 200, 'GET /api/nodes/stats returns HTTP 200');
  const statsData = await statsRes.json();
  assert(statsData.genesisCap === 10000, 'Stats genesisCap is exactly 10000');
  assert(
    statsData.available + statsData.reserved + statsData.active + statsData.retired === 10000,
    'Stats total supply matches 10,000 invariant'
  );

  // 2. Auth Flow (Register & Session Cookie)
  console.log('\n--- 2. Auth Flow & Session Verification ---');
  const testEmail = `operator_http_${Date.now()}@phivonex.test`;
  const regRes = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: 'Alice Operator',
      email: testEmail,
      phone: '+14155550199',
      country: 'United States',
      password: 'StrongPassword123!',
      confirmPassword: 'StrongPassword123!',
    }),
  });

  assert(regRes.status === 201, `POST /api/auth/register returns HTTP 201 (Status: ${regRes.status})`);
  const regCookie = regRes.headers.get('set-cookie');
  assert(Boolean(regCookie), 'Registration returned session cookie');

  const cookieHeader = regCookie ? regCookie.split(';')[0] : '';

  // 3. Authenticated Endpoints
  console.log('\n--- 3. Authenticated User Endpoints ---');
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookieHeader },
  });
  assert(meRes.status === 200, 'GET /api/auth/me returns HTTP 200');
  const meData = await meRes.json();
  assert(Boolean(meData.user?.publicId), `User public ID exists (${meData.user?.publicId})`);

  // Nodes Me
  const myNodesRes = await fetch(`${baseUrl}/api/nodes/me`, {
    headers: { Cookie: cookieHeader },
  });
  assert(myNodesRes.status === 200, 'GET /api/nodes/me returns HTTP 200');

  // Network Summary
  const netSummaryRes = await fetch(`${baseUrl}/api/network/summary`, {
    headers: { Cookie: cookieHeader },
  });
  assert(netSummaryRes.status === 200, 'GET /api/network/summary returns HTTP 200');
  const netSummaryData = await netSummaryRes.json();
  assert(typeof netSummaryData.directReferrals === 'number', 'Network summary returns numeric directReferrals');
  assert(typeof netSummaryData.placedMembers === 'number', 'Network summary returns numeric placedMembers');

  // Network Tree
  const netTreeRes = await fetch(`${baseUrl}/api/network/tree?depth=3`, {
    headers: { Cookie: cookieHeader },
  });
  assert(netTreeRes.status === 200, 'GET /api/network/tree returns HTTP 200');
  const treeData = await netTreeRes.json();
  assert(Boolean(treeData.tree?.user?.publicId), 'Network tree returns root user publicId');

  // Network Unplaced
  const netUnplacedRes = await fetch(`${baseUrl}/api/network/unplaced`, {
    headers: { Cookie: cookieHeader },
  });
  assert(netUnplacedRes.status === 200, 'GET /api/network/unplaced returns HTTP 200');

  // Direct Referrals
  const directRefRes = await fetch(`${baseUrl}/api/referrals/direct`, {
    headers: { Cookie: cookieHeader },
  });
  assert(directRefRes.status === 200, 'GET /api/referrals/direct returns HTTP 200');

  // Referral Commissions
  const commMeRes = await fetch(`${baseUrl}/api/referral-commissions/me`, {
    headers: { Cookie: cookieHeader },
  });
  assert(commMeRes.status === 200, 'GET /api/referral-commissions/me returns HTTP 200');
  const commData = await commMeRes.json();
  assert(commData.totalEarnedUsd === 0, 'New user commission total is 0 USD');

  // Task #10: Network Volume Summary
  const volSummaryRes = await fetch(`${baseUrl}/api/network/volume-summary`, {
    headers: { Cookie: cookieHeader },
  });
  assert(volSummaryRes.status === 200, 'GET /api/network/volume-summary returns HTTP 200');
  const volSummaryData = await volSummaryRes.json();
  assert(typeof volSummaryData.businessDate === 'string', 'Volume summary returns businessDate string');
  assert(typeof volSummaryData.today?.left === 'number', 'Volume summary returns numeric today.left');
  assert(typeof volSummaryData.today?.right === 'number', 'Volume summary returns numeric today.right');
  assert(typeof volSummaryData.carry?.left === 'number', 'Volume summary returns numeric carry.left');
  assert(typeof volSummaryData.carry?.right === 'number', 'Volume summary returns numeric carry.right');
  assert(typeof volSummaryData.availableForFutureMatching?.left === 'number', 'Volume summary returns numeric availableForFutureMatching.left');
  assert(typeof volSummaryData.availableForFutureMatching?.right === 'number', 'Volume summary returns numeric availableForFutureMatching.right');

  // Task #10: Network Volume History
  const volHistoryRes = await fetch(`${baseUrl}/api/network/volume-history?page=1&limit=10`, {
    headers: { Cookie: cookieHeader },
  });
  assert(volHistoryRes.status === 200, 'GET /api/network/volume-history returns HTTP 200');
  const volHistoryData = await volHistoryRes.json();
  assert(Array.isArray(volHistoryData.history), 'Volume history returns an array');
  assert(typeof volHistoryData.pagination?.page === 'number', 'Volume history returns pagination object');

  console.log('\n====================================================');
  console.log(`LIVE HTTP VERIFICATION: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runLiveHttpTests().catch((err) => {
  console.error('[Live HTTP Test Error]', err);
  process.exit(1);
});
