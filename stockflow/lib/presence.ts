export function isUserOnline(lastSeenAt: Date | string | null | undefined): boolean {
  if (!lastSeenAt) return false

  const lastSeen = typeof lastSeenAt === 'string' ? new Date(lastSeenAt) : lastSeenAt
  const now = new Date()
  const diffInMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60)

  // Consider user online if they were active in the last 5 minutes
  return diffInMinutes < 5
}

export function getOnlineStatus(lastSeenAt: Date | string | null | undefined) {
  if (isUserOnline(lastSeenAt)) {
    return { label: 'Online', color: 'var(--green)', dot: true }
  }
  return { label: 'Offline', color: 'var(--muted)', dot: false }
}
