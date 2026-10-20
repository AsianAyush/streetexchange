/**
 * Account, Wallet & Ledger Service
 */
class AccountService {
  /**
   * @param {import('../utils/httpClient').HttpClient} http
   */
  constructor(http) {
    this.http = http;
  }

  /**
   * Fetch real-time merchant wallet balance and volume statistics.
   *
   * @returns {Promise<{ merchantId: string, availableBalance: number, pendingBalance: number, totalPayinVolume: number, totalPayoutVolume: number, totalFeeCollected: number }>}
   */
  async getBalance() {
    const res = await this.http.get('/merchant/api/balance');
    return res.data;
  }

  /**
   * Fetch merchant account configuration, rate settings, and notification endpoints.
   *
   * @returns {Promise<any>}
   */
  async getAccount() {
    const res = await this.http.get('/merchant/api/account');
    return res.data;
  }

  /**
   * Fetch authenticated merchant profile context.
   *
   * @returns {Promise<any>}
   */
  async getProfile() {
    const res = await this.http.get('/merchant/api/auth/me');
    return res.data;
  }

  /**
   * Fetch double-entry wallet ledger movement history.
   *
   * @param {Object} [params]
   * @param {number} [params.limit=50] - Number of ledger entries
   * @param {number} [params.offset=0] - Pagination offset
   * @returns {Promise<{ ledger: Array<any>, total: number }>}
   */
  async getLedger(params = { limit: 50, offset: 0 }) {
    const res = await this.http.get('/merchant/api/ledger', params);
    return res.data;
  }
}

module.exports = {
  AccountService,
};
