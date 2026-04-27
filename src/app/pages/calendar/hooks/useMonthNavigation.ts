import { useState } from 'react';
import { addMonths } from 'date-fns';

export function useMonthNavigation(initial = new Date()) {
  const [month, setMonth] = useState(() => {
    const d = new Date(initial);
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const goPrev = () => setMonth((m) => addMonths(m, -1));
  const goNext = () => setMonth((m) => addMonths(m, 1));
  const goToday = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    setMonth(d);
  };
  return { month, setMonth, goPrev, goNext, goToday };
}
