/**
 * Example 2: Check Payin Order Status (with Live Callback Recovery)
 *
 * Checks if the order is paid.
 * If the upstream callback was missed or delayed, calling this automatically
 * verifies the live banking network, settles your ledger, and returns the status.
 */
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
  baseUrl: process.env.BLADEPAY_BASE_URL || 'http://localhost:4009',
});

async function run() {
  const orderNo = process.argv[2] || 'ORD-177000123';
  console.log(`Checking transaction status for Order: ${orderNo}...`);

  try {
    const status = await bladePay.payin.getStatus(orderNo);

    console.log('✅ Transaction Status Retrieved:');
    console.log('----------------------------------------------------');
    console.log(`Order Number:     ${status.merchantOrderNo}`);
    console.log(`Gateway Order:    ${status.gatewayOrderNo}`);
    console.log(`Is Paid:          ${status.isPaid ? 'YES (PAID) ✅' : 'NO (PENDING/UNPAID) ⏳'}`);
    console.log(`Status String:    ${status.status}`);
    console.log(`Numeric State:    ${status.payinState} (${status.payinStateName})`);
    console.log(`Amount:           ₹${status.amount}`);
    console.log(`Actual Paid:      ₹${status.actualAmount}`);
    console.log(`Fee Charged:      ₹${status.feeCharged}`);
    console.log(`Settled Amount:   ₹${status.settleAmount}`);
    console.log(`Bank UTR:         ${status.utr || 'N/A'}`);
    console.log(`Created At:       ${status.createdAt}`);
    console.log(`Paid At:          ${status.paidAt || 'N/A'}`);
    console.log('----------------------------------------------------');

    if (status.isPaid) {
      console.log('🎉 Action: You can now safely deliver goods/credits to your customer!');
    } else {
      console.log('⏳ Action: Customer payment is still pending confirmation.');
    }

  } catch (err) {
    console.error('❌ Error checking order status:', err.message);
    if (err.statusCode === 404) {
      console.error('Order not found. Please verify the order number.');
    }
  }
}

run();
