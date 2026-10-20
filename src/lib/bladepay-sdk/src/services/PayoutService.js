/**
 * Payout (Withdrawals) Service
 */
class PayoutService {
  /**
   * @param {import('../utils/httpClient').HttpClient} http
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * Create a bank transfer payout request (IMPS / NEFT - Version V2).
   * The requested amount plus gateway fees are balance-locked atomically.
   *
   * @param {Object} params
   * @param {string} params.merchantOrderNo - Unique payout order ID (Required)
   * @param {number|string} params.amount - Amount in INR (Required)
   * @param {string} params.cashNumber - Beneficiary Bank Account Number (Required)
   * @param {string} params.ifsc - Beneficiary Bank IFSC Code (Required)
   * @param {string} [params.cashName] - Beneficiary full name
   * @param {string} [params.cashPhone] - Beneficiary 10-digit mobile number
   * @param {string} [params.bankName] - Bank Name (e.g. 'HDFC Bank')
   * @param {string} [params.notifyUrl] - Webhook URL for real-time bank status callback
   * @returns {Promise<{ merchantOrderNo: string, gatewayOrderNo: string, amount: string, feeCharged: string, settleAmount: string, cashState: number }>}
   */
  async createBankPayout(params) {
    const payload = {
      version: 'V2',
      ...params,
    };
    const res = await this.http.post('/merchant/api/payout/create', payload);
    return res.data;
  }

  /**
   * Create a direct UPI payout request (Version V3).
   * Sends funds instantly to the recipient's UPI ID / VPA.
   *
   * @param {Object} params
   * @param {string} params.merchantOrderNo - Unique payout order ID (Required)
   * @param {number|string} params.amount - Amount in INR (Required)
   * @param {string} params.cashNumber - Recipient UPI ID (e.g. user@okaxis) (Required)
   * @param {string} [params.cashName] - Recipient full name
   * @param {string} [params.cashPhone] - Recipient 10-digit mobile number
   * @param {string} [params.notifyUrl] - Webhook URL for real-time transfer callback
   * @returns {Promise<{ merchantOrderNo: string, gatewayOrderNo: string, amount: string, feeCharged: string, totalDeducted: string, cashState: number }>}
   */
  async createUpiPayout(params) {
    const payload = {
      version: 'V3',
      ...params,
    };
    const res = await this.http.post('/merchant/api/payout/create', payload);
    return res.data;
  }

  /**
   * General payout creation endpoint supporting custom parameters.
   * @param {Object} params
   */
  async create(params) {
    const res = await this.http.post('/merchant/api/payout/create', params);
    return res.data;
  }

  /**
   * Query the status of a payout withdrawal request.
   *
   * @param {string} orderNo - Your merchantOrderNo OR the gatewayOrderNo (Required)
   * @returns {Promise<{ merchantOrderNo: string, gatewayOrderNo: string, amount: string, feeCharged: string, holdAmount: string, cashState: number, cashStateName: string, approvalStatus: string, utr: string|null, createdAt: string, successTime: string|null }>}
   */
  async getStatus(orderNo) {
    if (!orderNo) throw new Error('orderNo is required to check payout status');
    const res = await this.http.post('/merchant/api/payout/query', { orderNo });
    return res.data;
  }

  /**
   * Alias for getStatus(orderNo)
   */
  async query(orderNo) {
    return this.getStatus(orderNo);
  }

  /**
   * Retrieve paginated list of payout withdrawal orders.
   *
   * @param {Object} [params]
   * @param {number} [params.limit=20] - Number of orders to fetch
   * @param {number} [params.offset=0] - Offset for pagination
   * @param {string|number} [params.state='all'] - Payout state ('all' | 0=pending | 2=processing | 4=success | 3=failed | 5=rejected)
   * @param {string} [params.approvalStatus='all'] - Approval status ('all' | 'pending' | 'approved' | 'rejected')
   * @param {string} [params.startDate] - Start date (YYYY-MM-DD)
   * @param {string} [params.endDate] - End date (YYYY-MM-DD)
   * @param {string} [params.search] - Search by order number, UTR, account, or recipient name
   * @returns {Promise<{ orders: Array<any>, total: number }>}
   */
  async list(params = {}) {
    const res = await this.http.get('/merchant/api/payout/list', params);
    return res.data;
  }
}

module.exports = {
  PayoutService,
};
