import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, HelpCircle, Info, X } from 'lucide-react';

type PopupTone = 'info' | 'success' | 'warning' | 'danger';
type PopupKind = 'alert' | 'confirm' | 'prompt';

interface PopupOptionsBase {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: PopupTone;
  details?: string;
}

export interface PopupAlertOptions extends PopupOptionsBase {}

export interface PopupConfirmOptions extends PopupOptionsBase {}

export interface PopupPromptOptions extends PopupOptionsBase {
  defaultValue?: string;
  placeholder?: string;
  inputLabel?: string;
  required?: boolean;
  multiline?: boolean;
}

type PopupRequest =
  | { id: string; kind: 'alert'; options: PopupAlertOptions; resolve: () => void }
  | { id: string; kind: 'confirm'; options: PopupConfirmOptions; resolve: (result: boolean) => void }
  | { id: string; kind: 'prompt'; options: PopupPromptOptions; resolve: (result: string | null) => void };

interface PopupContextType {
  showAlert: (options: string | PopupAlertOptions) => Promise<void>;
  showConfirm: (options: string | PopupConfirmOptions) => Promise<boolean>;
  showPrompt: (options: PopupPromptOptions) => Promise<string | null>;
}

const PopupContext = createContext<PopupContextType | undefined>(undefined);

const toneConfig: Record<
  PopupTone,
  {
    icon: typeof Info;
    iconClass: string;
    confirmButtonClass: string;
    badgeClass: string;
  }
> = {
  info: {
    icon: Info,
    iconClass: 'text-blue-600',
    confirmButtonClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-300',
    badgeClass: 'bg-blue-100 text-blue-700',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-green-600',
    confirmButtonClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-300',
    badgeClass: 'bg-green-100 text-green-700',
  },
  warning: {
    icon: AlertCircle,
    iconClass: 'text-amber-600',
    confirmButtonClass: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-300',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  danger: {
    icon: AlertTriangle,
    iconClass: 'text-red-600',
    confirmButtonClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-300',
    badgeClass: 'bg-red-100 text-red-700',
  },
};

function normalizeAlertOptions(options: string | PopupAlertOptions): PopupAlertOptions {
  return typeof options === 'string' ? { message: options } : options;
}

function normalizeConfirmOptions(options: string | PopupConfirmOptions): PopupConfirmOptions {
  return typeof options === 'string' ? { message: options } : options;
}

