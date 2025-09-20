'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, Users, Clock, Navigation, Wifi, WifiOff, Shield, AlertTriangle } from 'lucide-react'
import dynamic from 'next/dynamic'
import { io } from 'socket.io-client'

// Dynamically import map component to avoid SSR issues
const MapComponent = dynamic(() => import('@/components/BusLocationMap'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 rounded-lg flex items-center justify-center">Loading Map...</div>
})

interface BusData {
  currentLocation: {
    latitude: number
    longitude: number
    locationName: string
  }
  passengers: {
    current: number
    total: number
    available: number
  }
  lastUpdated: string
  isOnline: boolean
  isJourneyActive: boolean
  journeyStatus: string
}

interface SimulationStatus {
  isRunning: boolean
  currentPosition: { lat: number; lng: number }
  destinations: Array<{ lat: number; lng: number; name?: string }>
  currentDestinationIndex: number
  progress: number
  isWaitingAtStation: boolean
}

export default function UserDashboard() {
  const { user, isAuthenticated, refreshUser } = useAuth()
  const [busData, setBusData] = useState<BusData | null>(null)
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [socket, setSocket] = useState<any>(null)
  const [cardBlocked, setCardBlocked] = useState(false)
  const [blockLoading, setBlockLoading] = useState(false)
  const [cardStatus, setCardStatus] = useState<{
    is_blocked: boolean
    blocked_at: string | null
    blocked_reason: string | null
    blocked_by: string | null
  } | null>(null)
  const [blockReason, setBlockReason] = useState('')

  // Handle balance updates from payment
  const handleBalanceUpdate = async () => {
    try {
      await refreshUser() // Refresh user data from AuthContext
    } catch (error) {
      console.error('Error refreshing user balance:', error)
    }
  }

  // Handle card blocking
  const handleBlockCard = async () => {
    if (!blockReason.trim()) {
      alert('Please provide a reason for blocking your card.')
      return
    }

    if (!confirm('Are you sure you want to block your card? This action will prevent all transactions until you contact support to unblock it.')) {
      return
    }

    setBlockLoading(true)
    try {
      const response = await fetch('http://localhost:2000/api/cards/block', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user?.user_id,
          reason: blockReason.trim(),
          blockedBy: 'User Self-Service'
        }),
        credentials: 'include',
      })

      const data = await response.json()
      
      if (data.success) {
        setCardBlocked(true)
        setBlockReason('')
        await loadCardStatus() // Refresh card status
        alert('Your card has been blocked successfully. Contact customer support to unblock it.')
      } else {
        alert('Failed to block card: ' + (data.message || 'Unknown error'))
      }
    } catch (error) {
      console.error('Error blocking card:', error)
      alert('Failed to block card. Please try again or contact support.')
    } finally {
      setBlockLoading(false)
    }
  }

  // Load card status from backend
  const loadCardStatus = async () => {
    if (!user?.user_id) return

    try {
      const response = await fetch(`http://localhost:2000/api/users`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      })

      const data = await response.json()
      
      if (data.success && data.data) {
        const currentUser = data.data.find((u: any) => u.user_id === user.user_id)
        if (currentUser) {
          setCardStatus({
            is_blocked: currentUser.is_blocked || false,
            blocked_at: currentUser.blocked_at,
            blocked_reason: currentUser.blocked_reason,
            blocked_by: currentUser.blocked_by
          })
          setCardBlocked(currentUser.is_blocked || false)
        }
      }
    } catch (error) {
      console.error('Error loading card status:', error)
    }
  }

  // Connect to WebSocket for real-time simulation updates
  useEffect(() => {
    const socketConnection = io('http://localhost:2000')
    
    socketConnection.on('connect', () => {
      console.log('Connected to simulation WebSocket')
      setSocket(socketConnection)
    })

    socketConnection.on('simulation_status', (status: SimulationStatus) => {
      console.log('Simulation status update:', status)
      setSimulationStatus(status)
    })

    socketConnection.on('vehicle_position_update', (data: any) => {
      console.log('Vehicle position update:', data)
      if (simulationStatus?.isRunning) {
        setSimulationStatus(prev => prev ? {
          ...prev,
          currentPosition: { lat: data.lat, lng: data.lng }
        } : null)
      }
    })

    socketConnection.on('balance_updated', (data: any) => {
      console.log('Balance updated:', data)
      if (data.userId === user?.user_id) {
        handleBalanceUpdate()
      }
    })

    socketConnection.on('card_blocked', (data: any) => {
      console.log('Card blocked:', data)
      if (data.userId === user?.user_id) {
        loadCardStatus() // Refresh card status
        alert(`Your card has been blocked. Reason: ${data.reason}`)
      }
    })

    socketConnection.on('card_unblocked', (data: any) => {
      console.log('Card unblocked:', data)
      if (data.userId === user?.user_id) {
        loadCardStatus() // Refresh card status
        alert('Your card has been unblocked and is now active.')
      }
    })

    socketConnection.on('disconnect', () => {
      console.log('Disconnected from simulation WebSocket')
      setSocket(null)
    })

    return () => {
      socketConnection.disconnect()
    }
  }, [])

  // Fetch bus data from API
  const fetchBusData = async () => {
    try {
      setError(null)
      
      // Fetch current travel data (passenger count)
      const travelResponse = await fetch('/api/current-travel')
      const travelData = await travelResponse.json()

      // Fetch bus location data 
      const locationResponse = await fetch('/api/bus-location')
      const locationData = await locationResponse.json()

      // Check if simulation is running by checking smart-transit page status
      let journeyActive = false
      let journeyStatus = 'Bus is offline'
      
      if (simulationStatus?.isRunning) {
        journeyActive = true
        journeyStatus = simulationStatus.isWaitingAtStation 
          ? `Arrived at Station ${simulationStatus.currentDestinationIndex + 1}` 
          : `En route to Station ${simulationStatus.currentDestinationIndex + 1}`
      }

      setBusData({
        currentLocation: {
          latitude: journeyActive && simulationStatus ? simulationStatus.currentPosition.lat : (locationData.latitude || 23.8103),
          longitude: journeyActive && simulationStatus ? simulationStatus.currentPosition.lng : (locationData.longitude || 90.4125),
          locationName: journeyActive ? (simulationStatus?.destinations[simulationStatus.currentDestinationIndex]?.name || 'Moving') : 'Terminal (Offline)'
        },
        passengers: {
          current: travelData.count || 0,
          total: 40, // Bus capacity
          available: 40 - (travelData.count || 0)
        },
        lastUpdated: new Date().toLocaleTimeString(),
        isOnline: journeyActive,
        isJourneyActive: journeyActive,
        journeyStatus: journeyStatus
      })
    } catch (err) {
      console.error('Error fetching bus data:', err)
      setError('Failed to load bus information')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchBusData()
      loadCardStatus() // Load card status when authenticated
      
      // Set up polling for real-time updates every 5 seconds
      const interval = setInterval(() => {
        fetchBusData()
        loadCardStatus() // Also refresh card status
      }, 5000)
      
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, simulationStatus])

  // Trigger data refresh when simulation status changes
  useEffect(() => {
    if (simulationStatus) {
      fetchBusData()
    }
  }, [simulationStatus?.isRunning, simulationStatus?.currentPosition])

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center">Access Denied</CardTitle>
            <CardDescription className="text-center">
              Please log in to view your dashboard
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back, {user?.name || 'User'}!
          </h1>
          <p className="text-gray-600 mt-2">
            Real-time bus tracking and passenger information
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700">{error}</p>
            <button 
              onClick={fetchBusData}
              className="mt-2 text-red-600 underline hover:text-red-800"
            >
              Try again
            </button>
          </div>
        )}

        {/* Dashboard Content */}
        {busData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Passenger Information */}
            <div className="lg:col-span-1 space-y-6">
              {/* Current Passengers Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    Passenger Count
                  </CardTitle>
                  <CardDescription>
                    Real-time bus occupancy
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="text-4xl font-bold text-blue-600">
                        {busData.passengers.current}
                      </div>
                      <div className="text-sm text-gray-500">
                        of {busData.passengers.total} passengers
                      </div>
                    </div>
                    
                    {/* Occupancy Bar */}
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          busData.passengers.current > 35 ? 'bg-red-500' :
                          busData.passengers.current > 25 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{
                          width: `${(busData.passengers.current / busData.passengers.total) * 100}%`
                        }}
                      ></div>
                    </div>
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600">
                        {busData.passengers.available} seats available
                      </span>
                      <Badge variant={
                        busData.passengers.available === 0 ? 'destructive' :
                        busData.passengers.available <= 5 ? 'secondary' :
                        'default'
                      }>
                        {busData.passengers.available === 0 ? 'Full' :
                         busData.passengers.available <= 5 ? 'Almost Full' :
                         'Available'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Location Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {busData.isOnline ? (
                      <Wifi className="h-5 w-5 text-green-600" />
                    ) : (
                      <WifiOff className="h-5 w-5 text-gray-500" />
                    )}
                    Bus Status
                  </CardTitle>
                  <CardDescription>
                    {busData.isJourneyActive ? 'Journey in progress' : 'Bus is offline'}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={busData.isOnline ? "default" : "secondary"} 
                             className={busData.isOnline ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}>
                        {busData.isOnline ? "ONLINE" : "OFFLINE"}
                      </Badge>
                      {busData.isJourneyActive && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                          ACTIVE JOURNEY
                        </Badge>
                      )}
                    </div>
                    
                    <div className="text-lg font-semibold">
                      {busData.currentLocation.locationName}
                    </div>
                    
                    {busData.isOnline ? (
                      <div className="text-sm text-gray-600">
                        <div>Lat: {busData.currentLocation.latitude.toFixed(6)}</div>
                        <div>Lng: {busData.currentLocation.longitude.toFixed(6)}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        Bus is not currently running a journey
                      </div>
                    )}
                    
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-700">
                        {busData.journeyStatus}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      Last updated: {busData.lastUpdated}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* User Info Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Profile</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div><strong>Name:</strong> {user?.name}</div>
                    <div><strong>Email:</strong> {user?.email}</div>
                    <div><strong>Balance:</strong> ৳{user?.balance || '0.00'}</div>
                  </div>
                </CardContent>
              </Card>

              {/* Card Security Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-red-600" />
                    Card Security
                  </CardTitle>
                  <CardDescription>
                    Block your card if it's lost or stolen
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">Card Status</p>
                        <p className="text-sm text-muted-foreground">
                          {cardStatus?.is_blocked ? 'Your card is currently blocked' : 'Your card is active'}
                        </p>
                        {cardStatus?.blocked_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Blocked on: {new Date(cardStatus.blocked_at).toLocaleDateString()} at {new Date(cardStatus.blocked_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                      <Badge variant={cardStatus?.is_blocked ? 'destructive' : 'default'}>
                        {cardStatus?.is_blocked ? 'BLOCKED' : 'ACTIVE'}
                      </Badge>
                    </div>
                    
                    {cardStatus?.is_blocked ? (
                      <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Shield className="h-5 w-5 text-orange-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-orange-900">Card Blocked</h4>
                            <p className="text-sm text-orange-700 mb-2">
                              Your card has been blocked for security reasons.
                            </p>
                            {cardStatus.blocked_reason && (
                              <p className="text-sm text-orange-600 mb-2">
                                <strong>Reason:</strong> {cardStatus.blocked_reason}
                              </p>
                            )}
                            {cardStatus.blocked_by && (
                              <p className="text-sm text-orange-600 mb-3">
                                <strong>Blocked by:</strong> {cardStatus.blocked_by}
                              </p>
                            )}
                            <div className="bg-orange-100 p-2 rounded text-sm text-orange-800">
                              <strong>Note:</strong> Contact customer support to unblock your card. All transactions are currently disabled.
                            </div>
                            <div className="mt-3">
                              <Button variant="outline" size="sm">
                                Contact Support
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                          <div className="w-full">
                            <h4 className="font-medium text-red-900">Lost or Stolen Card?</h4>
                            <p className="text-sm text-red-700 mb-3">
                              Block your card immediately to prevent unauthorized use. You can contact support to unblock it later.
                            </p>
                            
                            <div className="mb-3">
                              <label htmlFor="blockReason" className="block text-sm font-medium text-red-900 mb-1">
                                Reason for blocking (required)
                              </label>
                              <select
                                id="blockReason"
                                value={blockReason}
                                onChange={(e) => setBlockReason(e.target.value)}
                                className="w-full p-2 border border-red-300 rounded-md text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                              >
                                <option value="">Select a reason...</option>
                                <option value="Card lost">Card lost</option>
                                <option value="Card stolen">Card stolen</option>
                                <option value="Suspicious activity">Suspicious activity</option>
                                <option value="Unauthorized transactions">Unauthorized transactions</option>
                                <option value="Other security concern">Other security concern</option>
                              </select>
                            </div>
                            
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={handleBlockCard}
                              disabled={blockLoading || !blockReason.trim()}
                            >
                              {blockLoading ? 'Blocking...' : 'Block My Card'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Security Tips */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <h5 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                        <Shield className="h-4 w-4" />
                        Security Tips
                      </h5>
                      <ul className="text-sm text-blue-700 space-y-1">
                        <li>• Keep your card in a secure wallet or card holder</li>
                        <li>• Never share your card with others</li>
                        <li>• Report lost or stolen cards immediately</li>
                        <li>• Monitor your transaction history regularly</li>
                        <li>• Contact support if you notice any suspicious activity</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Map Section */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Navigation className="h-5 w-5 text-purple-600" />
                    {busData.isOnline ? 'Live Bus Location' : 'Bus Location (Offline)'}
                  </CardTitle>
                  <CardDescription>
                    {busData.isOnline 
                      ? 'Real-time tracking on the map' 
                      : 'Bus is not currently running. Start a journey from Smart Transit page to see live tracking.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-96 lg:h-[500px] relative">
                    {busData.isOnline ? (
                      <MapComponent 
                        latitude={busData.currentLocation.latitude}
                        longitude={busData.currentLocation.longitude}
                        locationName={busData.currentLocation.locationName}
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <WifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-xl font-semibold text-gray-600 mb-2">Bus is Offline</h3>
                          <p className="text-gray-500 mb-4 max-w-md">
                            The bus is not currently running a journey. To see live tracking:
                          </p>
                          <div className="space-y-2 text-sm text-gray-600">
                            <p>1. Go to Smart Transit page</p>
                            <p>2. Select multiple destinations</p>
                            <p>3. Click "Start Journey"</p>
                          </div>
                          <div className="mt-4 p-3 bg-gray-100 rounded-lg">
                            <p className="text-xs text-gray-500">
                              Last known location: {busData.currentLocation.locationName}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Refresh Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          Dashboard updates automatically every 5 seconds
        </div>
      </div>
    </div>
  )
}