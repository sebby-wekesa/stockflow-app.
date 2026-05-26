'use client'

import React, { useEffect, useState } from 'react'

export default function DeptEditor() {
  const [depts, setDepts] = useState<string[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    // Fetch current user org id and department list
    async function load() {
      try {
        const res = await fetch('/api/admin/departments')
        if (!res.ok) throw new Error('Failed')
        const json = await res.json()
        setDepts(json.departments || [])
        setOrgId(json.organizationId || '')
      } catch (e) {
        console.error(e)
        setMessage('Could not load departments')
      }
    }
    load()
  }, [])

  function addDept() {
    setDepts([...depts, 'New Department'])
  }

  function updateDept(i: number, value: string) {
    const copy = [...depts]
    copy[i] = value
    setDepts(copy)
  }

  function removeDept(i: number) {
    const copy = [...depts]
    copy.splice(i, 1)
    setDepts(copy)
  }

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, departments: depts }),
      })
      if (!res.ok) throw new Error('Save failed')
      setMessage('Saved')
    } catch (e) {
      console.error(e)
      setMessage('Save failed')
    }
    setSaving(false)
  }

  return (
    <div>
      {message && <div className="text-sm mb-4">{message}</div>}
      <div className="space-y-2">
        {depts.map((d, i) => (
          <div key={i} className="flex gap-2">
            <input className="input flex-1" value={d} onChange={(e) => updateDept(i, e.target.value)} />
            <button className="btn btn-ghost" onClick={() => removeDept(i)}>Remove</button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn" onClick={addDept}>Add department</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>Save</button>
      </div>
    </div>
  )
}
