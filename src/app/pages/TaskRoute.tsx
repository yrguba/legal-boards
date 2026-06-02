import { TaskPage } from './task/TaskPage';

/** /task/:taskKey — IT-19 или legacy cuid (редирект на canonical key в TaskPage) */
export function TaskRoute() {
  return <TaskPage />;
}
