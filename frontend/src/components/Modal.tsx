import { ReactNode, useEffect } from 'react';

let openModalCount = 0;
let previousBodyOverflow = '';
let previousBodyPaddingRight = '';
let previousHtmlOverflow = '';

const lockPageScroll = () => {
  if (typeof window === 'undefined') return;

  const body = document.body;
  const html = document.documentElement;

  if (openModalCount === 0) {
    previousBodyOverflow = body.style.overflow;
    previousBodyPaddingRight = body.style.paddingRight;
    previousHtmlOverflow = html.style.overflow;

    const scrollbarWidth = window.innerWidth - html.clientWidth;
    body.style.overflow = 'hidden';
    html.style.overflow = 'hidden';

    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  openModalCount += 1;
};

const unlockPageScroll = () => {
  if (typeof window === 'undefined' || openModalCount === 0) return;

  openModalCount -= 1;
  if (openModalCount > 0) return;

  const body = document.body;
  const html = document.documentElement;

  body.style.overflow = previousBodyOverflow;
  body.style.paddingRight = previousBodyPaddingRight;
  html.style.overflow = previousHtmlOverflow;
};

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onConfirm?: () => void;
  confirmText?: string;
  confirmVariant?: 'primary' | 'danger';
  isLoading?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  onConfirm,
  confirmText = 'Зберегти',
  confirmVariant = 'primary',
  isLoading = false,
}: ModalProps) {
  useEffect(() => {
    if (!isOpen) return;

    lockPageScroll();
    return () => {
      unlockPageScroll();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isLoading) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black bg-opacity-50 px-4 py-4 sm:items-center modal-overlay">
      <div className={`modal-content flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-lg bg-white shadow-xl ${sizeClasses[size]}`}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
            disabled={isLoading}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Content */}
  <div className="flex-1 overflow-y-auto p-6">{children}</div>

        {/* Footer */}
        {onConfirm && (
          <div className="flex gap-3 justify-end p-6 border-t border-gray-200 bg-gray-50">
            <button
              onClick={onClose}
              className="btn btn-white"
              disabled={isLoading}
            >
              Скасувати
            </button>
            <button
              onClick={onConfirm}
              className={`btn ${confirmVariant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <span className="spinner inline-block mr-2 h-4 w-4"></span>
                  {confirmText}...
                </>
              ) : (
                confirmText
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  onConfirm,
  onCancel,
  isDangerous = false,
  isLoading = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      size="sm"
      onConfirm={onConfirm}
      confirmText={isDangerous ? 'Видалити' : 'Підтвердити'}
      confirmVariant={isDangerous ? 'danger' : 'primary'}
      isLoading={isLoading}
    >
      <p className="text-gray-600">{message}</p>
    </Modal>
  );
}
