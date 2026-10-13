import parsePhoneNumber from 'libphonenumber-js/min';

export function normalizeImportPhone(raw: string, callingCode: string, useDefault: boolean): string | null {
  const value = raw.trim();
  if (!value || !/^[+\d\s().-]+$/.test(value)) return null;
  const digits = value.replace(/\D/g, '');
  const international = value.startsWith('+') || value.startsWith('00');
  const code = callingCode.replace(/\D/g, '');
  if (useDefault && !/^[1-9]\d{0,2}$/.test(code)) return null;
  const explicit = parsePhoneNumber('+' + (value.startsWith('00') ? digits.slice(2) : digits), { extract: false });
  if (international || !useDefault) return explicit?.isPossible() ? explicit.number.slice(1) : null;
  if (digits.startsWith(code) && explicit?.countryCallingCode === code && explicit.isPossible()) return explicit.number.slice(1);
  try {
    const local = parsePhoneNumber(value, { defaultCallingCode: code, extract: false });
    return local?.isPossible() ? local.number.slice(1) : null;
  } catch { return null; }
}
