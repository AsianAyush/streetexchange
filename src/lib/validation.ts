// =================== VALIDATION CONSTANTS ===================
export const MIN_INR_AMOUNT = 1000;
export const MAX_INR_AMOUNT = 50000;
export const TRC20_REGEX = /^T[a-km-zA-HJ-NP-Z1-9]{33}$/;
export const BEP20_REGEX = /^0x[a-fA-F0-9]{40}$/;

export type Network = 'TRC20' | 'BEP20';

// =================== WALLET ADDRESS VALIDATION ===================
export interface AddressValidationResult {
  valid: boolean;
  error?: string;
}

export type TRC20ValidationResult = AddressValidationResult;
export type BEP20ValidationResult = AddressValidationResult;

export function validateTRC20Address(address: string): AddressValidationResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return { valid: false, error: 'TRC-20 address is required.' };
  }
  if (trimmed.length !== 34) {
    return {
      valid: false,
      error: `Address must be exactly 34 characters (current: ${trimmed.length}).`,
    };
  }
  if (!trimmed.startsWith('T')) {
    return { valid: false, error: "TRC-20 addresses must begin with the letter 'T'." };
  }
  if (!TRC20_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid Base58 characters detected. Please verify your TRC-20 (TRON) address.',
    };
  }
  return { valid: true };
}

export function validateBEP20Address(address: string): AddressValidationResult {
  const trimmed = address.trim();
  if (!trimmed) {
    return { valid: false, error: 'BEP-20 address is required.' };
  }
  if (!trimmed.startsWith('0x')) {
    return { valid: false, error: "BEP-20 addresses must start with '0x'." };
  }
  if (trimmed.length !== 42) {
    return {
      valid: false,
      error: `Address must be exactly 42 characters (current: ${trimmed.length}).`,
    };
  }
  if (!BEP20_REGEX.test(trimmed)) {
    return {
      valid: false,
      error: 'Invalid hexadecimal characters. Must be 0x followed by 40 hex characters.',
    };
  }
  return { valid: true };
}

export function validateWalletAddress(address: string, network: Network): AddressValidationResult {
  if (network === 'TRC20') {
    return validateTRC20Address(address);
  } else if (network === 'BEP20') {
    return validateBEP20Address(address);
  }
  return { valid: false, error: 'Unsupported network selected.' };
}

// =================== INR AMOUNT VALIDATION ===================
export interface INRValidationResult {
  valid: boolean;
  error?: string;
}

export function validateINRAmount(amount: number | string): INRValidationResult {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  if (isNaN(num)) {
    return { valid: false, error: 'Please enter a valid INR amount.' };
  }
  if (num < MIN_INR_AMOUNT) {
    return {
      valid: false,
      error: `Minimum order amount is ₹${MIN_INR_AMOUNT.toLocaleString('en-IN')}.`,
    };
  }
  if (num > MAX_INR_AMOUNT) {
    return {
      valid: false,
      error: `Maximum order amount is ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')} per transaction.`,
    };
  }
  return { valid: true };
}

// =================== CALCULATION HELPERS ===================
export function calcUSDTFromINR(inrAmount: number, rateINRperUSDT: number): number {
  if (!rateINRperUSDT || rateINRperUSDT <= 0) return 0;
  return inrAmount / rateINRperUSDT;
}

export function calcINRFromUSDT(usdtAmount: number, rateINRperUSDT: number): number {
  if (!rateINRperUSDT || rateINRperUSDT <= 0) return 0;
  return usdtAmount * rateINRperUSDT;
}

export interface USDTValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUSDTAmount(amount: number | string, rateINRperUSDT: number): USDTValidationResult {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num) || num <= 0) {
    return { valid: false, error: 'Please enter a valid USDT amount.' };
  }
  const inrEquivalent = num * rateINRperUSDT;
  if (inrEquivalent < MIN_INR_AMOUNT) {
    const minUsdt = (MIN_INR_AMOUNT / rateINRperUSDT).toFixed(2);
    return {
      valid: false,
      error: `Minimum sell order is ₹${MIN_INR_AMOUNT.toLocaleString('en-IN')} (approx ${minUsdt} USDT).`,
    };
  }
  if (inrEquivalent > MAX_INR_AMOUNT) {
    const maxUsdt = (MAX_INR_AMOUNT / rateINRperUSDT).toFixed(2);
    return {
      valid: false,
      error: `Maximum sell order is ₹${MAX_INR_AMOUNT.toLocaleString('en-IN')} (approx ${maxUsdt} USDT) per transaction.`,
    };
  }
  return { valid: true };
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatUSDT(amount: number): string {
  return `${amount.toFixed(4)} USDT`;
}

// =================== UTR VALIDATION ===================
export interface UTRValidationResult {
  valid: boolean;
  error?: string;
}

export function validateUTR(utr: string): UTRValidationResult {
  const cleaned = utr.trim();
  if (!cleaned) {
    return { valid: false, error: 'UTR / IMPS reference number is required.' };
  }
  if (!/^\d{12}$/.test(cleaned)) {
    return {
      valid: false,
      error: 'UTR / IMPS reference must be exactly 12 digits.',
    };
  }
  return { valid: true };
}
