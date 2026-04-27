/**
 * Общие классы Tailwind для страницы задачи (поля, карточки, вкладки)
 */
export const t = {
  input:
    'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand',
  inputTitle:
    'w-full px-3 py-2 border border-slate-300 rounded text-base font-semibold focus:outline-none focus:ring-2 focus:ring-brand',
  textarea: 'w-full px-3 py-2 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-y',
  card: 'bg-white rounded-lg border border-slate-200',
  labelMuted: 'text-sm text-slate-600 mb-1',
  btnSecondary: 'px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 rounded transition-colors',
  btnPrimary: 'px-3 py-2 text-sm bg-brand text-white rounded hover:bg-brand-hover transition-colors',
  errBanner: 'rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700',
  tabButton: (active: boolean) =>
    `flex-1 px-3 py-2 text-sm transition-colors ${
      active ? 'border-b-2 border-brand font-medium text-brand' : 'text-slate-600 hover:text-slate-900'
    }`,
  iconRailBtn: (active: boolean) =>
    `rounded-lg p-2.5 transition-colors ${
      active ? 'bg-brand-light text-brand' : 'text-slate-500 hover:bg-slate-200/80'
    }`,
  chatInput: 'min-w-0 flex-1 rounded border border-slate-300 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-brand',
  sendBtn: 'shrink-0 rounded bg-brand px-3 py-2 text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50',
} as const;