function PopupDialog({
  request,
  onResolve,
}: {
  request: PopupRequest;
  onResolve: (value?: boolean | string | null) => void;
}) {
  const tone = request.options.tone || (request.kind === 'alert' ? 'info' : request.kind === 'prompt' ? 'warning' : 'danger');
  const { icon: Icon, iconClass, confirmButtonClass, badgeClass } = toneConfig[tone];
  const [inputValue, setInputValue] = useState(
    request.kind === 'prompt' ? request.options.defaultValue || '' : ''
  );
  const [inputError, setInputError] = useState('');

  const title = request.options.title || (request.kind === 'alert' ? 'Notification' : request.kind === 'prompt' ? 'Please Confirm' : 'Confirm Action');
  const confirmText = request.options.confirmText || (request.kind === 'alert' ? 'OK' : request.kind === 'prompt' ? 'Submit' : 'Confirm');
  const cancelText = request.options.cancelText || 'Cancel';

  const closeWithCancel = useCallback(() => {
    if (request.kind === 'alert') {
      onResolve();
      return;
    }
    if (request.kind === 'confirm') {
      onResolve(false);
      return;
    }
    onResolve(null);
  }, [onResolve, request.kind]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeWithCancel();
      }

      if (event.key === 'Enter' && request.kind === 'prompt' && !request.options.multiline) {
        event.preventDefault();
        const trimmedValue = inputValue.trim();
        if (request.options.required && !trimmedValue) {
          setInputError('This field is required.');
          return;
        }
        onResolve(trimmedValue);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeWithCancel, inputValue, onResolve, request.kind, request.options.multiline, request.options.required]);

  const handleConfirm = () => {
    if (request.kind === 'alert') {
      onResolve();
      return;
    }

    if (request.kind === 'confirm') {
      onResolve(true);
      return;
    }

    const trimmedValue = inputValue.trim();
    if (request.options.required && !trimmedValue) {
      setInputError('This field is required.');
      return;
    }

    onResolve(trimmedValue);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 rounded-full p-2 ${badgeClass}`}>
              <Icon className={`h-5 w-5 ${iconClass}`} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-600">{request.options.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeWithCancel}
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close popup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {request.options.details && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p className="select-text break-all whitespace-pre-wrap font-mono">{request.options.details}</p>
            </div>
          )}

          {request.kind === 'prompt' && (
            <div>
              {request.options.inputLabel && (
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  {request.options.inputLabel}
                </label>
              )}
              {request.options.multiline ? (
                <textarea
                  value={inputValue}
                  onChange={(event) => {
                    setInputValue(event.target.value);
                    if (inputError) setInputError('');
                  }}
                  placeholder={request.options.placeholder}
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              ) : (
                <input
                  type="text"
                  value={inputValue}
                  onChange={(event) => {
                    setInputValue(event.target.value);
                    if (inputError) setInputError('');
                  }}
                  placeholder={request.options.placeholder}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              )}
              {inputError && <p className="mt-2 text-sm text-red-600">{inputError}</p>}
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 px-6 py-4 sm:flex-row sm:justify-end">
          {request.kind !== 'alert' && (
            <button
              type="button"
              onClick={closeWithCancel}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              {cancelText}
            </button>
          )}
          <button
            type="button"
            onClick={handleConfirm}
            className={`inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium text-white transition focus:outline-none focus:ring-4 ${confirmButtonClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export function PopupProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<PopupRequest[]>([]);
  const [activeRequest, setActiveRequest] = useState<PopupRequest | null>(null);

  useEffect(() => {
    if (!activeRequest && queue.length > 0) {
      const [nextRequest, ...rest] = queue;
      setActiveRequest(nextRequest);
      setQueue(rest);
    }
  }, [activeRequest, queue]);

  const enqueue = useCallback((request: PopupRequest) => {
    setQueue((prev) => [...prev, request]);
  }, []);

  const showAlert = useCallback((options: string | PopupAlertOptions) => {
    return new Promise<void>((resolve) => {
      enqueue({
        id: crypto.randomUUID(),
        kind: 'alert',
        options: normalizeAlertOptions(options),
        resolve,
      });
    });
  }, [enqueue]);

  const showConfirm = useCallback((options: string | PopupConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      enqueue({
        id: crypto.randomUUID(),
        kind: 'confirm',
        options: normalizeConfirmOptions(options),
        resolve,
      });
    });
  }, [enqueue]);

  const showPrompt = useCallback((options: PopupPromptOptions) => {
    return new Promise<string | null>((resolve) => {
      enqueue({
        id: crypto.randomUUID(),
        kind: 'prompt',
        options,
        resolve,
      });
    });
  }, [enqueue]);

  const handleResolve = useCallback((value?: boolean | string | null) => {
    if (!activeRequest) return;

    if (activeRequest.kind === 'alert') {
      activeRequest.resolve();
    } else if (activeRequest.kind === 'confirm') {
      activeRequest.resolve(Boolean(value));
    } else {
      activeRequest.resolve(value == null ? null : String(value));
    }

    setActiveRequest(null);
  }, [activeRequest]);

  const contextValue = useMemo(
    () => ({ showAlert, showConfirm, showPrompt }),
    [showAlert, showConfirm, showPrompt]
  );

  return (
    <PopupContext.Provider value={contextValue}>
      {children}
      {activeRequest ? <PopupDialog request={activeRequest} onResolve={handleResolve} /> : null}
    </PopupContext.Provider>
  );
}

export function usePopupContext() {
  const context = useContext(PopupContext);
  if (!context) {
    throw new Error('usePopupContext must be used within PopupProvider');
  }
  return context;
}

export const popupIcons = {
  info: Info,
  success: CheckCircle2,
  warning: HelpCircle,
  danger: AlertTriangle,
};
