const { BladePayError } = require('./errors');

/**
 * Lightweight, zero-dependency HTTP Client using native Node.js fetch
 */
class HttpClient {
  /**
   * @param {Object} options
   * @param {string} options.baseUrl
   * @param {string} options.apiToken
   * @param {number} [options.timeout=15000]
   */
  constructor({ baseUrl, apiToken, timeout = 15000 }) {
    this.baseUrl = (baseUrl || 'http://localhost:4009').replace(/\/+$/, '');
    this.apiToken = apiToken;
    this.timeout = timeout;
  }

  /**
   * Performs an HTTP request
   * @param {string} method - 'GET' | 'POST' | 'PUT' | 'DELETE'
   * @param {string} path - API endpoint path (e.g. '/merchant/api/payin/create')
   * @param {Object} [data] - JSON request body for POST/PUT
   * @param {Object} [query] - Query parameters for GET
   * @returns {Promise<any>} Response data
   */
  async request(method, path, data = null, query = null) {
    let url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;

    if (query && typeof query === 'object') {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') {
          searchParams.append(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    const headers = {
      'Accept': 'application/json',
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    }

    const fetchOptions = {
      method: method.toUpperCase(),
      headers,
    };

    if (data && (fetchOptions.method === 'POST' || fetchOptions.method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(data);
    }

    // Abort controller for timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    fetchOptions.signal = controller.signal;

    try {
      const res = await fetch(url, fetchOptions);
      clearTimeout(timer);

      const contentType = res.headers.get('content-type') || '';
      let resBody;

      if (contentType.includes('application/json')) {
        resBody = await res.json();
      } else {
        const text = await res.text();
        try {
          resBody = JSON.parse(text);
        } catch {
          resBody = { code: res.ok ? 0 : 1, msg: text, data: text };
        }
      }

      if (!res.ok) {
        const errMsg = resBody?.msg || resBody?.error || `HTTP ${res.status} ${res.statusText}`;
        const errCode = resBody?.code || res.status;
        throw new BladePayError(errMsg, errCode, res.status, resBody?.data || resBody);
      }

      // Check BladePay application-level code (code === 0 is success)
      if (resBody && typeof resBody.code === 'number' && resBody.code !== 0) {
        throw new BladePayError(resBody.msg || 'API returned non-zero code', resBody.code, res.status, resBody.data);
      }

      return resBody;

    } catch (err) {
      clearTimeout(timer);

      if (err instanceof BladePayError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new BladePayError(`Request timed out after ${this.timeout}ms`, 408, 408);
      }

      throw new BladePayError(`Connection error: ${err.message}`, 500, 500, err);
    }
  }

  get(path, query = null) {
    return this.request('GET', path, null, query);
  }

  post(path, data = null) {
    return this.request('POST', path, data, null);
  }
}

module.exports = {
  HttpClient,
};
