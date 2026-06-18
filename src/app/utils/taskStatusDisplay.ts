const STATUS_DOT_FALLBACK_PALETTE = [
  'bg-sky-500',
  'bg-indigo-500',
  'bg-fuchsia-500',
  'bg-cyan-600',
  'bg-teal-500',
  'bg-orange-500',
] as const;

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Цвет индикатора статуса по названию колонки исходной доски */
export function statusDotClass(columnName: string): string {
  const n = columnName.toLowerCase();

  if (
    n.includes('отмен') ||
    n.includes('отказ') ||
    n.includes('reject') ||
    n.includes('cancel') ||
    n.includes('отклон')
  ) {
    return 'bg-rose-500';
  }

  if (
    n.includes('заверш') ||
    n.includes('done') ||
    n.includes('готов') ||
    n.includes('resolved') ||
    n.includes('complete') ||
    n.includes('успеш') ||
    n.includes('закрыт') ||
    n.includes('выполнено') ||
    n.includes('выполнены') ||
    n.includes('решён') ||
    n.includes('решен')
  ) {
    return 'bg-emerald-500';
  }

  if (
    (n.includes('нов') ||
      n.includes('поступ') ||
      n.includes('входящ') ||
      n.includes('backlog') ||
      n.includes('to do') ||
      n.includes('queue')) &&
    !(n.includes('обновлен') || n.includes('новост'))
  ) {
    return 'bg-blue-500';
  }

  if (
    n.includes('ожид') ||
    n.includes('waiting') ||
    n.includes('пауз') ||
    n.includes('hold') ||
    n.includes('уточн')
  ) {
    return 'bg-amber-500';
  }

  if (n.includes('рассмотр') || n.includes('review') || n.includes('проверк') || n.includes('эксперт')) {
    return 'bg-violet-500';
  }

  if (
    n.includes('работ') ||
    n.includes('progress') ||
    n.includes('исполня') ||
    n.includes('выполня') ||
    n.includes('обработ') ||
    n.includes('взято') ||
    n.includes('in progress')
  ) {
    return 'bg-cyan-600';
  }

  if (n.includes('соглас') || n.includes('approval') || n.includes('контракт')) {
    return 'bg-teal-500';
  }

  if (n.includes('оплат') || n.includes('счёт') || n.includes('счет') || n.includes('invoice')) {
    return 'bg-orange-500';
  }

  const idx = hashString(n) % STATUS_DOT_FALLBACK_PALETTE.length;
  return STATUS_DOT_FALLBACK_PALETTE[idx];
}
