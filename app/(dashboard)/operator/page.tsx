"use client"
import { useState, useEffect } from 'react'
import { fetchStock } from './actions'

export default function OperatorPage() {
  const [data, setData] = useState([])

  useEffect(() => {
    fetchStock().then(setData)
  }, [])

  return (
    <div>
      {/* Your interactive buttons here work fine! */}
      <button onClick={() => console.log("Still interactive!")}>Add Item</button>
      {data.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  )
}