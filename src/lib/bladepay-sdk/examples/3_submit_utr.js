/**
 * Example 3: Submit 12-Digit Bank UTR for Order Confirmation
 */
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
  baseUrl: process.env.BLADEPAY_BASE_URL || 'http://localhost:4009',
});

async function run() {
  const orderNo = process.argv[2] || 'ORD-177000123';
  const utr = process.argv[3] || '428712345678';

  console.log(`Submitting UTR ${utr} for order ${orderNo}...`);

  try {
    const res = await bladePay.payin.submitUtr(orderNo, utr);
    console.log('✅ UTR Submitted Successfully:', res);
  } catch (err) {
    console.error('❌ Error submitting UTR:', err.message);
  }
}

run();
