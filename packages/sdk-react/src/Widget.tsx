'use client'

import { useEffect } from 'react'

interface FeedbackKitUser {
  id?: string
  email?: string
  name?: string
  metadata?: Record<string, unknown>
}

interface FeedbackKitProps {
  projectKey: string
  user?: FeedbackKitUser
}

declare global {
  interface Window {
    FeedbackKit?: {
      open(): void
      identify(user: FeedbackKitUser): void
      setMetadata(meta: Record<string, unknown>): void
    }
  }
}

/**
 * Drop this component anywhere in your Next.js/React app.
 * It lazy-loads the widget script and optionally identifies the user.
 *
 * @example
 * // In your root layout:
 * <FeedbackKit projectKey="pk_live_abc123" user={{ id: user.id, email: user.email }} />
 */
export function FeedbackKit({ projectKey, user }: FeedbackKitProps) {
  useEffect(() => {
    if (window.FeedbackKit) return // already loaded

    const script = document.createElement('script')
    script.src = 'https://cdn.feedbackkit.io/v1/widget.js'
    script.async = true
    script.dataset['project'] = projectKey
    document.body.appendChild(script)
  }, [projectKey])

  useEffect(() => {
    if (user) {
      window.FeedbackKit?.identify(user)
    }
  }, [user])

  return null
}

export type { FeedbackKitProps, FeedbackKitUser }
