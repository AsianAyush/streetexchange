export interface BladePayOptions {
  apiToken: string;
  baseUrl?: string;
  timeout?: number;
}

export interface CreatePayinParams {
  merchantOrderNo: string;
  amount: number | string;
  currency?: string;
  payinName?: string;
  payinPhone?: string;
  payinEmail?: string;
  notifyUrl?: string;
  returnUrl?: string;
  mark?: string;
}

export interface PayinOrderResult {
  merchantOrderNo: string;
  gatewayOrderNo: string;
  cashierUrl: string;
  amount: string;
  payinState: number;
}

export interface PayinStatusResult {
  isPaid: boolean;
  status: 'PAID' | 'PROCESSING' | 'TIMEOUT' | string;
  payinState: number;
  payinStateName: string;
  orderNo: string;
  merchantOrderNo: string;
  gatewayOrderNo: string;
  amount: string;
  actualAmount: string;
  feeCharged: string;
  settleAmount: string | null;
  currency: string;
  utr: string | null;
  cashierUrl: string;
  createdAt: string;
  paidAt: string | null;
}

export interface CreateBankPayoutParams {
  merchantOrderNo: string;
  amount: number | string;
  cashNumber: string;
  ifsc: string;
  cashName?: string;
  cashPhone?: string;
  bankName?: string;
  notifyUrl?: string;
}

export interface CreateUpiPayoutParams {
  merchantOrderNo: string;
  amount: number | string;
  cashNumber: string;
  cashName?: string;
  cashPhone?: string;
  notifyUrl?: string;
}

export interface PayoutStatusResult {
  merchantOrderNo: string;
  gatewayOrderNo: string;
  amount: string;
  feeCharged: string;
  holdAmount: string;
  cashState: number;
  cashStateName: string;
  approvalStatus: string;
  utr: string | null;
  createdAt: string;
  successTime: string | null;
}

export interface BalanceResult {
  merchantId: string;
  availableBalance: number;
  pendingBalance: number;
  totalPayinVolume: number;
  totalPayoutVolume: number;
  totalFeeCollected: number;
}

export class PayinService {
  create(params: CreatePayinParams): Promise<PayinOrderResult>;
  getStatus(orderNo: string): Promise<PayinStatusResult>;
  query(orderNo: string): Promise<PayinStatusResult>;
  submitUtr(merchantOrderNo: string, utr: string): Promise<any>;
  list(params?: {
    limit?: number;
    offset?: number;
    state?: string | number;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{ orders: Array<any>; total: number }>;
  getSummary(): Promise<any>;
}

export class PayoutService {
  createBankPayout(params: CreateBankPayoutParams): Promise<any>;
  createUpiPayout(params: CreateUpiPayoutParams): Promise<any>;
  create(params: any): Promise<any>;
  getStatus(orderNo: string): Promise<PayoutStatusResult>;
  query(orderNo: string): Promise<PayoutStatusResult>;
  list(params?: {
    limit?: number;
    offset?: number;
    state?: string | number;
    approvalStatus?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }): Promise<{ orders: Array<any>; total: number }>;
}

export class AccountService {
  getBalance(): Promise<BalanceResult>;
  getAccount(): Promise<any>;
  getProfile(): Promise<any>;
  getLedger(params?: { limit?: number; offset?: number }): Promise<{ ledger: Array<any>; total: number }>;
}

export class WebhookService {
  constructor(defaultApiToken?: string);
  generateSignature(data: Record<string, any>, apiToken?: string): string;
  verifySignature(payload: Record<string, any>, apiToken?: string): boolean;
  middleware(tokenOverride?: string): (req: any, res: any, next: () => void) => void;
}

export class BladePayError extends Error {
  code: number;
  statusCode: number;
  details: any;
  toJSON(): Record<string, any>;
}

export class BladePay {
  payin: PayinService;
  payout: PayoutService;
  account: AccountService;
  webhooks: WebhookService;

  constructor(options?: BladePayOptions);
}

export default BladePay;
