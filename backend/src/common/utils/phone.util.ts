export function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (clean.length <= 4) {
    return clean;
  }

  const visiblePrefix = clean.slice(0, 2);
  const visibleSuffix = clean.slice(-2);
  const middleMask = '*'.repeat(Math.max(0, clean.length - 4));
  return `${visiblePrefix}${middleMask}${visibleSuffix}`;
}
