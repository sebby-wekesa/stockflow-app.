'use client'

import { useState } from 'react'

function getFilename(response: Response, fallback: string) {
  const disposition = response.headers.get('Content-Disposition')
  const match = disposition?.match(/filename="?([^"]+)"?/)
  return match?.[1] ?? fallback
}

export function DownloadReportButton({
  href,
  filename,
}: {
  href: string
  filename: string
}) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setIsDownloading(true)
    setError(null)

    try {
      const response = await fetch(href)
      if (!response.ok) {
        const message = await response.text()
        throw new Error(message || `Download failed (${response.status})`)
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = getFilename(response, filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <div className="report-download">
      <button
        type="button"
        className="btn btn-primary w-full"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? 'Preparing CSV...' : 'Download CSV'}
      </button>
      {error && <div className="report-download-error">{error}</div>}
    </div>
  )
}
