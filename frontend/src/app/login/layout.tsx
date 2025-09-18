import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Login - Smart Transit RFID System',
  description: 'Sign in to your Smart Transit account',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
