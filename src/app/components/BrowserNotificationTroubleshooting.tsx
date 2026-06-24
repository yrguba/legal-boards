import { isChromeBrowser } from '../utils/browserNotifications';

type Props = {
  siteLabel?: string;
};

export function BrowserNotificationTroubleshooting({ siteLabel }: Props) {
  const site =
    siteLabel ??
    (typeof window !== 'undefined' ? window.location.hostname : 'этот сайт');

  if (isChromeBrowser()) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-700 leading-relaxed">
        <p className="font-medium text-slate-900 mb-1.5">Не видите уведомления в Chrome</p>
        <ol className="list-decimal ml-4 space-y-1">
          <li>
            Замок в адресной строке → «Настройки сайта» → Уведомления →{' '}
            <strong>Разрешить</strong> (не «Тихие»).
          </li>
          <li>
            <code className="rounded bg-white/80 px-1">chrome://settings/content/notifications</code>{' '}
            — для {site} должно быть «Разрешено».
          </li>
          <li>
            macOS: System Settings → Notifications → <strong>Google Chrome</strong> → Allow
            Notifications, стиль Banners или Alerts.
          </li>
          <li>Отключите Focus / «Не беспокоить» или добавьте Chrome в исключения.</li>
        </ol>
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-slate-700 leading-relaxed">
      <p className="font-medium text-slate-900 mb-1.5">Не видите уведомления</p>
      <ol className="list-decimal ml-4 space-y-1">
        <li>Разрешите уведомления для этого сайта в настройках браузера.</li>
        <li>
          macOS: System Settings → Notifications → ваш браузер → Allow Notifications, стиль Banners
          или Alerts.
        </li>
        <li>Отключите Focus / «Не беспокоить».</li>
      </ol>
    </div>
  );
}
