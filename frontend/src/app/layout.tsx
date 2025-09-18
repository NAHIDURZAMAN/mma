import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { NavigationRouter } from '@/components/NavigationRouter'
import { AuthProvider } from '@/contexts/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Smart Transit - RFID Management System',
  description: 'A modern web interface for managing RFID-based transit system with real-time Arduino ESP8266 integration',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-background flex">
            <NavigationRouter />
            <div className="flex-1 flex flex-col">
              <header className="border-b">
                <div className="px-6 py-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Real-time monitoring • Arduino ESP8266 Integration
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span className="text-sm text-green-600">System Online</span>
                    </div>
                  </div>
                </div>
              </header>
              <main className="flex-1 px-6 py-6 overflow-y-auto">
                {children}
              </main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
