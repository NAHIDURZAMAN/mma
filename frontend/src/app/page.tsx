import { Dashboard } from '@/components/Dashboard'

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Monitor and manage your Smart Transit RFID system in real-time.
        </p>
      </div>
      
      <Dashboard />
    </div>
  )
}
