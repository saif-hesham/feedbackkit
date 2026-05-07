import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'FeedbackKit',
  description: 'Lightweight customer feedback & visual bug reporter',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
