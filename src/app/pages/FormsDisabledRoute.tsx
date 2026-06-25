import { Link } from 'react-router';

export function FormsDisabledRoute() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-lg font-medium text-slate-900">Модуль Legal Forms временно отключён</p>
      <p className="max-w-md text-sm text-slate-600">
        Чтобы включить, задайте при сборке фронта{' '}
        <span className="font-mono text-xs">VITE_FORMS_MICROAPP_ENABLED=true</span> и настройте
        прокси LF API.
      </p>
      <Link to="/" className="text-sm font-medium text-brand hover:underline">
        Вернуться к доскам
      </Link>
    </div>
  );
}
