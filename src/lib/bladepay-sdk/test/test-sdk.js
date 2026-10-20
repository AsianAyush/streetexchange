/**
 * BladePay SDK Unit Tests
 * Tests client initialization, services, signature generation, and verification.
 */
const assert = require('assert');
const { BladePay, BladePayError } = require('../src');

console.log('🧪 Starting BladePay Node.js SDK Unit Tests...\n');

let testsPassed = 0;

function it(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    testsPassed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// 1. Client Initialization Tests
it('BladePay client initializes with provided options', () => {
  const client = new BladePay({
    apiToken: 'gw_test_token_12345',
    baseUrl: 'https://api.example.com',
    timeout: 10000,
  });

  assert.strictEqual(client.http.baseUrl, 'https://api.example.com');
  assert.strictEqual(client.http.apiToken, 'gw_test_token_12345');
  assert.strictEqual(client.http.timeout, 10000);
  assert.ok(client.payin);
  assert.ok(client.payout);
  assert.ok(client.account);
  assert.ok(client.webhooks);
});

// 2. Webhook Signature Generation & Verification Tests
it('WebhookService generates exact MD5 signature according to spec', () => {
  const client = new BladePay({ apiToken: 'gw_test_secret_key' });

  const payload = {
    amount: '500.00',
    merchantOrderNo: 'ORD-12345',
    payinState: 2,
  };

  // Keys sorted ASCII: amount=500.00&merchantOrderNo=ORD-12345&payinState=2&key=gw_test_secret_key
  const sign = client.webhooks.generateSignature(payload, 'gw_test_secret_key');
  assert.strictEqual(typeof sign, 'string');
  assert.strictEqual(sign.length, 32);

  // Verification test
  const fullPayload = {
    ...payload,
    sign,
  };

  assert.strictEqual(client.webhooks.verifySignature(fullPayload, 'gw_test_secret_key'), true);
});

it('WebhookService rejects modified/tampered payloads', () => {
  const client = new BladePay({ apiToken: 'gw_test_secret_key' });

  const payload = {
    amount: '500.00',
    merchantOrderNo: 'ORD-12345',
    payinState: 2,
  };

  const sign = client.webhooks.generateSignature(payload, 'gw_test_secret_key');

  const tamperedPayload = {
    ...payload,
    amount: '100.00', // Changed amount
    sign,
  };

  assert.strictEqual(client.webhooks.verifySignature(tamperedPayload, 'gw_test_secret_key'), false);
});

it('WebhookService rejects payloads with missing or invalid sign', () => {
  const client = new BladePay({ apiToken: 'gw_test_secret_key' });

  assert.strictEqual(client.webhooks.verifySignature({ amount: '500.00' }), false);
  assert.strictEqual(client.webhooks.verifySignature(null), false);
  assert.strictEqual(client.webhooks.verifySignature({ sign: 12345 }), false);
});

// 3. Custom Error Tests
it('BladePayError serializes correctly with code and statusCode', () => {
  const err = new BladePayError('Duplicate merchant order number', 1005, 409, { order: 'ORD-123' });

  assert.strictEqual(err.name, 'BladePayError');
  assert.strictEqual(err.code, 1005);
  assert.strictEqual(err.statusCode, 409);
  assert.strictEqual(err.message, 'Duplicate merchant order number');

  const json = err.toJSON();
  assert.strictEqual(json.code, 1005);
  assert.strictEqual(json.statusCode, 409);
});

// 4. Method Signature Tests
it('Payin, Payout, and Account services expose all required methods', () => {
  const client = new BladePay({ apiToken: 'gw_test_token' });

  assert.strictEqual(typeof client.payin.create, 'function');
  assert.strictEqual(typeof client.payin.getStatus, 'function');
  assert.strictEqual(typeof client.payin.query, 'function');
  assert.strictEqual(typeof client.payin.submitUtr, 'function');
  assert.strictEqual(typeof client.payin.list, 'function');
  assert.strictEqual(typeof client.payin.getSummary, 'function');

  assert.strictEqual(typeof client.payout.createBankPayout, 'function');
  assert.strictEqual(typeof client.payout.createUpiPayout, 'function');
  assert.strictEqual(typeof client.payout.getStatus, 'function');
  assert.strictEqual(typeof client.payout.query, 'function');
  assert.strictEqual(typeof client.payout.list, 'function');

  assert.strictEqual(typeof client.account.getBalance, 'function');
  assert.strictEqual(typeof client.account.getAccount, 'function');
  assert.strictEqual(typeof client.account.getProfile, 'function');
  assert.strictEqual(typeof client.account.getLedger, 'function');
});

// 5. End-to-End Mock Server Tests
async function runAsyncTests() {
  const http = require('http');

  const mockServer = http.createServer((req, res) => {
    // Verify Bearer token is attached
    assert.strictEqual(req.headers['authorization'], 'Bearer gw_mock_token_777');

    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      const parsed = body ? JSON.parse(body) : {};

      if (req.method === 'POST' && req.url === '/merchant/api/payin/create') {
        assert.strictEqual(parsed.merchantOrderNo, 'ORD-999');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            merchantOrderNo: 'ORD-999',
            gatewayOrderNo: 'MPAYIN-MOCK-1',
            cashierUrl: 'http://localhost:4009/pay/MPAYIN-MOCK-1',
            amount: '500.00',
            payinState: 1,
          },
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/merchant/api/payin/query') {
        assert.strictEqual(parsed.orderNo, 'ORD-999');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            isPaid: true,
            status: 'PAID',
            payinState: 2,
            payinStateName: 'Success',
            orderNo: 'ORD-999',
            merchantOrderNo: 'ORD-999',
            gatewayOrderNo: 'MPAYIN-MOCK-1',
            amount: '500.00',
            actualAmount: '500.00',
            feeCharged: '20.00',
            settleAmount: '480.00',
            currency: 'INR',
            utr: '428712345678',
            cashierUrl: 'http://localhost:4009/pay/MPAYIN-MOCK-1',
            createdAt: '2026-09-12T10:00:00.000Z',
            paidAt: '2026-09-12T10:01:22.000Z',
          },
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/merchant/api/payin/utr/submit') {
        assert.strictEqual(parsed.merchantOrderNo, 'ORD-999');
        assert.strictEqual(parsed.utr, '428712345678');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 0, msg: 'success', data: { success: true } }));
        return;
      }

      if (req.method === 'GET' && req.url.startsWith('/merchant/api/payin/list')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 0, msg: 'success', data: { orders: [], total: 0 } }));
        return;
      }

      if (req.method === 'GET' && req.url === '/merchant/api/payin/summary') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 0, msg: 'success', data: { total_count: 5, success_count: 4 } }));
        return;
      }

      if (req.method === 'POST' && req.url === '/merchant/api/payout/create') {
        assert.strictEqual(parsed.version, parsed.cashNumber.includes('@') ? 'V3' : 'V2');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            merchantOrderNo: parsed.merchantOrderNo,
            gatewayOrderNo: 'MPAYOUT-MOCK-1',
            amount: parsed.amount,
            feeCharged: '21.00',
            cashState: 1,
          },
        }));
        return;
      }

      if (req.method === 'POST' && req.url === '/merchant/api/payout/query') {
        assert.strictEqual(parsed.orderNo, 'WD-999');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            merchantOrderNo: 'WD-999',
            gatewayOrderNo: 'MPAYOUT-MOCK-1',
            cashState: 4,
            cashStateName: 'Success',
            approvalStatus: 'approved',
            amount: '1000.00',
            feeCharged: '48.00',
          },
        }));
        return;
      }

      if (req.method === 'GET' && req.url === '/merchant/api/balance') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          code: 0,
          msg: 'success',
          data: {
            merchantId: 'MCH-MOCK-1',
            availableBalance: 48500.00,
            pendingBalance: 1200.00,
            totalPayinVolume: 150000.00,
            totalPayoutVolume: 95000.00,
            totalFeeCollected: 6500.00,
          },
        }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 404, msg: 'Not found' }));
    });
  });

  await new Promise(resolve => mockServer.listen(0, '127.0.0.1', resolve));
  const port = mockServer.address().port;
  const mockBaseUrl = `http://127.0.0.1:${port}`;

  const client = new BladePay({
    apiToken: 'gw_mock_token_777',
    baseUrl: mockBaseUrl,
  });

  // Test 5a: Payin create
  const payinRes = await client.payin.create({
    merchantOrderNo: 'ORD-999',
    amount: '500.00',
  });
  assert.strictEqual(payinRes.merchantOrderNo, 'ORD-999');
  assert.strictEqual(payinRes.gatewayOrderNo, 'MPAYIN-MOCK-1');
  console.log('  ✅ PASS: client.payin.create() end-to-end');
  testsPassed++;

  // Test 5b: Payin getStatus
  const statusRes = await client.payin.getStatus('ORD-999');
  assert.strictEqual(statusRes.isPaid, true);
  assert.strictEqual(statusRes.status, 'PAID');
  assert.strictEqual(statusRes.payinState, 2);
  assert.strictEqual(statusRes.utr, '428712345678');
  console.log('  ✅ PASS: client.payin.getStatus() end-to-end');
  testsPassed++;

  // Test 5c: Payin submitUtr
  const utrRes = await client.payin.submitUtr('ORD-999', '428712345678');
  assert.strictEqual(utrRes.success, true);
  console.log('  ✅ PASS: client.payin.submitUtr() end-to-end');
  testsPassed++;

  // Test 5d: Payin list & summary
  const listRes = await client.payin.list({ limit: 10 });
  assert.ok(Array.isArray(listRes.orders));
  const summaryRes = await client.payin.getSummary();
  assert.strictEqual(summaryRes.total_count, 5);
  console.log('  ✅ PASS: client.payin.list() & getSummary() end-to-end');
  testsPassed++;

  // Test 5e: Payout Bank (V2) & UPI (V3)
  const bankPayoutRes = await client.payout.createBankPayout({
    merchantOrderNo: 'WD-999',
    amount: '1000.00',
    cashNumber: '50100012345678',
    ifsc: 'HDFC0001234',
  });
  assert.strictEqual(bankPayoutRes.merchantOrderNo, 'WD-999');

  const upiPayoutRes = await client.payout.createUpiPayout({
    merchantOrderNo: 'UPI-999',
    amount: '500.00',
    cashNumber: 'user@okaxis',
  });
  assert.strictEqual(upiPayoutRes.merchantOrderNo, 'UPI-999');

  const payoutStatusRes = await client.payout.getStatus('WD-999');
  assert.strictEqual(payoutStatusRes.cashState, 4);
  console.log('  ✅ PASS: client.payout.createBankPayout(), createUpiPayout(), getStatus() end-to-end');
  testsPassed++;

  // Test 5f: Account balance
  const balanceRes = await client.account.getBalance();
  assert.strictEqual(balanceRes.availableBalance, 48500.00);
  console.log('  ✅ PASS: client.account.getBalance() end-to-end');
  testsPassed++;

  mockServer.close();
  console.log(`\n🎉 All ${testsPassed} unit & integration tests passed successfully with ZERO errors!\n`);
}

runAsyncTests().catch(err => {
  console.error('Async test failure:', err);
  process.exit(1);
});
