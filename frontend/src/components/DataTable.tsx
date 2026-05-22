import { ReactNode } from 'react';

export interface DataTableColumn<T> {
  key: keyof T;
  label: string;
  render?: (value: any, row: T) => ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: keyof T;
  loading?: boolean;
  onRowClick?: (row: T) => void;
  actions?: (row: T) => ReactNode;
  pagination?: {
    total: number;
    pageSize: number;
    currentPage: number;
    onPageChange: (page: number) => void;
  };
  emptyMessage?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
}

const alignClasses = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  loading = false,
  onRowClick,
  actions,
  pagination,
  emptyMessage = 'Немає даних',
  sortBy,
  sortOrder,
  onSort,
}: DataTableProps<T>) {
  const rows = Array.isArray(data) ? data : [];
  const pageStart = pagination
    ? pagination.total === 0
      ? 0
      : (pagination.currentPage - 1) * pagination.pageSize + 1
    : 0;
  const pageEnd = pagination
    ? Math.min(pagination.currentPage * pagination.pageSize, pagination.total)
    : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {columns.map((col) => (
              <th
                key={String(col.key)}
                className={`px-6 py-3 font-semibold text-sm text-gray-700 ${alignClasses[col.align || 'left']} ${col.sortable && onSort ? 'cursor-pointer hover:bg-gray-100' : ''}`}
                onClick={() => col.sortable && onSort && onSort(String(col.key))}
                style={{ width: col.width }}
              >
                <div className="flex items-center gap-2">
                  <span>{col.label}</span>
                  {col.sortable && sortBy === String(col.key) && (
                    <span className="text-xs">
                      {sortOrder === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </div>
              </th>
            ))}
            {actions && <th className="px-6 py-3 font-semibold text-sm text-gray-700">Дії</th>}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center">
                <div className="flex items-center justify-center">
                  <div className="spinner"></div>
                  <span className="ml-3 text-gray-600">Завантаження...</span>
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-6 py-12 text-center text-gray-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={String(row[rowKey])}
                className={`border-b border-gray-100 ${
                  onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''
                } transition`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td
                    key={String(col.key)}
                    className={`px-6 py-4 text-sm text-gray-700 ${alignClasses[col.align || 'left']}`}
                    style={{ width: col.width }}
                  >
                    {col.render ? col.render(row[col.key], row) : String(row[col.key])}
                  </td>
                ))}
                {actions && (
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination && (
        <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            Показано {pageStart}-{pageEnd} з {pagination.total}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
              disabled={pagination.currentPage === 1}
              className="btn btn-small btn-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Попередня
            </button>
            <div className="flex items-center gap-2 px-4">
              <span className="text-sm text-gray-600">
                Сторінка {pagination.currentPage} з{' '}
                {Math.ceil(pagination.total / pagination.pageSize)}
              </span>
            </div>
            <button
              onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
              disabled={
                pagination.currentPage >=
                Math.ceil(pagination.total / pagination.pageSize)
              }
              className="btn btn-small btn-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Наступна
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
