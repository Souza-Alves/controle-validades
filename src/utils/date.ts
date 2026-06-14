export function parseDate(dateStr: string): Date | null {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  return new Date(year, month, day);
}

export function formatDate(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function isWithinDays(dateStr: string, days: number): boolean {
  const date = parseDate(dateStr);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const futureDate = new Date(today);
  futureDate.setDate(futureDate.getDate() + days);
  return date >= today && date <= futureDate;
}

export function isInRange(dateStr: string, startStr: string, endStr: string): boolean {
  const date = parseDate(dateStr);
  const start = parseDate(startStr);
  const end = parseDate(endStr);
  if (!date || !start || !end) return false;
  return date >= start && date <= end;
}

export function compareDates(a: string, b: string): number {
  const dateA = parseDate(a);
  const dateB = parseDate(b);
  if (!dateA || !dateB) return 0;
  return dateA.getTime() - dateB.getTime();
}

export function applyDateMask(text: string): string {
  const digits = text.replace(/\D/g, '');
  let masked = '';
  for (let i = 0; i < digits.length && i < 8; i++) {
    if (i === 2 || i === 4) masked += '/';
    masked += digits[i];
  }
  return masked;
}
