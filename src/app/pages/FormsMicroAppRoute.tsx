import { Suspense, lazy } from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router';
import { resolveFormsEntryPath } from '../qiankun/formsMicroAppPaths';
import { applyFormsAccessTokenFromSearch } from '../qiankun/formsMicroAppBridge';
import { installFormsApiAuthFetch } from '../qiankun/formsMicroAppApiAuth';
import { isFormsModalEmbedActive } from '../qiankun/formsModalEmbedState';

const QiankunFormsOutlet = lazy(() =>
  import('../components/QiankunFormsOutlet').then((m) => ({ default: m.QiankunFormsOutlet })),
);

export function FormsMicroAppRoute() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const target = resolveFormsEntryPath(location.pathname, location.search);

  if (`${location.pathname}${location.search}` !== target) {
    applyFormsAccessTokenFromSearch(location.search);
    installFormsApiAuthFetch();
    return <Navigate to={target} replace />;
  }

  applyFormsAccessTokenFromSearch(searchParams.toString() ? `?${searchParams.toString()}` : '');
  installFormsApiAuthFetch();

  if (isFormsModalEmbedActive()) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center p-8 text-sm text-slate-600">
          Загрузка модуля форм…
        </div>
      }
    >
      <QiankunFormsOutlet />
    </Suspense>
  );
}
