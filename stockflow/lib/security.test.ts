// lib/security.test.ts
import { sanitizeInput, validateEmail, validatePassword } from './security'

describe('Security utilities', () => {
  describe('sanitizeInput', () => {
    it('should remove script tags', () => {
      const input = '<script>alert("xss")</script>Hello World'
      expect(sanitizeInput(input)).toBe('Hello World')
    })

    it('should remove HTML tags', () => {
      const input = '<b>Bold</b> <i>Italic</i> Normal'
      expect(sanitizeInput(input)).toBe('Normal')
    })

    it('should trim whitespace', () => {
      const input = '  test  '
      expect(sanitizeInput(input)).toBe('test')
    })

    it('should handle non-string inputs', () => {
      expect(sanitizeInput(123 as any)).toBe('')
      expect(sanitizeInput(null as any)).toBe('')
      expect(sanitizeInput(undefined as any)).toBe('')
    })
  })

  describe('validateEmail', () => {
    it('should validate correct email formats', () => {
      expect(validateEmail('test@example.com')).toBe(true)
      expect(validateEmail('user.name+tag@example.co.uk')).toBe(true)
    })

    it('should reject invalid email formats', () => {
      expect(validateEmail('invalid')).toBe(false)
      expect(validateEmail('test@')).toBe(false)
      expect(validateEmail('@example.com')).toBe(false)
      expect(validateEmail('')).toBe(false)
    })

    it('should reject emails that are too long', () => {
      const longEmail = 'a'.repeat(250) + '@example.com'
      expect(validateEmail(longEmail)).toBe(false)
    })
  })

  describe('validatePassword', () => {
    it('should accept strong passwords', () => {
      const result = validatePassword('StrongP@ss123')
      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject weak passwords', () => {
      expect(validatePassword('weak')).toEqual({
        isValid: false,
        errors: expect.arrayContaining([
          'Password must be at least 8 characters long',
          'Password must contain at least one uppercase letter',
          'Password must contain at least one number',
        ])
      })
    })

    it('should validate individual requirements', () => {
      expect(validatePassword('nouppercase123')).toEqual({
        isValid: false,
        errors: expect.arrayContaining(['Password must contain at least one uppercase letter'])
      })

      expect(validatePassword('NOLOWERCASE123')).toEqual({
        isValid: false,
        errors: expect.arrayContaining(['Password must contain at least one lowercase letter'])
      })

      expect(validatePassword('NoNumbers')).toEqual({
        isValid: false,
        errors: expect.arrayContaining(['Password must contain at least one number'])
      })
    })
  })
})