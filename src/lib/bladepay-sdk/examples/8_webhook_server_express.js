/**
 * Example 8: Webhook Callback Receiver Server
 *
 * Demonstrates how to receive and verify incoming HTTP POST callbacks
 * sent by BladePay using the MD5 signature verification method.
 *
 * Uses native Node.js 'http' server so it runs with ZERO external dependencies!
 */
const http = require('http');
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
});

const PORT = process.env.WEBHOOK_PORT || 5050;

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && (req.url === '/api/webhook' || req.url === '/webhook')) {
    let bodyData = '';

    req.on('data', chunk => {
      bodyData += chunk;
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(bodyData);
        console.log('\n📥 [Webhook Received]:', JSON.stringify(payload, null, 2));

        // 1. Verify MD5 signature using BladePay SDK
        const isSignatureValid = bladePay.webhooks.verifySignature(payload);

        if (!isSignatureValid) {
          console.warn('❌ Invalid Webhook Signature! Rejecting request.');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid signature' }));
          return;
        }

        console.log('✅ Webhook Signature Verified Successfully!');

        // 2. Process based on event type (Payin or Payout)
        if (payload.payinState !== undefined) {
          // Payin event
          console.log(`💳 Payin Event for Order: ${payload.merchantOrderNo}`);
          console.log(`   Amount: ₹${payload.actualAmount || payload.amount}`);
          console.log(`   UTR: ${payload.utr || 'N/A'}`);

          if (payload.payinState === 2) {
            console.log('   Status: SUCCESS! Fulfill customer order in your database.');
          } else {
            console.log(`   Status: State ${payload.payinState}`);
          }

        } else if (payload.cashState !== undefined) {
          // Payout event
          console.log(`🏦 Payout Event for Order: ${payload.merchantOrderNo}`);
          console.log(`   Status: State ${payload.cashState} (4=Success, 3=Failed)`);
          console.log(`   UTR: ${payload.utr || 'N/A'}`);
        }

        // 3. Return SUCCESS response to acknowledge receipt
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('SUCCESS');

      } catch (err) {
        console.error('Error processing webhook:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });

  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Send POST requests to /api/webhook' }));
  }
});

server.listen(PORT, () => {
  console.log(`🚀 BladePay Webhook Receiver running at http://localhost:${PORT}/api/webhook`);
  console.log('Waiting for incoming callbacks...\n');
});
