// Accurate Jalali (Shamsi) & Persian Date/Number Utilities (Zero-dependency)

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const JALALI_MONTHS = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

export const GREGORIAN_MONTHS_FA = [
  'ژانویه',
  'فوریه',
  'مارس',
  'آوریل',
  'مه',
  'ژوئن',
  'ژوئیه',
  'اوت',
  'سپتامبر',
  'اکتبر',
  'نوامبر',
  'دسامبر',
];

// Saturday = 0 ... Friday = 6 (Iranian standard week)
export const PERSIAN_WEEKDAYS = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
];

export const PERSIAN_WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export function toPersianDigits(input: string | number | null | undefined): string {
  if (input === null || input === undefined) return '';
  return String(input).replace(/\d/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632));
}

// Borkowski Jalali conversion algorithm
export function div(a: number, b: number): number {
  return ~~(a / b);
}

export function mod(a: number, b: number): number {
  return a - ~~(a / b) * b;
}

const JALALI_BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097,
  2192, 2262, 2324, 2394, 2456, 3178,
];

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const bl = JALALI_BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = JALALI_BREAKS[0];
  let jm = 0;
  let jump = 0;
  let n = 0;

  if (jy < jp || jy >= JALALI_BREAKS[bl - 1]) {
    throw new Error(`Invalid Jalali year ${jy}`);
  }

  for (let i = 1; i < bl; i += 1) {
    jm = JALALI_BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): { jy: number; jm: number; jd: number } {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  const jm = 7 + div(k, 30);
  const jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function isLeapJalaliYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

export function toJalali(gy: number, gm: number, gd: number): { jy: number; jm: number; jd: number } {
  return d2j(g2d(gy, gm, gd));
}

export function toGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  return d2g(j2d(jy, jm, jd));
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatIsoDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseIsoDate(iso: string): { gy: number; gm: number; gd: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { gy: y, gm: m, gd: d };
}

export function getTodayIso(): string {
  return formatIsoDate(new Date());
}

export function addDaysIso(isoDate: string, days: number): string {
  const { gy, gm, gd } = parseIsoDate(isoDate);
  const dt = new Date(gy, gm - 1, gd);
  dt.setDate(dt.getDate() + days);
  return formatIsoDate(dt);
}

// Returns Saturday=0 ... Friday=6
export function getPersianWeekdayIndex(isoDate: string): number {
  const { gy, gm, gd } = parseIsoDate(isoDate);
  const jsDay = new Date(gy, gm - 1, gd).getDay(); // Sun=0, Mon=1, ..., Sat=6
  return (jsDay + 1) % 7;
}

export function getStartOfPersianWeekIso(isoDate: string): string {
  const idx = getPersianWeekdayIndex(isoDate);
  return addDaysIso(isoDate, -idx);
}

export function getEndOfPersianWeekIso(isoDate: string): string {
  const start = getStartOfPersianWeekIso(isoDate);
  return addDaysIso(start, 6);
}

export function formatDisplayDate(
  isoDate: string | null | undefined,
  calendarType: 'jalali' | 'gregorian' = 'jalali',
  includeWeekday = false
): string {
  if (!isoDate) return 'بدون تاریخ';
  const cleanDate = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return toPersianDigits(isoDate);
  const { gy, gm, gd } = parseIsoDate(cleanDate);
  const weekday = includeWeekday ? `${PERSIAN_WEEKDAYS[getPersianWeekdayIndex(cleanDate)]} ` : '';

  if (calendarType === 'gregorian') {
    return toPersianDigits(`${weekday}${gd} ${GREGORIAN_MONTHS_FA[gm - 1]} ${gy}`);
  }
  const { jy, jm, jd } = toJalali(gy, gm, gd);
  return toPersianDigits(`${weekday}${jd} ${JALALI_MONTHS[jm - 1]} ${jy}`);
}

export function formatShortJalali(
  isoDate: string | null | undefined,
  calendarType: 'jalali' | 'gregorian' = 'jalali'
): string {
  if (!isoDate) return '—';
  const cleanDate = isoDate.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) return toPersianDigits(isoDate);
  const { gy, gm, gd } = parseIsoDate(cleanDate);
  if (calendarType === 'gregorian') {
    return toPersianDigits(`${gy}/${pad2(gm)}/${pad2(gd)}`);
  }
  const { jy, jm, jd } = toJalali(gy, gm, gd);
  return toPersianDigits(`${jy}/${pad2(jm)}/${pad2(jd)}`);
}

export function formatTimePersian(time: string | null | undefined): string {
  if (!time) return '';
  return toPersianDigits(time.slice(0, 5));
}

export function formatLiveClockPersian(date: Date): string {
  return toPersianDigits(`${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`);
}

export function formatLiveHeaderDate(date: Date, calendarType: 'jalali' | 'gregorian' = 'jalali'): string {
  const iso = formatIsoDate(date);
  return formatDisplayDate(iso, calendarType, true);
}

export function jalaliStringToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return `${gy}-${pad2(gm)}-${pad2(gd)}`;
}

export function isoToJalaliParts(isoDate: string): { jy: number; jm: number; jd: number } {
  const { gy, gm, gd } = parseIsoDate(isoDate.slice(0, 10));
  return toJalali(gy, gm, gd);
}

export function getGreetingPersian(hour: number): string {
  if (hour >= 5 && hour < 12) return 'صبح بخیر';
  if (hour >= 12 && hour < 17) return 'ظهر بخیر';
  if (hour >= 17 && hour < 21) return 'عصر بخیر';
  return 'شب بخیر';
}

export interface QuickParseResult {
  cleanTitle: string;
  suggestedDueDate: string | null;
  suggestedDueTime: string | null;
  suggestedPriority: 'critical' | 'high' | 'medium' | 'low' | null;
}

// Smart lightweight Persian parser for fast quick-capture hints
export function parseQuickNoteHints(raw: string): QuickParseResult {
  const text = toEnglishDigits(raw.trim());
  const today = getTodayIso();
  let suggestedDueDate: string | null = null;
  let suggestedDueTime: string | null = null;
  let suggestedPriority: 'critical' | 'high' | 'medium' | 'low' | null = null;

  if (/فوری|بحرانی|اورژانسی|ضروری/.test(text)) {
    suggestedPriority = 'critical';
  } else if (/مهم|اولویت/.test(text)) {
    suggestedPriority = 'high';
  }

  if (/امروز/.test(text)) {
    suggestedDueDate = today;
  } else if (/پس[\s\u200c]?فردا/.test(text)) {
    suggestedDueDate = addDaysIso(today, 2);
  } else if (/فردا/.test(text)) {
    suggestedDueDate = addDaysIso(today, 1);
  } else if (/هفته\s*(آینده|بعد)/.test(text)) {
    suggestedDueDate = addDaysIso(today, 7);
  }

  const timeMatch = text.match(/(?:ساعت|تا ساعت|راس ساعت|ساعتِ)\s*(\d{1,2})(?::(\d{2}))?/);
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = timeMatch[2] ? Number(timeMatch[2]) : 0;
    if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
      suggestedDueTime = `${pad2(h)}:${pad2(m)}`;
      if (!suggestedDueDate) suggestedDueDate = today;
    }
  }

  return {
    cleanTitle: raw.trim(),
    suggestedDueDate,
    suggestedDueTime,
    suggestedPriority,
  };
}
