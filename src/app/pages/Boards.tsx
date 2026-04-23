import { useState } from 'react';
import { Link } from 'react-router';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { boards } from '../store/mockData';
import { useApp } from '../store/AppContext';
import { CreateBoardModal } from '../components/CreateBoardModal';

export function Boards() {
  const { currentWorkspace, currentUser } = useApp();
  const workspaceBoards = boards.filter((b) => b.workspaceId === currentWorkspace?.id);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleCreateBoard = (boardData: any) => {
    console.log('Creating board:', boardData);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Рабочие доски</h1>
          <p className="text-sm text-slate-600 mt-1">
            Управление задачами и проектами
          </p>
        </div>
        {currentUser?.role === 'admin' && (
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors"
          >
            <Plus className="w-4 h-4" />
            Создать доску
          </button>
        )}
      </div>

      {workspaceBoards.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <LayoutGrid className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">Нет досок</h3>
          <p className="text-sm text-slate-600 mb-4">
            Создайте первую рабочую доску для начала работы
          </p>
          {currentUser?.role === 'admin' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-brand text-white rounded hover:bg-brand-hover transition-colors"
            >
              Создать доску
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaceBoards.map((board) => (
            <Link
              key={board.id}
              to={`/board/${board.id}`}
              className="bg-white rounded-lg border border-slate-200 p-5 hover:border-brand hover:shadow-md transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-slate-900 mb-1 group-hover:text-brand transition-colors">
                    {board.name}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-2">{board.description}</p>
                </div>
                <div className="ml-2 flex-shrink-0">
                  {board.viewMode === 'kanban' ? (
                    <LayoutGrid className="w-5 h-5 text-slate-400" />
                  ) : (
                    <List className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{board.columns.length} колонок</span>
                <span>{board.taskTypes.length} типов задач</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      <CreateBoardModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateBoard}
      />
    </div>
  );
}
