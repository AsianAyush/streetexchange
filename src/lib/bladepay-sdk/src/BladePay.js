const { HttpClient } = require('./utils/httpClient');
const { PayinService } = require('./services/PayinService');
const { PayoutService } = require('./services/PayoutService');
const { AccountService } = require('./services/AccountService');
const { WebhookService } = require('./services/WebhookService');
const { BladePayError } = require('./utils/errors');

/**
 * BladePay Payment Gateway SDK Client
 */
class BladePay {
  /**
   * Initializes the BladePay Merchant SDK Client.
   *
   * @param {Object} options
   * @param {string} options.apiToken - Your Merchant API Token (starts with gw_)
   * @param {string} [options.baseUrl='http://localhost:4009'] - BladePay Gateway Base URL
   * @param {number} [options.timeout=15000] - Request timeout in milliseconds
   */
  constructor(options = {}) {
    const apiToken = options.apiToken || process.env.BLADEPAY_API_TOKEN;
    const baseUrl = options.baseUrl || process.env.BLADEPAY_BASE_URL || 'http://localhost:4009';
    const timeout = options.timeout || 15000;

    if (!apiToken) {
      console.warn('[BladePay SDK] Warning: apiToken was not provided during initialization. Set it via options.apiToken or process.env.BLADEPAY_API_TOKEN.');
    }

    this.http = new HttpClient({ baseUrl, apiToken, timeout });

    // Core Service Namespaces
    this.payin = new PayinService(this.http);
    this.payout = new PayoutService(this.http);
    this.account = new AccountService(this.http);
    this.webhooks = new WebhookService(apiToken);
  }
}

module.exports = {
  BladePay,
  BladePayError,
};
