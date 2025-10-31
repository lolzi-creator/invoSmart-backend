/**
 * Email Helper Utilities
 * Centralized email sending utilities with support for multiple recipients
 */

export interface EmailRecipients {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
}

/**
 * Normalize email recipients to array format
 * Resend accepts both string and array, but we'll always use arrays for consistency
 */
export function normalizeEmailRecipients(recipients: EmailRecipients): {
  to: string[]
  cc?: string[]
  bcc?: string[]
} {
  return {
    to: Array.isArray(recipients.to) ? recipients.to : [recipients.to],
    cc: recipients.cc ? (Array.isArray(recipients.cc) ? recipients.cc : [recipients.cc]) : undefined,
    bcc: recipients.bcc ? (Array.isArray(recipients.bcc) ? recipients.bcc : [recipients.bcc]) : undefined
  }
}

/**
 * Validate email addresses
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate multiple email addresses
 */
export function validateEmails(emails: string | string[]): { valid: string[], invalid: string[] } {
  const emailList = Array.isArray(emails) ? emails : [emails]
  const valid: string[] = []
  const invalid: string[] = []

  emailList.forEach(email => {
    const trimmed = email.trim().toLowerCase()
    if (trimmed && validateEmail(trimmed)) {
      valid.push(trimmed)
    } else if (trimmed) {
      invalid.push(email)
    }
  })

  return { valid, invalid }
}

