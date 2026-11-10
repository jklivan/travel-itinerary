import { isStaleDeployError, reloadForNewDeploy, reportClientError } from '@/lib/clientErrors'
import { startAnalytics } from '@/lib/analytics'

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

try { startAnalytics() } catch {}
