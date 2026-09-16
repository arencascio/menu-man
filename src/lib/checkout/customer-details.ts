export type CheckoutCustomerRequirements = {
  customerNameRequired: boolean;
  customerEmailRequired: boolean;
  customerPhoneRequired: boolean;
};

const unicodeLetter = /\p{L}/u;
const singleLatinLetter = /^[A-Za-z]$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneFormattingPattern = /^[\d+().\-\s]+$/;
const disallowedNoteControlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function normalizeCustomerName(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/gu, " ") || "";
  return normalized || null;
}

export function isValidCustomerName(value: string, required: boolean) {
  if (value.length > 100 || !unicodeLetter.test(value)) return false;
  if (!required) return true;
  // A single non-Latin letter can be a complete legitimate name (for example, 李).
  return value.length >= 2 || !singleLatinLetter.test(value);
}

export function normalizeCustomerEmail(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() || "";
  return normalized || null;
}

export function isValidCustomerEmail(value: string) {
  return value.length <= 254 && emailPattern.test(value);
}

export function normalizeUsPhone(value: string | null | undefined) {
  const trimmed = value?.trim() || "";
  if (!trimmed) return null;
  if (!phoneFormattingPattern.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  const nationalNumber = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(nationalNumber)) return null;
  return `+1${nationalNumber}`;
}

export function normalizeCustomerNotes(value: string | null | undefined) {
  const normalized = (value || "").replace(/\r\n?/g, "\n").trim();
  return normalized || null;
}

export function isValidCustomerNotes(value: string) {
  return value.length <= 500 && !disallowedNoteControlCharacters.test(value);
}

export function customerValidationError(
  customer: { name: string | null; email: string | null; phone: string | null },
  requirements: CheckoutCustomerRequirements,
) {
  if (!customer.name) {
    if (requirements.customerNameRequired) return "Enter your name.";
  } else if (!isValidCustomerName(customer.name, requirements.customerNameRequired)) {
    return "Enter a valid name using at least one letter and no more than 100 characters.";
  }

  if (!customer.email) {
    if (requirements.customerEmailRequired) return "Enter your email address.";
  } else if (!isValidCustomerEmail(customer.email)) {
    return "Enter a valid email address.";
  }

  if (!customer.phone) {
    if (requirements.customerPhoneRequired) return "Enter your US phone number.";
  } else if (!normalizeUsPhone(customer.phone)) {
    return "Enter a valid 10-digit US phone number.";
  }

  return null;
}
