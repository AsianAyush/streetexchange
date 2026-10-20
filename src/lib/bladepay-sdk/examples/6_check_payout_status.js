/**
 * Example 6: Query Payout Withdrawal Status
 */
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
  baseUrl: process.env.BLADEPAY_BASE_URL || 'http://localhost:4009',
});

async function run() {
  const payoutNo = process.argv[2] || 'WD-177000456';
  console.log(`Checking payout status for: ${payoutNo}...`);

  try {
    const status = await bladePay.payout.getStatus(payoutNo);

    console.log('✅ Payout Status Retrieved:');
    console.log('----------------------------------------------------');
    console.log(`Merchant Order No: ${status.merchantOrderNo}`);
    console.log(`Gateway Order No:  ${status.gatewayOrderNo}`);
    console.log(`Status Code:       ${status.cashState} (${status.cashStateName})`);
    console.log(`Approval Status:   ${status.approvalStatus}`);
    console.log(`Amount:            ₹${status.amount}`);
    console.log(`Fee Charged:       ₹${status.feeCharged}`);
    console.log(`Bank UTR:          ${status.utr || 'Pending'}`);
    console.log(`Success Time:      ${status.successTime || 'Pending'}`);
    console.log('----------------------------------------------------');

  } catch (err) {
    console.error('❌ Error querying payout status:', err.message);
  }
}

run();
