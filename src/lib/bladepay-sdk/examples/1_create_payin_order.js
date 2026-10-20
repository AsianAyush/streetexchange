/**
 * Example 1: Create a Payin Collection Order
 * Generates a branded cashier link for your customer to complete UPI / QR payment.
 */
const { BladePay } = require('../src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN || 'gw_your_api_token_here',
  baseUrl: process.env.BLADEPAY_BASE_URL || 'http://localhost:4009',
});

async function run() {
  try {
    const orderNo = `ORD-${Date.now()}`;
    console.log(`Creating Payin order: ${orderNo}...`);

    const result = await bladePay.payin.create({
      merchantOrderNo: orderNo,
      amount: '500.00',
      currency: 'INR',
      payinName: 'John Doe',
      payinPhone: '9876543210',
      payinEmail: 'john@example.com',
      notifyUrl: 'https://webhook.site/your-unique-id',
      returnUrl: 'https://yourdomain.com/payment-success',
      mark: 'Order checkout demonstration',
    });

    console.log('✅ Payin Order Created Successfully!');
    console.log('----------------------------------------------------');
    console.log(`Merchant Order No: ${result.merchantOrderNo}`);
    console.log(`Gateway Order No:  ${result.gatewayOrderNo}`);
    console.log(`Amount:            ₹${result.amount}`);
    console.log(`Cashier URL:       ${result.cashierUrl}`);
    console.log('----------------------------------------------------');
    console.log('Provide the Cashier URL above to your user to collect payment.');

  } catch (err) {
    console.error('❌ Error creating payin order:', err.message);
    if (err.code) console.error('BladePay Error Code:', err.code);
  }
}

run();
