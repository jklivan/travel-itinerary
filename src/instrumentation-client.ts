import { isStaleDeployError, reloadForNewDeploy, reportClientError } from '@/lib/clientErrors'

try {
  window.addEventListener('error', event => {
    reportClientError('window-error', event.error ?? event.message)
    if (isStaleDeployError(event.error ?? event.message)) reloadForNewDeploy()
  })
  window.addEventListener('unhandledrejection', event => {
    reportClientError('unhandled-rejection', event.reason)
    if (isStaleDeployError(event.reason)) reloadForNewDeploy()
  })
} catch {}
