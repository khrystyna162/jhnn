import { useState, useCallback } from 'react';

export interface UseDeleteActionOptions<T> {
  onDelete: (item: T) => Promise<unknown>;
  onSuccess?: () => void;
}

export interface UseDeleteActionReturn<T> {
  deleteConfirm: T | null;
  setDeleteConfirm: (item: T | null) => void;
  isDeleting: boolean;
  execute: () => Promise<void>;
}

/**
 * Custom hook for managing delete confirmation dialog and deletion logic
 * Reduces boilerplate for delete operations across pages
 *
 * @example
 * const deleteAction = useDeleteAction({
 *   onDelete: (item) => apiClient.deleteUser(item.id),
 *   onSuccess: () => loadUsers(),
 * });
 *
 * // In render:
 * <button onClick={() => deleteAction.setDeleteConfirm(user)}>Delete</button>
 *
 * <ConfirmDialog
 *   isOpen={!!deleteAction.deleteConfirm}
 *   title="Delete User?"
 *   message={`Delete ${deleteAction.deleteConfirm?.name}?`}
 *   isLoading={deleteAction.isDeleting}
 *   onConfirm={deleteAction.execute}
 *   onCancel={() => deleteAction.setDeleteConfirm(null)}
 * />
 */
export function useDeleteAction<T extends { id?: string | number }>({
  onDelete,
  onSuccess,
}: UseDeleteActionOptions<T>): UseDeleteActionReturn<T> {
  const [deleteConfirm, setDeleteConfirm] = useState<T | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const execute = useCallback(async () => {
    if (!deleteConfirm) return;

    try {
      setIsDeleting(true);
      await onDelete(deleteConfirm);
      setDeleteConfirm(null);
      onSuccess?.();
    } catch (error) {
      // Error handling is delegated to caller's error state/toast
      throw error;
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm, onDelete, onSuccess]);

  return {
    deleteConfirm,
    setDeleteConfirm,
    isDeleting,
    execute,
  };
}
