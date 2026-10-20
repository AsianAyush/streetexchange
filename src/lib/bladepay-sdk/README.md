# BladePay Node.js SDK & Developer Kit

The official Node.js Developer Kit & SDK for the **BladePay Payment Gateway Aggregator Engine**.  
Designed for sub-merchants to seamlessly integrate collections (UPI / QR), payouts (Bank IMPS / UPI VPA), real-time order status verification, and webhook signature verification into their applications.

---

## 📦 Features

- **⚡ Zero External Dependencies**: Uses native Node.js (18+) `fetch` and `crypto`. No heavy third-party packages required.
- **🛡️ Live Missed Callback Recovery**: The `payin.getStatus()` method automatically queries the upstream banking network in real-time if a payment is still pending, automatically settling your wallet ledger if paid.
- **💳 Multi-Tier Collections (Payin)**: Instant branded cashier link generation for UPI and QR payments.
- **🏦 Automated Payouts**: Bank Transfer (IMPS / NEFT - V2) and Direct UPI ID Payouts (V3).
- **🔒 Webhook MD5 Verification**: Timing-safe verification of incoming gateway webhook notifications.
- **📘 100% TypeScript Ready**: Includes complete `.d.ts` declaration files for VS Code and TypeScript auto-completion.

---

## 🚀 Quickstart

### 1. Installation

You can copy the `bladepay-node-sdk` folder directly into your project or install it locally:

```bash
# Optional: Link locally
cd bladepay-node-sdk
npm link
```

### 2. Initialization

```javascript
const { BladePay } = require('./src'); // or require('bladepay-sdk')

const bladePay = new BladePay({
  apiToken: 'gw_your_merchant_api_token_here',
  baseUrl: 'http://localhost:4009', // Your BladePay Gateway endpoint
  timeout: 15000,                  // Optional: 15s timeout
});
```

---

## 📖 API Usage & Examples

### 1. Collections (Payin API)

#### Create a Payment Order (Generate Cashier Link)
```javascript
const result = await bladePay.payin.create({
  merchantOrderNo: `ORD-${Date.now()}`,
  amount: '500.00',
  currency: 'INR',
  payinName: 'John Doe',
  payinPhone: '9876543210',
  payinEmail: 'john@example.com',
  notifyUrl: 'https://yourdomain.com/api/payin-webhook',
  returnUrl: 'https://yourdomain.com/payment-success',
});

console.log('Cashier Payment URL:', result.cashierUrl);
// Direct your customer to result.cashierUrl
```

#### Check Order Transaction Status (with Callback Recovery)
```javascript
const status = await bladePay.payin.getStatus('ORD-177000123');

if (status.isPaid) {
  console.log(`Order is PAID! Amount: ₹${status.actualAmount}, UTR: ${status.utr}`);
  // Fulfill order in your database
} else {
  console.log(`Order status is ${status.status} (${status.payinStateName})`);
}
```

#### Submit 12-Digit Bank UTR Confirmation
```javascript
const res = await bladePay.payin.submitUtr('ORD-177000123', '428712345678');
console.log('UTR Submitted:', res);
```

#### List Recent Orders
```javascript
const { orders, total } = await bladePay.payin.list({
  limit: 20,
  offset: 0,
  state: 'all', // 'all' | 1 (processing) | 2 (success) | 4 (timeout)
});
```

---

### 2. Withdrawals (Payout API)

#### Bank Account Payout (IMPS / NEFT - Version V2)
```javascript
const payout = await bladePay.payout.createBankPayout({
  merchantOrderNo: `WD-${Date.now()}`,
  amount: '1000.00',
  cashNumber: '50100012345678', // Beneficiary Bank Account
  ifsc: 'HDFC0001234',            // Bank IFSC Code
  bankName: 'HDFC Bank',
  cashName: 'Jane Smith',
  cashPhone: '9876543210',
  notifyUrl: 'https://yourdomain.com/api/payout-webhook',
});

console.log('Payout Submitted:', payout.gatewayOrderNo);
```

#### Direct UPI Payout (Instant Transfer - Version V3)
```javascript
const upiPayout = await bladePay.payout.createUpiPayout({
  merchantOrderNo: `UPI-${Date.now()}`,
  amount: '500.00',
  cashNumber: 'user@okaxis', // Beneficiary UPI ID / VPA
  cashName: 'Jane Smith',
  cashPhone: '9876543210',
  notifyUrl: 'https://yourdomain.com/api/payout-webhook',
});

console.log('UPI Payout Submitted:', upiPayout.gatewayOrderNo);
```

#### Query Payout Status
```javascript
const status = await bladePay.payout.getStatus('WD-177000456');
console.log(`Payout Status: ${status.cashStateName} (Code: ${status.cashState})`);
console.log(`Bank UTR: ${status.utr || 'Pending'}`);
```

---

### 3. Account & Balance API

```javascript
// Fetch real-time available and locked wallet balances
const balance = await bladePay.account.getBalance();
console.log(`Available Balance: ₹${balance.availableBalance}`);
console.log(`Total Collections:  ₹${balance.totalPayinVolume}`);

// Fetch financial ledger entries
const { ledger } = await bladePay.account.getLedger({ limit: 25 });
```

---

### 4. Webhook Notification Verification

BladePay signs all incoming webhook callbacks using MD5 signature hashing. Verify incoming webhooks safely using timing-safe comparison:

```javascript
const http = require('http');
const { BladePay } = require('./src');

const bladePay = new BladePay({
  apiToken: process.env.BLADEPAY_API_TOKEN,
});

// Inside your request handler (e.g. Express or native HTTP):
function handleWebhook(req, res) {
  const payload = req.body; // Incoming parsed JSON body

  // 1. Verify MD5 Signature
  const isValid = bladePay.webhooks.verifySignature(payload);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  // 2. Process Verified Event
  if (payload.payinState === 2) {
    console.log(`Order ${payload.merchantOrderNo} PAID! UTR: ${payload.utr}`);
    // Credit customer in your database
  }

  // 3. Acknowledge Receipt
  res.status(200).send('SUCCESS');
}
```

---

## 🧪 Running Examples & Tests

```bash
# Run Unit Tests
npm test

# Run Payin Example
npm run example:payin

# Run Status Check Example
npm run example:status

# Run Bank Payout Example
npm run example:payout

# Run Webhook Server Example
npm run example:webhook
```

---

## 📄 License
MIT License. Maintained by the BladePay Engineering Team.
