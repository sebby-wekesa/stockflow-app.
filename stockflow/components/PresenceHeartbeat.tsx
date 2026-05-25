'use client'

import { useEffect } from 'react'
import { updateLastSeen } from '@/app/actions/presence'

export function PresenceHeartbeat() {
  useEffect(() => {
    // Fire-and-forget — do not block render
    updateLastSeen().catch(() => {})

    // Much gentler: every 4 minutes + on focus (prevents pooler exhaustion)
    const interval = setInterval(() => {
      updateLastSeen().catch(() => {})
    }, 4 * 60 * 1000)

    const handleFocus = () => updateLastSeen().catch(() => {})
    window.addEventListener('focus', handleFocus)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  return null
}
