import { useState, useRef, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  JALALI_MONTHS,
  GREGORIAN_MONTHS_FA,
  PERSIAN_WEEKDAYS_SHORT,
  addDaysIso,
  formatDisplayDate,
  getTodayIso,
  isoToJalaliParts,
  jalaliMonthLength,
  jalaliStringToIso,
  pad2,
  parseIsoDate,
  toJalali,
  toPersianDigits,
  getPersianWeekdayIndex,
} from '../utils/jalali.ts';

interface JalaliDatePickerProps {
  value: string | null;
  onChange: (isoDate: string | null) => void;
  calendarType?: 'jalali' | 'gregorian';
  placeholder?: string;
  allowClear?: boolean;
}

export function JalaliDatePicker({
  value,
  onChange,
  calendarType = 'jalali',
  placeholder = 'انتخاب تاریخ',
  allowClear = true,
}: JalaliDatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const initialIso = value || getTodayIso();
  const initialJalali = isoToJalaliParts(initialIso);
  const initialGreg = parseIsoDate(initialIso);

  const [viewJY, setViewJY] = useState(initialJalali.jy);
  const [viewJM, setViewJM] = useState(initialJalali.jm);
  const [viewGY, setViewGY] = useState(initialGreg.gy);
  const [viewGM, setViewGM] = useState(initialGreg.gm);

  useEffect(() => {
    if (value) {
      const jp = isoToJalaliParts(value);
      const gp = parseIsoDate(value);
      setViewJY(jp.jy);
      setViewJM(jp.jm);
      setViewGY(gp.gy);
      setViewGM(gp.gm);
    }
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const todayIso = getTodayIso();

  const handlePrevMonth = () => {
    if (calendarType === 'gregorian') {
      if (viewGM === 1) {
        setViewGM(12);
        setViewGY((y) => y - 1);
      } else {
        setViewGM((m) => m - 1);
      }
    } else {
      if (viewJM === 1) {
        setViewJM(12);
        setViewJY((y) => y - 1);
      } else {
        setViewJM((m) => m - 1);
      }
    }
  };

  const handleNextMonth = () => {
    if (calendarType === 'gregorian') {
      if (viewGM === 12) {
        setViewGM(1);
        setViewGY((y) => y + 1);
      } else {
        setViewGM((m) => m + 1);
      }
    } else {
      if (viewJM === 12) {
        setViewJM(1);
        setViewJY((y) => y + 1);
      } else {
        setViewJM((m) => m + 1);
      }
    }
  };

  const daysInMonth =
    calendarType === 'gregorian'
      ? new Date(viewGY, viewGM, 0).getDate()
      : jalaliMonthLength(viewJY, viewJM);

  const firstDayIso =
    calendarType === 'gregorian'
      ? `${viewGY}-${pad2(viewGM)}-01`
      : jalaliStringToIso(viewJY, viewJM, 1);
  const startOffset = getPersianWeekdayIndex(firstDayIso);

  const cells: Array<{ day: number; iso: string } | null> = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso =
      calendarType === 'gregorian'
        ? `${viewGY}-${pad2(viewGM)}-${pad2(d)}`
        : jalaliStringToIso(viewJY, viewJM, d);
    cells.push({ day: d, iso });
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
        >
          <span className={value ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400'}>
            {value ? formatDisplayDate(value, calendarType) : placeholder}
          </span>
          <CalendarIcon className="w-4 h-4 text-slate-400 shrink-0" />
        </button>
        {allowClear && value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="پاک کردن تاریخ"
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-red-600 hover:border-red-200 dark:hover:border-red-900 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-72 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl right-0">
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              aria-label="ماه قبل"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {calendarType === 'gregorian'
                ? `${GREGORIAN_MONTHS_FA[viewGM - 1]} ${toPersianDigits(viewGY)}`
                : `${JALALI_MONTHS[viewJM - 1]} ${toPersianDigits(viewJY)}`}
            </span>
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              aria-label="ماه بعد"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
            {PERSIAN_WEEKDAYS_SHORT.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, idx) => {
              if (!cell) return <div key={`empty-${idx}`} />;
              const isSelected = value === cell.iso;
              const isToday = todayIso === cell.iso;
              return (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`h-8 rounded-lg text-xs tabular-nums transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white font-semibold'
                      : isToday
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800'
                      : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {toPersianDigits(cell.day)}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-1 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                onChange(todayIso);
                setOpen(false);
              }}
              className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(addDaysIso(todayIso, 1));
                setOpen(false);
              }}
              className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              فردا
            </button>
            <button
              type="button"
              onClick={() => {
                onChange(addDaysIso(todayIso, 7));
                setOpen(false);
              }}
              className="px-2 py-1 text-xs rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              هفته بعد
            </button>
            {allowClear && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="px-2 py-1 text-xs rounded-md text-slate-500 hover:text-red-600"
              >
                بدون تاریخ
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
