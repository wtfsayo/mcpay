"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-2 overflow-hidden rounded-md border p-4 pr-8 shadow-lg transition-all",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive border-destructive bg-destructive text-destructive-foreground",
        success: "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface ToastProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof toastVariants> {
  onClose?: () => void
}

const Toast = React.forwardRef<HTMLDivElement, ToastProps>(
  ({ className, variant, onClose, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(toastVariants({ variant }), className)}
        {...props}
      >
        <div className="flex items-center space-x-2">
          {children}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    )
  }
)
Toast.displayName = "Toast"

export { Toast, toastVariants }

// Simple toast manager
let toastId = 0
const toastCallbacks = new Set<(toast: ToastItem) => void>()

interface ToastItem {
  id: number
  message: string
  variant?: "default" | "destructive" | "success"
  duration?: number
}

export const toast = {
  success: (message: string, duration = 3000) => {
    const id = ++toastId
    const toastItem: ToastItem = { id, message, variant: "success", duration }
    toastCallbacks.forEach(callback => callback(toastItem))
    
    setTimeout(() => {
      toastCallbacks.forEach(callback => callback({ ...toastItem, message: "" }))
    }, duration)
  },
  error: (message: string, duration = 3000) => {
    const id = ++toastId
    const toastItem: ToastItem = { id, message, variant: "destructive", duration }
    toastCallbacks.forEach(callback => callback(toastItem))
    
    setTimeout(() => {
      toastCallbacks.forEach(callback => callback({ ...toastItem, message: "" }))
    }, duration)
  }
}

// Toast provider hook
export const useToast = () => {
  const [toasts, setToasts] = React.useState<ToastItem[]>([])

  React.useEffect(() => {
    const callback = (toast: ToastItem) => {
      if (toast.message) {
        setToasts(prev => [...prev.filter(t => t.id !== toast.id), toast])
      } else {
        setToasts(prev => prev.filter(t => t.id !== toast.id))
      }
    }

    toastCallbacks.add(callback)
    return () => {
      toastCallbacks.delete(callback)
    }
  }, [])

  return { toasts, toast }
}

// Toast container component
export const ToastContainer = () => {
  const { toasts } = useToast()

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col space-y-2">
      {toasts.map((t) => (
        <Toast key={t.id} variant={t.variant}>
          {t.message}
        </Toast>
      ))}
    </div>
  )
} 