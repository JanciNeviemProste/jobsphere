import { toast } from 'sonner'

/**
 * Toast Notifications Hook
 * Wrapper around Sonner for consistent toast notifications
 */
export function useToastNotifications() {
  const success = (message: string, description?: string) => {
    toast.success(message, {
      description,
      duration: 3000,
      position: 'top-right',
    })
  }

  const error = (message: string, description?: string) => {
    toast.error(message, {
      description,
      duration: 5000,
      position: 'top-right',
    })
  }

  const info = (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 4000,
      position: 'top-right',
    })
  }

  const warning = (message: string, description?: string) => {
    toast.warning(message, {
      description,
      duration: 4000,
      position: 'top-right',
    })
  }

  const loading = (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
    })
  }

  const promise = <T,>(
    promise: Promise<T>,
    {
      loading: loadingMsg,
      success: successMsg,
      error: errorMsg,
    }: {
      loading: string
      success: string | ((data: T) => string)
      error: string | ((error: any) => string)
    }
  ) => {
    return toast.promise(promise, {
      loading: loadingMsg,
      success: successMsg,
      error: errorMsg,
      position: 'top-right',
    })
  }

  const dismiss = (toastId?: string | number) => {
    toast.dismiss(toastId)
  }

  return {
    success,
    error,
    info,
    warning,
    loading,
    promise,
    dismiss,
  }
}

/**
 * Common toast messages
 */
export const TOAST_MESSAGES = {
  // Success messages
  SAVED: 'Úspešne uložené',
  CREATED: 'Úspešne vytvorené',
  UPDATED: 'Úspešne aktualizované',
  DELETED: 'Úspešne vymazané',
  SENT: 'Úspešne odoslané',
  UPLOADED: 'Úspešne nahrané',

  // Error messages
  ERROR: 'Nastala chyba',
  SAVE_ERROR: 'Nepodarilo sa uložiť',
  LOAD_ERROR: 'Nepodarilo sa načítať',
  DELETE_ERROR: 'Nepodarilo sa vymazať',
  UPLOAD_ERROR: 'Nepodarilo sa nahrať',
  NETWORK_ERROR: 'Chyba pripojenia',
  UNAUTHORIZED: 'Nemáte oprávnenie na túto akciu',

  // Loading messages
  SAVING: 'Ukladám...',
  LOADING: 'Načítavam...',
  UPLOADING: 'Nahrávam...',
  PROCESSING: 'Spracúvam...',
  DELETING: 'Mažem...',
}
