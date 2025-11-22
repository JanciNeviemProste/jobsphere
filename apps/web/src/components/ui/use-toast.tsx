// Wrapper around sonner for compatibility with shadcn/ui toast pattern
import { toast as sonnerToast } from 'sonner'

// Re-export sonner's toast for compatibility
export const toast = sonnerToast

// Hook for compatibility with shadcn/ui pattern
export function useToast() {
  return {
    toast: sonnerToast,
  }
}

// Types for compatibility
export type ToastProps = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive'
}

// Wrapper function for shadcn/ui-style toast calls
export function showToast({ title, description, variant }: ToastProps) {
  if (variant === 'destructive') {
    sonnerToast.error(title, {
      description,
    })
  } else {
    sonnerToast.success(title, {
      description,
    })
  }
}