/**
 * Example 7: Fetch Real-time Wallet Balance and Volumes
 */
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
  baseUrl: process.env.BLADEPAY_BASE_URL || 'http://localhost:4009',
});

async function run() {
  console.log('Fetching Merchant Balance...');

  try {
    const balance = await bladePay.account.getBalance();

    console.log('✅ Merchant Balance Retrieved:');
    console.log('----------------------------------------------------');
    console.log(`Merchant ID:       ${balance.merchantId}`);
    console.log(`Available Balance: ₹${Number(balance.availableBalance).toLocaleString('en-IN')}`);
    console.log(`Pending Locked:    ₹${Number(balance.pendingBalance).toLocaleString('en-IN')}`);
    console.log(`Total Payin Vol:   ₹${Number(balance.totalPayinVolume).toLocaleString('en-IN')}`);
    console.log(`Total Payout Vol:  ₹${Number(balance.totalPayoutVolume).toLocaleString('en-IN')}`);
    console.log(`Total Fees Paid:   ₹${Number(balance.totalFeeCollected).toLocaleString('en-IN')}`);
    console.log('----------------------------------------------------');

  } catch (err) {
    console.error('❌ Error fetching balance:', err.message);
  }
}

run();
