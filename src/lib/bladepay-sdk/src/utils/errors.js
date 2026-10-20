/**
 * BladePay API Error
 * Wraps errors returned by the BladePay gateway or HTTP connection failures.
 */
class BladePayError extends Error {
  /**
   * @param {string} message - Human readable error message
   * @param {number} [code=1] - BladePay error code (e.g. 1001, 1004, 1005)
   * @param {number} [statusCode=500] - HTTP status code (e.g. 400, 401, 409)
   * @param {any} [details=null] - Additional error payload from server
   */
  constructor(message, code = 1, statusCode = 500, details = null) {
    super(message);
    this.name = 'BladePayError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, BladePayError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

module.exports = {
  BladePayError,
};
