/**
 * Example 5: Create a Direct UPI Payout (Version V3)
 * Sends funds directly to a UPI ID / VPA.
 */
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
  baseUrl: process.env.BLADEPAY_BASE_URL || 'http://localhost:4009',
});

async function run() {
  const upiPayoutNo = `UPI-${Date.now()}`;
  console.log(`Initiating UPI Payout: ${upiPayoutNo}...`);

  try {
    const result = await bladePay.payout.createUpiPayout({
      merchantOrderNo: upiPayoutNo,
      amount: '500.00',
      cashNumber: 'recipient@okhdfcbank', // Beneficiary UPI ID
      cashName: 'Jane Smith',
      cashPhone: '9876543210',
      notifyUrl: 'https://webhook.site/your-unique-id',
    });

    console.log('✅ UPI Payout Submitted Successfully!');
    console.log('----------------------------------------------------');
    console.log(`Merchant Payout No: ${result.merchantOrderNo}`);
    console.log(`Gateway Payout No:  ${result.gatewayOrderNo}`);
    console.log(`Amount:             ₹${result.amount}`);
    console.log(`Fee Charged:        ₹${result.feeCharged}`);
    console.log(`Total Deducted:     ₹${result.totalDeducted || result.amount}`);
    console.log('----------------------------------------------------');

  } catch (err) {
    console.error('❌ Error initiating UPI payout:', err.message);
  }
}

run();
