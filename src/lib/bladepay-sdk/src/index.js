const { BladePay, BladePayError } = require('./BladePay');
const { PayinService } = require('./services/PayinService');
const { PayoutService } = require('./services/PayoutService');
const { AccountService } = require('./services/AccountService');
const { WebhookService } = require('./services/WebhookService');

module.exports = BladePay;
module.exports.BladePay = BladePay;
module.exports.BladePayError = BladePayError;
module.exports.PayinService = PayinService;
module.exports.PayoutService = PayoutService;
module.exports.AccountService = AccountService;
module.exports.WebhookService = WebhookService;
module.exports.default = BladePay;
