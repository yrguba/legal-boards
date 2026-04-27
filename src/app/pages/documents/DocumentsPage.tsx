import { useState, useCallback } from 'react';
import { useApp } from '../../store/AppContext';
import { documentsApi } from '../../services/api';
import { getApiBaseUrl } from '../task/utils/apiBaseUrl';
import { useDocumentsPageData } from './hooks/useDocumentsPageData';
import { DocumentsToolbar } from './components/DocumentsToolbar';
import { DocumentsTable } from './components/DocumentsTable';
import { DocumentUploadModal } from './components/DocumentUploadModal';
import type { Document } from '../../types';

export function DocumentsPage() {
  const { currentWorkspace, currentUser } = useApp();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const apiBaseUrl = getApiBaseUrl();

  const {
    documents,
    allCount,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh,
    departments,
    groups,
    workspaceUsers,
  } = useDocumentsPageData(currentWorkspace?.id);

  const handleUpload = useCallback(
    async (file: File, visibility: Record<string, unknown>) => {
      if (!currentWorkspace) return;
      setUploading(true);
      setUploadError(null);
      try {
        await documentsApi.upload(file, currentWorkspace.id, visibility);
        await refresh();
        setUploadOpen(false);
      } catch (e: unknown) {
        setUploadError(e instanceof Error ? e.message : 'Ошибка загрузки');
      } finally {
        setUploading(false);
      }
    },
    [currentWorkspace, refresh],
  );

  const handleDelete = useCallback(
    async (doc: Document) => {
      if (!currentUser) return;
      if (!confirm(`Удалить «${doc.name}»? Документ исчезнет изо всех задач, где был прикреплён.`)) {
        return;
      }
      try {
        await documentsApi.delete(doc.id);
        await refresh();
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Не удалось удалить');
      }
    },
    [currentUser, refresh],
  );

  if (!currentWorkspace) {
    return (
      <div className="p-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-lg px-4 py-3 text-sm">
          Выберите рабочее пространство в шапке, чтобы работать с документами.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <DocumentsToolbar
        searchQuery={searchQuery}
        onSearch={setSearchQuery}
        onOpenUpload={() => {
          setUploadError(null);
          setUploadOpen(true);
        }}
        uploadDisabled={false}
      />

      {error ? (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading && documents.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 p-8 text-center text-sm text-slate-600">
          Загрузка…
        </div>
      ) : null}

      {!loading || documents.length > 0 ? (
        <DocumentsTable
          documents={documents}
          apiBaseUrl={apiBaseUrl}
          onDelete={handleDelete}
          canDelete={(doc) =>
            currentUser?.role === 'admin' || doc.uploadedBy === currentUser?.id
          }
          noSearchMatch={Boolean(searchQuery.trim() && allCount > 0 && documents.length === 0)}
        />
      ) : null}

      <DocumentUploadModal
        open={uploadOpen}
        onClose={() => !uploading && setUploadOpen(false)}
        workspaceId={currentWorkspace.id}
        departments={departments}
        groups={groups}
        workspaceUsers={workspaceUsers}
        onSubmit={handleUpload}
        uploading={uploading}
        error={uploadError}
      />
    </div>
  );
}
