"use client"

import { type InputHTMLAttributes, useState } from "react"
import { Eye, EyeOff } from "lucide-react"

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type">

export function PasswordInput({
  className = "form-input",
  disabled,
  style,
  ...props
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  const label = isVisible ? "Hide password" : "Show password"

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
      <input
        {...props}
        type={isVisible ? "text" : "password"}
        className={className}
        disabled={disabled}
        style={{
          ...style,
          width: "100%",
          paddingRight: "42px",
        }}
      />
      <button
        type="button"
        className="icon-btn"
        aria-label={label}
        aria-pressed={isVisible}
        title={label}
        disabled={disabled}
        onClick={() => setIsVisible((current) => !current)}
        style={{
          position: "absolute",
          right: "6px",
          top: "50%",
          transform: "translateY(-50%)",
          border: "none",
          background: "transparent",
        }}
      >
        {isVisible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
      </button>
    </div>
  )
}
