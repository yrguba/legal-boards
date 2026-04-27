import { useCallback, useEffect, useState } from 'react';
import { departmentsApi, documentsApi, groupsApi, usersApi } from '../../../services/api';
import type { Document } from '../../../types';

export function useDocumentsPageData(workspaceId: string | undefined) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [workspaceUsers, setWorkspaceUsers] = useState<{ id: string; name: string }[]>([]);

  const refresh = useCallback(async () => {
    if (!workspaceId) {
      setDocuments([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const list = await documentsApi.getByWorkspace(workspaceId);
      setDocuments(list as Document[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Не удалось загрузить документы');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    (async () => {
      try {
        const [dept, grp, users] = await Promise.all([
          departmentsApi.getByWorkspace(workspaceId),
          groupsApi.getByWorkspace(workspaceId),
          usersApi.getByWorkspace(workspaceId),
        ]);
        if (cancelled) return;
        setDepartments((dept as { id: string; name: string }[]).map((d) => ({ id: d.id, name: d.name })));
        setGroups((grp as { id: string; name: string }[]).map((g) => ({ id: g.id, name: g.name })));
        setWorkspaceUsers(
          (users as { id: string; name: string }[]).map((u) => ({ id: u.id, name: u.name })),
        );
      } catch {
        if (!cancelled) {
          setDepartments([]);
          setGroups([]);
          setWorkspaceUsers([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const filteredDocuments = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return {
    documents: filteredDocuments,
    allCount: documents.length,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    refresh,
    departments,
    groups,
    workspaceUsers,
  };
}
