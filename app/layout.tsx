import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'BrainDump',
  description: 'Train and explore the MTA knowledge brain',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="https://oxfordhub.app/hub-nav.js"
          data-project-id={process.env.NEXT_PUBLIC_HUB_PROJECT_ID || ''}
          strategy="afterInteractive"
          id="hub-nav"
        />
      </body>
    </html>
  )
}
