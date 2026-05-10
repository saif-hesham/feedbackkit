/**
 * FeedbackKit Widget — Entry Point
 *
 * This is the script customers paste on their site:
 *   <script async src="https://cdn.feedbackkit.io/v1/widget.js"
 *           data-project="pk_live_abc123"></script>
 *
 * Rules:
 *  1. Never pollute global scope beyond window.FeedbackKit
 *  2. All UI is inside a Shadow DOM — no CSS leakage either way
 *  3. Never block the customer's main thread — heavy libs are lazy-loaded
 */

// Placeholder — full implementation comes in Week 3
class FeedbackKitWidget {
  private projectKey: string

  constructor(projectKey: string) {
    this.projectKey = projectKey
    console.warn(`[FeedbackKit] Initialized with project key: ${projectKey}`)
  }

  // Public API — used by sdk-react and direct callers
  open() {
    console.warn('[FeedbackKit] open() called — widget UI coming in Week 3')
  }

  identify(_user: {
    id?: string
    email?: string
    name?: string
    metadata?: Record<string, unknown>
  }) {
    console.warn('[FeedbackKit] identify() called')
  }

  setMetadata(_meta: Record<string, unknown>) {
    console.warn('[FeedbackKit] setMetadata() called')
  }
}

// Self-init from <script data-project="...">
const script = document.currentScript as HTMLScriptElement | null
const key = script?.dataset['project']
if (key) {
  ;(window as unknown as Record<string, unknown>)['FeedbackKit'] = new FeedbackKitWidget(key)
} else {
  console.error('[FeedbackKit] No data-project key found on script tag.')
}
