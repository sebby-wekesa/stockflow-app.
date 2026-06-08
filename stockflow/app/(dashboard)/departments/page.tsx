'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function DepartmentsPage() {
  const [departments, setDepartments] = useState<string[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    async function fetchDepartments() {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch('/api/admin/departments', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch departments: ${response.statusText}`)
        }

        const data = await response.json()
        setDepartments(data.departments || [])
      } catch (err) {
        console.error('Error fetching departments:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchDepartments()
  }, [searchParams])

  if (loading) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Departments</h2>
        <p className="text-center text-muted">Loading departments...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Departments</h2>
        <p className="text-center text-destructive">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Departments</h2>
        {departments.length === 0 ? (
          <p className="text-center text-muted">No departments found. This may be because no users have been assigned to departments yet.</p>
        ) : (
          <div className="space-y-3">
            {departments.map((dept, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded">
                <span className="font-medium">{dept}</span>
                <span className="text-xs text-muted">department</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-xl font-bold mb-4">Statistics</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Total Departments:</span>
            <span className="font-medium">{departments.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Default Departments:</span>
            <span className="font-medium">{['Production'].length}</span>
          </div>
        </div>
      </div>
    </div>
  )
}