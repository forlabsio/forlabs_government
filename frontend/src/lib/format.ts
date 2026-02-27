import { differenceInCalendarDays, parseISO } from "date-fns";

/**
 * Calculate D-Day from a deadline date string.
 * Returns a negative number for days remaining (e.g., -3 means 3 days left).
 * Returns 0 for today. Returns positive for past deadlines.
 */
export function getDDay(deadline: string | undefined): number | null {
  if (!deadline) return null;
  try {
    const deadlineDate = parseISO(deadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInCalendarDays(today, deadlineDate);
  } catch {
    return null;
  }
}

/**
 * Format D-Day for display.
 * e.g., "D-3", "D-Day", "마감"
 */
export function formatDDay(deadline: string | undefined): string {
  const dday = getDDay(deadline);
  if (dday === null) return "상시";
  if (dday > 0) return "마감";
  if (dday === 0) return "D-Day";
  return `D${dday}`;
}

/**
 * Get D-Day badge color class.
 * Red if <= 7 days, yellow if <= 14 days, green otherwise.
 */
export function getDDayColor(deadline: string | undefined): string {
  const dday = getDDay(deadline);
  if (dday === null) return "bg-gray-100 text-gray-600";
  if (dday > 0) return "bg-gray-200 text-gray-500";
  const remaining = Math.abs(dday);
  if (remaining <= 7) return "bg-red-50 text-red-600 border border-red-200";
  if (remaining <= 14)
    return "bg-amber-50 text-amber-600 border border-amber-200";
  return "bg-emerald-50 text-emerald-600 border border-emerald-200";
}

/**
 * Format amount in Korean won style.
 * e.g., 500000000 -> "5억원", 30000000 -> "3,000만원"
 */
export function formatAmount(amount: number | undefined): string {
  if (!amount) return "";
  if (amount >= 100000000) {
    const eok = amount / 100000000;
    return Number.isInteger(eok) ? `${eok}억원` : `${eok.toFixed(1)}억원`;
  }
  if (amount >= 10000) {
    const man = Math.round(amount / 10000);
    return `${man.toLocaleString()}만원`;
  }
  return `${amount.toLocaleString()}원`;
}

/**
 * Format amount range for display.
 */
export function formatAmountRange(
  min?: number,
  max?: number
): string {
  if (max) return `최대 ${formatAmount(max)}`;
  if (min) return `${formatAmount(min)} 이상`;
  return "금액 미정";
}
