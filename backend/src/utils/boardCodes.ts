/** Короткий латинский код доски для URL и ключей задач (только новые доски). */
export const NEW_BOARD_CODE_RE = /^[A-Z0-9]{2,12}$/;

export function normalizeNewBoardCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toUpperCase();
  if (!NEW_BOARD_CODE_RE.test(code)) return null;
  return code;
}

export function isNewBoardCodeFormat(code: string): boolean {
  return NEW_BOARD_CODE_RE.test(code);
}

export function boardCodeValidationError(code: string): string | null {
  if (code.length < 2) return 'Код доски: минимум 2 символа';
  if (code.length > 12) return 'Код доски: максимум 12 символов';
  if (!NEW_BOARD_CODE_RE.test(code)) {
    return 'Код доски: только латиница A–Z и цифры 0–9 (2–12 символов)';
  }
  return null;
}
