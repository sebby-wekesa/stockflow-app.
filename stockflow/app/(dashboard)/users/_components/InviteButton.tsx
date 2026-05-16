'use client'

import { useState } from 'react'
import { InviteModal } from './ClientComponents'

export function InviteButton() {
  const [showModal, setShowModal] = useState(false)

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={() => setShowModal(true)}
      >
        Invite user
      </button>

      {showModal && <InviteModal onClose={() => setShowModal(false)} />}
    </>
  )
}