import QRCode from 'qrcode';

const DEFAULT_BANK_ACCOUNT = '227993932/0600';

/**
 * Convert Czech bank account (e.g. "227993932/0600") to IBAN format.
 */
export function bankAccountToIban(bankAccount: string): string {
  const match = bankAccount.match(/^(?:(\d+)-)?(\d+)\/(\d{4})$/);
  if (!match) return '';

  const prefix = (match[1] || '').padStart(6, '0');
  const account = match[2].padStart(10, '0');
  const bankCode = match[3];

  const bban = bankCode + prefix + account;

  // Calculate IBAN check digits (ISO 13616)
  const numericStr = bban + '123500'; // C=12, Z=35, 00 placeholder
  const remainder = BigInt(numericStr) % 97n;
  const checkDigits = (98n - remainder).toString().padStart(2, '0');

  return `CZ${checkDigits}${bban}`;
}

/**
 * Extract variable symbol (numeric part) from contract number like "CS-260009" → "260009"
 */
export function extractVariableSymbol(contractNumber: string): string {
  return contractNumber.replace(/\D/g, '');
}

/**
 * Generate SPAYD (Short Payment Descriptor) string for Czech QR payments.
 */
export function generateSpaydString({
  iban,
  amount,
  currency = 'CZK',
  variableSymbol,
  dueDate,
  message,
}: {
  iban: string;
  amount: number;
  currency?: string;
  variableSymbol?: string;
  dueDate?: string;
  message?: string;
}): string {
  const parts = [
    'SPD*1.0',
    `ACC:${iban}`,
    `AM:${amount.toFixed(2)}`,
    `CC:${currency}`,
  ];

  if (variableSymbol) {
    parts.push(`X-VS:${variableSymbol}`);
  }

  if (dueDate) {
    // SPAYD expects DT field in YYYYMMDD format
    const d = new Date(dueDate);
    if (!isNaN(d.getTime())) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      parts.push(`DT:${y}${m}${day}`);
    }
  }

  if (message) {
    // SPAYD message max 60 chars, no special chars
    const sanitized = message
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9 ]/g, '')
      .slice(0, 60);
    parts.push(`MSG:${sanitized}`);
  }

  return parts.join('*');
}

/**
 * Generate a QR code data URL for a payment using SPAYD format.
 */
export async function generatePaymentQrDataUrl(params: {
  amount: number;
  contractNumber: string;
  bankAccount?: string;
  size?: number;
}): Promise<string> {
  const account = params.bankAccount || DEFAULT_BANK_ACCOUNT;
  const iban = bankAccountToIban(account);
  if (!iban) return '';

  const vs = extractVariableSymbol(params.contractNumber);
  const spayd = generateSpaydString({
    iban,
    amount: params.amount,
    variableSymbol: vs,
    message: `Platba za smlouvu ${params.contractNumber}`,
  });

  return QRCode.toDataURL(spayd, {
    width: params.size || 150,
    margin: 1,
    errorCorrectionLevel: 'M',
  });
}
