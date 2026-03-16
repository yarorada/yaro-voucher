/**
 * Formats a phone number according to local/international rules.
 * Supports CZ/SK (+420/+421), international E.164, and local Czech formats.
 */
export function formatPhone(raw: string): string {
  if (!raw) return raw;

  // Strip all spaces, dashes, dots (keep + and digits)
  let digits = raw.replace(/[\s\-.()\u00A0]/g, "");

  // Handle Czech/Slovak numbers starting with 00420 / 00421
  if (digits.startsWith("00420")) digits = "+420" + digits.slice(5);
  if (digits.startsWith("00421")) digits = "+421" + digits.slice(5);

  // Czech landline / mobile: +420 XXX XXX XXX
  if (/^\+420\d{9}$/.test(digits)) {
    const n = digits.slice(4);
    return `+420 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }

  // Slovak: +421 XXX XXX XXX
  if (/^\+421\d{9}$/.test(digits)) {
    const n = digits.slice(4);
    return `+421 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }

  // Local Czech 9-digit (no prefix): XXX XXX XXX
  if (/^\d{9}$/.test(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }

  // Other international: keep as-is but normalise spaces
  return digits;
}
