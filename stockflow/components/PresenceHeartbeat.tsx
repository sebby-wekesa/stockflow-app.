'use client'

import { useEffect } from 'react'
import { updateLastSeen } from '@/app/actions/presence'

export function PresenceHeartbeat() {
  useEffect(() => {
    // Update immediately on mount
    updateLastSeen()

    // Then update every 45 seconds while the tab is active
    const interval = setInterval(() => {
      updateLastSeen()
    }, 45 * 1000)

    // Also update when the user becomes active again (tab focus)
    const handleFocus = () => updateLastSeen()
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return null
}
