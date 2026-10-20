/**
 * Example 4: Create a Bank Account Payout (IMPS / NEFT - Version V2)
 */
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
  baseUrl: process.env.BLADEPAY_BASE_URL || 'http://localhost:4009',
});

async function run() {
  const payoutNo = `WD-${Date.now()}`;
  console.log(`Initiating Bank Payout: ${payoutNo}...`);

  try {
    const result = await bladePay.payout.createBankPayout({
      merchantOrderNo: payoutNo,
      amount: '1000.00',
      cashName: 'Jane Smith',
      cashPhone: '9876543210',
      cashNumber: '50100012345678', // Bank Account Number
      ifsc: 'HDFC0001234',            // Bank IFSC Code
      bankName: 'HDFC Bank',
      notifyUrl: 'https://webhook.site/your-unique-id',
    });

    console.log('✅ Payout Request Submitted Successfully!');
    console.log('----------------------------------------------------');
    console.log(`Merchant Payout No: ${result.merchantOrderNo}`);
    console.log(`Gateway Payout No:  ${result.gatewayOrderNo}`);
    console.log(`Amount:             ₹${result.amount}`);
    console.log(`Fee Charged:        ₹${result.feeCharged}`);
    console.log(`Status:             ${result.cashState === 1 ? 'Created & Processing' : 'Pending'}`);
    console.log('----------------------------------------------------');

  } catch (err) {
    console.error('❌ Error initiating bank payout:', err.message);
    if (err.code === 1004) console.error('Reason: Insufficient merchant wallet balance.');
  }
}

run();
