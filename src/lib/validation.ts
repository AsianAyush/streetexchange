// =================== VALIDATION CONSTANTS ===================
export const MIN_INR_AMOUNT = 1000;
export const MAX_INR_AMOUNT = 50000;
export const TRC20_REGEX = /^T[a-zA-Z0-9]{33}$/;
export const BEP20_REGEX = /^0x[a-fA-F0-9]{40}$/;

export type Network = 'TRC20' | 'BEP20';

// Helper checks
export const isBep20Valid = (addr: string) => /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
export const isTrc20Valid = (addr: string) => /^T[a-zA-Z0-9]{33}$/.test(addr.trim());

// Address validation helper
export const validateCryptoAddress = (address: string, network: 'TRC20' | 'BEP20'): string | null => {
  const cleanAddr = address.trim();
  if (!cleanAddr) return 'Address is required';

  if (network === 'BEP20') {
    const bep20Regex = /^0x[a-fA-F0-9]{40}$/;
    if (!bep20Regex.test(cleanAddr)) {
      return 'Invalid BEP20 address. Must be 42 characters starting with 0x';
    }
  }

  if (network === 'TRC20') {
    const trc20Regex = /^T[a-zA-Z0-9]{33}$/;
    if (!trc20Regex.test(cleanAddr)) {
      return 'Invalid TRC20 address. Must be 34 characters starting with T';
    }
  }

  return null; // Valid!
};

// =================== WALLET ADDRESS VALIDATION ===================
export interface AddressValidationResult {
  valid: boolean;
  error?: string;
}

export type TRC20ValidationResult = AddressValidationResult;
export type BEP20ValidationResult = AddressValidationResult;

export function validateTRC20Address(address: string): AddressValidationResult {
  const err = validateCryptoAddress(address, 'TRC20');
  if (err) {
    return { valid: false, error: err };
  }
  return { valid: true };
}

export function validateBEP20Address(address: string): AddressValidationResult {
  const err = validateCryptoAddress(address, 'BEP20');
  if (err) {
    return { valid: false, error: err };
  }
  return { valid: true };
}

export function validateWalletAddress(address: string, network: Network): AddressValidationResult {
  const err = validateCryptoAddress(address, network);
  if (err) {
    return { valid: false, error: err };
  }
  return { valid: true };
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
