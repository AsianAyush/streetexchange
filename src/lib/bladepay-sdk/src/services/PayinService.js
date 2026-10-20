/**
 * Payin (Collections) Service
 */
class PayinService {
  /**
   * @param {import('../utils/httpClient').HttpClient} http
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * Create a new Payin collection order and generate a branded cashier link.
   *
   * @param {Object} params
   * @param {string} params.merchantOrderNo - Unique order ID in your merchant system (Required)
   * @param {number|string} params.amount - Amount in INR (min ₹10) (Required)
   * @param {string} [params.currency='INR'] - Currency code
   * @param {string} [params.payinName] - Customer full name
   * @param {string} [params.payinPhone] - Customer 10-digit mobile number
   * @param {string} [params.payinEmail] - Customer email address
   * @param {string} [params.notifyUrl] - Webhook URL for instant payment callbacks
   * @param {string} [params.returnUrl] - Redirect URL after payment completion
   * @param {string} [params.mark] - Internal order remarks/tag
   * @returns {Promise<{ merchantOrderNo: string, gatewayOrderNo: string, cashierUrl: string, amount: string, payinState: number }>}
   */
  async create(params) {
    const res = await this.http.post('/merchant/api/payin/create', params);
    return res.data;
  }

  /**
   * Check order status with automatic live upstream recovery.
   * If an upstream callback was missed or delayed, this call automatically
   * queries the upstream banking network, updates the database, settles your
   * ledger balance, and returns the real-time status.
   *
   * @param {string} orderNo - Your merchantOrderNo OR the gatewayOrderNo (Required)
   * @returns {Promise<{ isPaid: boolean, status: string, payinState: number, payinStateName: string, orderNo: string, merchantOrderNo: string, gatewayOrderNo: string, amount: string, actualAmount: string, feeCharged: string, settleAmount: string, currency: string, utr: string|null, cashierUrl: string, createdAt: string, paidAt: string|null }>}
   */
  async getStatus(orderNo) {
    if (!orderNo) throw new Error('orderNo is required to check order status');
    const res = await this.http.post('/merchant/api/payin/query', { orderNo });
    return res.data;
  }

  /**
   * Alias for getStatus(orderNo)
   */
  async query(orderNo) {
    return this.getStatus(orderNo);
  }

  /**
   * Submit 12-digit UTR confirmation for a payin order.
   *
   * @param {string} merchantOrderNo - Unique order ID (Required)
   * @param {string} utr - 12-digit bank UTR reference number (Required)
   * @returns {Promise<any>}
   */
  async submitUtr(merchantOrderNo, utr) {
    if (!merchantOrderNo) throw new Error('merchantOrderNo is required');
    if (!utr) throw new Error('utr is required');
    const res = await this.http.post('/merchant/api/payin/utr/submit', {
      merchantOrderNo,
      utr,
    });
    return res.data;
  }

  /**
   * Retrieve paginated list of payin transactions.
   *
   * @param {Object} [params]
   * @param {number} [params.limit=20] - Number of orders to fetch
   * @param {number} [params.offset=0] - Offset for pagination
   * @param {string|number} [params.state='all'] - Order state ('all' | 1=processing | 2=success | 4=timeout)
   * @param {string} [params.startDate] - Start date (YYYY-MM-DD)
   * @param {string} [params.endDate] - End date (YYYY-MM-DD)
   * @param {string} [params.search] - Search by order number, UTR, or customer name
   * @returns {Promise<{ orders: Array<any>, total: number }>}
   */
  async list(params = {}) {
    const res = await this.http.get('/merchant/api/payin/list', params);
    return res.data;
  }

  /**
   * Get lifetime and daily payin volume and success statistics.
   *
   * @returns {Promise<{ success_count: number, pending_count: number, timeout_count: number, total_count: number, total_actual_volume: string, total_fee_charged: string, total_settled: string }>}
   */
  async getSummary() {
    const res = await this.http.get('/merchant/api/payin/summary');
    return res.data;
  }
}

module.exports = {
  PayinService,
};
