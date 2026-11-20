import { useState } from 'react';
import { Plus, Clock, CheckCircle2, Archive, Trash2, ArrowLeft } from 'lucide-react';
import type { AppSettings, Followup, Priority, TaskStatus } from '../types.ts';
import { JalaliDatePicker } from './JalaliDatePicker.tsx';
import { addDaysIso, formatDisplayDate, getTodayIso, toPersianDigits } from '../utils/jalali.ts';
import { FOLLOWUP_STAGES, PRIORITY_META, STATUS_META } from '../utils/taskFilters.ts';

interface FollowupsViewProps {
  followups: Followup[];
  settings: AppSettings;
  onCreateFollowup: (
    payload: Partial<Followup> & { initial_stage?: string; initial_note?: string }
  ) => Promise<Followup>;
  onUpdateFollowup: (id: string, patch: Partial<Followup>) => Promise<Followup | null>;
  onAddLog: (
    id: string,
    payload: { stage_label: string; note: string; next_followup_date?: string; status?: string }
  ) => Promise<Followup | null>;
  onDeleteFollowup: (id: string) => Promise<void>;
}

export function FollowupsView({
  followups,
  settings,
  onCreateFollowup,
  onUpdateFollowup,
  onAddLog,
  onDeleteFollowup,
}: FollowupsViewProps) {
  const activeFollowups = followups.filter((f) => !f.is_archived);
  const [selectedId, setSelectedId] = useState<string | null>(activeFollowups[0]?.id || null);
  const [showNewForm, setShowNewForm] = useState(false);

  // New followup state
  const [title, setTitle] = useState('');
  const [refCode, setRefCode] = useState('');
  const [counterparty, setCounterparty] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [nextDate, setNextDate] = useState<string>(addDaysIso(getTodayIso(), 1));
  const [nextTime, setNextTime] = useState('10:00');
  const [initialNote, setInitialNote] = useState('');

  // Add log state
  const [logStage, setLogStage] = useState(FOLLOWUP_STAGES[1]);
  const [logNote, setLogNote] = useState('');
  const [logNextDate, setLogNextDate] = useState<string>(addDaysIso(getTodayIso(), 2));
  const [logNextStatus, setLogNextStatus] = useState<TaskStatus>('waiting');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const selected = activeFollowups.find((f) => f.id === selectedId) || activeFollowups[0] || null;
  const todayIso = getTodayIso();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !nextDate) return;
    const created = await onCreateFollowup({
      title: title.trim(),
      reference_code: refCode.trim(),
      counterparty: counterparty.trim(),
      priority,
      status: 'in_progress',
      next_followup_date: nextDate,
      next_followup_time: nextTime || null,
      initial_stage: 'ثبت اولیه',
      initial_note: initialNote.trim() || 'ثبت موضوع جدید در سامانه پیگیری',
    });
    setTitle('');
    setRefCode('');
    setCounterparty('');
    setInitialNote('');
    setShowNewForm(false);
    setSelectedId(created.id);
  };

  const handleAddLogSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !logStage.trim()) return;
    await onAddLog(selected.id, {
      stage_label: logStage.trim(),
      note: logNote.trim(),
      next_followup_date: logNextDate || selected.next_followup_date,
      status: logNextStatus,
    });
    setLogNote('');
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">
            مدیریت پیگیری امور و مکاتبات
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            ثبت مراحل پیشرفت، سوابق مکاتبات و تاریخ پیگیری بعدی برای هر موضوع
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowNewForm((v) => !v)}
          className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>موضوع پیگیری جدید</span>
        </button>
      </div>

      {/* Create New Followup Panel */}
      {showNewForm && (
        <form
          onSubmit={handleCreate}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            ثبت موضوع پیگیری جدید
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                عنوان موضوع <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثلاً: پیگیری نامه اداری مجوز خرید..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                شماره نامه / پرونده
              </label>
              <input
                type="text"
                value={refCode}
                onChange={(e) => setRefCode(e.target.value)}
                placeholder="مثلاً: ۱۴۰۵/۸۴۲"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                شخص یا واحد مرتبط
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="مثلاً: واحد مالی / دبیرخانه"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                تاریخ پیگیری بعدی <span className="text-red-500">*</span>
              </label>
              <JalaliDatePicker
                value={nextDate}
                onChange={(d) => setNextDate(d || getTodayIso())}
                calendarType={settings.calendarType}
                allowClear={false}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
                اولویت و ساعت
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as Priority)}
                  className="flex-1 px-2.5 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                >
                  <option value="critical">بحرانی</option>
                  <option value="high">زیاد</option>
                  <option value="medium">متوسط</option>
                  <option value="low">کم</option>
                </select>
                <input
                  type="time"
                  value={nextTime}
                  onChange={(e) => setNextTime(e.target.value)}
                  className="w-28 px-2 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-slate-600 dark:text-slate-400 mb-1">
              شرح ثبت اولیه
            </label>
            <input
              type="text"
              value={initialNote}
              onChange={(e) => setInitialNote(e.target.value)}
              placeholder="توضیح اولیه یا اقدام انجام‌شده..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowNewForm(false)}
              className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700"
            >
              انصراف
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              ثبت موضوع پیگیری
            </button>
          </div>
        </form>
      )}

      {/* Split Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* List of Followups */}
        <div className="lg:col-span-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800">
          {activeFollowups.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              موضوع پیگیری فعالی ثبت نشده است.
            </div>
          ) : (
            activeFollowups.map((item) => {
              const isSelected = selected?.id === item.id;
              const isLate =
                item.status !== 'completed' &&
                item.status !== 'cancelled' &&
                item.next_followup_date < todayIso;
              const pMeta = PRIORITY_META[item.priority];
              const sMeta = STATUS_META[item.status];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-right p-4 transition-colors ${
                    isSelected
                      ? 'bg-blue-50/60 dark:bg-blue-950/30'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {item.title}
                    </div>
                    <span className={`text-[11px] font-medium shrink-0 ${pMeta.textClass}`}>
                      {pMeta.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                    <span className={sMeta.textClass}>{sMeta.label}</span>
                    {item.counterparty && (
                      <>
                        <span>·</span>
                        <span>{item.counterparty}</span>
                      </>
                    )}
                    <span>·</span>
                    <span className={isLate ? 'text-red-600 dark:text-red-400 font-semibold' : ''}>
                      پیگیری بعدی: {formatDisplayDate(item.next_followup_date, settings.calendarType)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Selected Followup Detail & Timeline */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          {!selected ? (
            <div className="py-12 text-center text-sm text-slate-500">
              یک موضوع را از فهرست انتخاب کنید.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
                    {selected.reference_code && <span>شماره: {toPersianDigits(selected.reference_code)}</span>}
                    {selected.reference_code && selected.counterparty && <span>·</span>}
                    {selected.counterparty && <span>طرف پیگیری: {selected.counterparty}</span>}
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {selected.title}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selected.status}
                    onChange={(e) => onUpdateFollowup(selected.id, { status: e.target.value as TaskStatus })}
                    className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                  >
                    {Object.entries(STATUS_META).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onUpdateFollowup(selected.id, { is_archived: 1 })}
                    title="انتقال به آرشیو"
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-800"
                  >
                    <Archive className="w-4 h-4" />
                  </button>

                  {confirmDeleteId === selected.id ? (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteFollowup(selected.id);
                        setConfirmDeleteId(null);
                        setSelectedId(null);
                      }}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white"
                    >
                      تأیید حذف
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(selected.id)}
                      title="حذف موضوع"
                      className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* 6-Stage Visual Stepper */}
              <div>
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                  مراحل استاندارد پیگیری (برای انتخاب سریع مرحله کلیک کنید):
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {FOLLOWUP_STAGES.map((stage, i) => {
                    const reached = selected.logs?.some((l) => l.stage_label === stage);
                    return (
                      <div key={stage} className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setLogStage(stage)}
                          className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors flex items-center gap-1 ${
                            logStage === stage
                              ? 'bg-blue-600 text-white border-blue-600 font-medium'
                              : reached
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                              : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          {reached && <CheckCircle2 className="w-3 h-3" />}
                          <span>{stage}</span>
                        </button>
                        {i < FOLLOWUP_STAGES.length - 1 && (
                          <ArrowLeft className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Progress Log Form */}
              <form
                onSubmit={handleAddLogSubmit}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
              >
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  ثبت گزارش پیگیری جدید و تعیین تاریخ پیگیری بعدی
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">مرحله</label>
                    <input
                      type="text"
                      value={logStage}
                      onChange={(e) => setLogStage(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">تاریخ پیگیری بعدی</label>
                    <JalaliDatePicker
                      value={logNextDate}
                      onChange={(d) => setLogNextDate(d || getTodayIso())}
                      calendarType={settings.calendarType}
                      allowClear={false}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">وضعیت جدید</label>
                    <select
                      value={logNextStatus}
                      onChange={(e) => setLogNextStatus(e.target.value as TaskStatus)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      {Object.entries(STATUS_META).map(([k, m]) => (
                        <option key={k} value={k}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={logNote}
                    onChange={(e) => setLogNote(e.target.value)}
                    placeholder="شرح نتیجه تماس، نامه، یا اقدام انجام‌شده..."
                    className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 hover:opacity-90 whitespace-nowrap"
                  >
                    ثبت در سوابق
                  </button>
                </div>
              </form>

              {/* Chronological Log History */}
              <div className="space-y-2.5">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>تاریخچه و سوابق پیگیری ({toPersianDigits(selected.logs?.length || 0)})</span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto">
                  {(selected.logs || []).map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-900 dark:text-slate-100">
                          {log.stage_label}
                        </span>
                        <span className="text-slate-400 tabular-nums">
                          {formatDisplayDate(log.logged_at.slice(0, 10), settings.calendarType)}
                        </span>
                      </div>
                      {log.note && (
                        <p className="text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                          {log.note}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
