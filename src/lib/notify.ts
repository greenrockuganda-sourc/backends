import { toast, ToastOptions } from 'react-toastify'

const DEFAULT_OPTS: ToastOptions = {
  position: 'bottom-right',
  autoClose: 4000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
  theme: 'colored',
}

export function notifySuccess(message: string, opts?: ToastOptions) {
  toast.success(message, { ...DEFAULT_OPTS, ...opts })
}

export function notifyError(message: string, opts?: ToastOptions) {
  toast.error(message, { ...DEFAULT_OPTS, ...opts })
}

export function notifyInfo(message: string, opts?: ToastOptions) {
  toast.info(message, { ...DEFAULT_OPTS, ...opts })
}

export default {
  success: notifySuccess,
  error: notifyError,
  info: notifyInfo,
}
