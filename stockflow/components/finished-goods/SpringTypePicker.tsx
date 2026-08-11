'use client'

import { useId, useState } from 'react'

export type SpringTypeOption = {
  id: string
  name: string
  sku: string | null
}

function getOptionLabel(option: SpringTypeOption) {
  return option.sku ? `${option.name} · ${option.sku}` : option.name
}

export default function SpringTypePicker({
  options,
  name,
  id,
  initialId = '',
  placeholder = 'Type 3–5 words to search springs',
}: {
  options: SpringTypeOption[]
  name: string
  id: string
  initialId?: string
  placeholder?: string
}) {
  const generatedId = useId().replace(/:/g, '')
  const listId = `${id}-options-${generatedId}`
  const initialOption = options.find((option) => option.id === initialId)
  const [query, setQuery] = useState(initialOption ? getOptionLabel(initialOption) : '')
  const [selectedId, setSelectedId] = useState(initialId)

  function handleChange(value: string) {
    const normalizedValue = value.trim().toLowerCase()
    const selectedOption = options.find((option) => {
      const label = getOptionLabel(option).toLowerCase()
      return label === normalizedValue || option.name.toLowerCase() === normalizedValue
    })

    setQuery(value)
    setSelectedId(selectedOption?.id ?? '')
  }

  return (
    <>
      <input
        id={id}
        name={`${name}Display`}
        className="form-input"
        list={listId}
        value={query}
        onChange={(event) => handleChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={selectedId} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option.id} value={getOptionLabel(option)} />
        ))}
      </datalist>
    </>
  )
}
