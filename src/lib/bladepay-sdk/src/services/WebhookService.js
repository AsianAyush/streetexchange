const crypto = require('crypto');

/**
 * Webhook Verification Service
 * Handles MD5 signature calculation and validation for incoming asynchronous callbacks.
 */
class WebhookService {
  /**
   * @param {string} [defaultApiToken] - Optional default merchant API token
   */
  constructor(defaultApiToken = '') {
    this.defaultApiToken = defaultApiToken;
  }

  /**
   * Generates MD5 signature for an outgoing payload
   * 1. Sort non-empty keys in ASCII alphabetical order
   * 2. Join as key=value&key2=value2
   * 3. Append &key=<merchant_api_token>
   * 4. Compute lowercase MD5 hash
   *
   * @param {Object} data - Payload without the sign field
   * @param {string} [apiToken] - Merchant API token (defaults to client token)
   * @returns {string} Computed signature in lowercase hex
   */
  generateSignature(data, apiToken = '') {
    const secret = apiToken || this.defaultApiToken;
    if (!secret) {
      throw new Error('Merchant API Token is required to generate signature');
    }

    const sortedKeys = Object.keys(data).filter(k => k !== 'sign').sort();
    const pairs = [];

    for (const key of sortedKeys) {
      const val = data[key];
      if (val !== '' && val !== null && val !== undefined) {
        pairs.push(`${key}=${val}`);
      }
    }

    const stringToSign = `${pairs.join('&')}&key=${secret}`;
    return crypto.createHash('md5').update(stringToSign, 'utf8').digest('hex').toLowerCase();
  }

  /**
   * Verifies an incoming webhook payload's MD5 signature.
   *
   * @param {Object} payload - Incoming webhook JSON body (must contain .sign property)
   * @param {string} [apiToken] - Merchant API token (defaults to client token)
   * @returns {boolean} True if signature is 100% valid, false otherwise
   */
  verifySignature(payload, apiToken = '') {
    if (!payload || typeof payload !== 'object') return false;

    const { sign, ...data } = payload;
    if (!sign || typeof sign !== 'string') return false;

    const secret = apiToken || this.defaultApiToken;
    if (!secret) return false;

    const expectedSign = this.generateSignature(data, secret);

    // Constant-time buffer comparison to prevent timing attacks
    try {
      const a = Buffer.from(sign.toLowerCase(), 'utf8');
      const b = Buffer.from(expectedSign, 'utf8');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return sign.toLowerCase() === expectedSign;
    }
  }

  /**
   * Express / Connect middleware helper for webhook endpoints
   * Automatically verifies signatures and sets req.isSignatureValid
   *
   * @param {string} [tokenOverride]
   * @returns {Function} Express middleware function
   */
  middleware(tokenOverride = '') {
    return (req, res, next) => {
      const isValid = this.verifySignature(req.body, tokenOverride || this.defaultApiToken);
      req.isSignatureValid = isValid;
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid webhook signature' });
      }
      next();
    };
  }
}

module.exports = {
  WebhookService,
};
