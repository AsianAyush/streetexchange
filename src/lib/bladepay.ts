/**
 * BladePay Payment Gateway SDK Client Wrapper
 *
 * Utilizes the official BladePay SDK architecture:
 *   - PayinService (referencing examples/1_create_payin_order.js) for payment collection links
 *   - WebhookService (referencing examples/8_webhook_server_express.js) for MD5 signature verification
 *
 * Server-side only — never import from client components.
 */

import type {
  BladePay as BladePayType,
  PayinOrderResult,
  PayinStatusResult,
} from './bladepay-sdk/types'

// Require SDK from bundled local package
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { BladePay, BladePayError, WebhookService } = require('./bladepay-sdk/src')

export { BladePay, BladePayError, WebhookService }
export type { BladePayType, PayinOrderResult, PayinStatusResult }

// ---------------------------------------------------------------------------
// Configuration & Client Initialization
// ---------------------------------------------------------------------------

export interface BladePayClientOptions {
  merchantId?: string
  apiKey?: string
  baseUrl?: string
  timeout?: number
}

/**
 * Initializes and returns an instance of the BladePay SDK Client.
 * Reads BLADEPAY_MERCHANT_ID and BLADEPAY_API_KEY from process.env.
 */
export function getBladePayClient(overrides?: BladePayClientOptions): BladePayType {
  const apiKey =
    overrides?.apiKey ||
    process.env.BLADEPAY_API_KEY ||
    process.env.BLADEPAY_API_TOKEN ||
    ''

  const baseUrl =
    overrides?.baseUrl ||
    process.env.BLADEPAY_BASE_URL ||
    'https://api.bladepay.pro'

  const timeout = overrides?.timeout || 15000

  return new BladePay({
    apiToken: apiKey,
    baseUrl,
    timeout,
  }) as BladePayType
}

// ---------------------------------------------------------------------------
// Payin Service Types & Function
// Reference: examples/1_create_payin_order.js
// ---------------------------------------------------------------------------

export interface BladePayOrderParams {
  /** Payment amount (INR) */
  amount: number | string
  /** Unique merchant order reference */
  merchantOrderNo: string
  /** URL to redirect user after payment */
  redirectUrl?: string
  /** Server-to-server webhook callback URL */
  callbackUrl?: string
  /** Customer metadata */
  customerName?: string
  customerPhone?: string
  customerEmail?: string
}

export interface BladePayOrderResult {
  success: boolean
  payment_url?: string
  gateway_order_no?: string
  amount?: string
  message?: string
}

/**
 * Creates a payment deposit order via the BladePay SDK PayinService.
 * Referencing examples/1_create_payin_order.js
 */
export async function createBladePayOrder(
  params: BladePayOrderParams,
  configOverrides?: BladePayClientOptions,
): Promise<BladePayOrderResult> {
  const apiKey =
    configOverrides?.apiKey ||
    process.env.BLADEPAY_API_KEY ||
    process.env.BLADEPAY_API_TOKEN

  if (!apiKey) {
    console.error('[BladePay] Missing BLADEPAY_API_KEY credentials.')
    return {
      success: false,
      message: 'BladePay gateway not configured. Please try BondPay.',
    }
  }

  const client = getBladePayClient(configOverrides)

  const siteBase =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    'https://streetexchange.vercel.app'

  const callbackUrl =
    params.callbackUrl || `${siteBase}/api/payment/bladepay/callback`
  const redirectUrl =
    params.redirectUrl || `${siteBase}/api/payment/bladepay/callback`

  const formattedAmount = Number(params.amount).toFixed(2)

  try {
    console.log('[BladePay SDK] Calling payin.create with:', {
      merchantOrderNo: params.merchantOrderNo,
      amount: formattedAmount,
      notifyUrl: callbackUrl,
      returnUrl: redirectUrl,
    })

    const res: PayinOrderResult = await client.payin.create({
      merchantOrderNo: params.merchantOrderNo,
      amount: formattedAmount,
      currency: 'INR',
      notifyUrl: callbackUrl,
      returnUrl: redirectUrl,
      payinName: params.customerName || 'Customer',
      payinPhone: params.customerPhone || '9876543210',
      payinEmail: params.customerEmail || undefined,
      mark: `Order ${params.merchantOrderNo}`,
    })

    console.log('[BladePay SDK] payin.create response received:', {
      merchantOrderNo: res?.merchantOrderNo,
      gatewayOrderNo: res?.gatewayOrderNo,
      cashierUrl: res?.cashierUrl,
    })

    const paymentUrl =
      res?.cashierUrl ||
      (res as any)?.paymentUrl ||
      (res as any)?.payment_url

    const gatewayOrderNo =
      res?.gatewayOrderNo ||
      (res as any)?.gateway_order_no ||
      params.merchantOrderNo

    if (!paymentUrl || typeof paymentUrl !== 'string' || !paymentUrl.trim()) {
      console.error('[BladePay SDK] No cashierUrl returned in response:', res)
      return {
        success: false,
        message: 'BladePay did not return a valid cashier link. Please try BondPay.',
      }
    }

    return {
      success: true,
      payment_url: paymentUrl.trim(),
      gateway_order_no: String(gatewayOrderNo),
      amount: res.amount || formattedAmount,
      message: 'BladePay payment session created successfully.',
    }
  } catch (err: any) {
    const errorMsg = err?.message || 'Unknown BladePay error'
    console.error('[BladePay SDK] payin.create error:', errorMsg)
    return {
      success: false,
      message: errorMsg || 'BladePay gateway error. Please try BondPay.',
    }
  }
}

// ---------------------------------------------------------------------------
// Webhook Signature Verification
// Reference: examples/8_webhook_server_express.js
// ---------------------------------------------------------------------------

/**
 * Verifies an incoming BladePay webhook payload using the SDK's WebhookService.
 * Validates MD5 signature (payload.sign or payload.signature).
 */
export function verifyBladePayWebhook(
  payload: Record<string, any>,
  apiKey?: string,
): boolean {
  try {
    const key = apiKey || process.env.BLADEPAY_API_KEY || ''
    if (!key) {
      console.warn('[BladePay SDK] verifyBladePayWebhook: Missing API Key for verification')
      return false
    }

    const webhookService = new WebhookService(key)

    // Normalize signature field (BladePay SDK uses .sign)
    const sign = payload.sign || payload.signature
    if (!sign) {
      console.warn('[BladePay SDK] verifyBladePayWebhook: Missing sign/signature in payload')
      return false
    }

    const normalizedPayload = {
      ...payload,
      sign: String(sign),
    }

    return webhookService.verifySignature(normalizedPayload, key)
  } catch (err) {
    console.error('[BladePay SDK] verifyBladePayWebhook exception:', err)
    return false
  }
}

/**
 * Checks payin status and performs live upstream banking recovery.
 * Reference: examples/2_check_order_status.js
 */
export async function checkBladePayOrderStatus(
  orderNo: string,
  configOverrides?: BladePayClientOptions,
): Promise<PayinStatusResult | null> {
  try {
    const client = getBladePayClient(configOverrides)
    return await client.payin.getStatus(orderNo)
  } catch (err) {
    console.error(`[BladePay SDK] checkBladePayOrderStatus failed for ${orderNo}:`, err)
    return null
  }
}
