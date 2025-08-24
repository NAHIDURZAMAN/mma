'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Activity, 
  Wifi, 
  WifiOff, 
  CreditCard, 
  CheckCircle, 
  AlertCircle, 
  Clock,
  MapPin,
  User,
  RefreshCw,
  Zap,
  Bus as BusIcon,
  Users,
  UserMinus,
  UserPlus,
  Thermometer
} from 'lucide-react';
import { wsService } from '@/lib/websocket';
import { apiService } from '@/lib/api';

interface ScanEvent {
  card_id: string;
  device_id?: string;
  location?: string;
  timestamp: string;
  response: any;
  source: string;
}

interface BusInfo {
  bus_id: string;
  route: string;
  total_seats: number;
  current_passengers: number;
  location: string;
  passenger_cards: Set<string>;
  next_stop: string;
}

export default function MonitorPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [busInfo, setBusInfo] = useState<BusInfo>({
    bus_id: 'BUS-001',
    route: 'City Terminal → University → Shopping Mall',
    total_seats: 40,
    current_passengers: 0,
    location: 'City Terminal',
    next_stop: 'University Gate',
    passenger_cards: new Set()
  });

  useEffect(() => {
    initializeMonitoring();
    
    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => {
      clearInterval(clockInterval);
      wsService.disconnect();
    };
  }, []);

  const initializeMonitoring = async () => {
    try {
      // Connect to WebSocket
      wsService.connect();
      
      // Set up event listeners
      wsService.on('connection', (data: any) => {
        setIsConnected(data.status === 'connected');
      });

      wsService.on('rfid_scan', (data: any) => {
        setScanEvents(prev => [data, ...prev.slice(0, 4)]); // Keep last 5 events
        setLastUpdate(new Date());
        
        // Update bus passenger count based on RFID scan
        handlePassengerCountUpdate(data);
      });

    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePassengerCountUpdate = (scanData: any) => {
    if (scanData.response?.success) {
      const cardId = scanData.card_id;
      const isBoarding = scanData.response.message.includes('started');
      const isAlighting = scanData.response.message.includes('ended');

      setBusInfo(prev => {
        const newPassengerCards = new Set(prev.passenger_cards);
        let newPassengerCount = prev.current_passengers;

        if (isBoarding && !newPassengerCards.has(cardId)) {
          newPassengerCards.add(cardId);
          newPassengerCount += 1;
        } else if (isAlighting && newPassengerCards.has(cardId)) {
          newPassengerCards.delete(cardId);
          newPassengerCount -= 1;
        }

        return {
          ...prev,
          current_passengers: Math.max(0, newPassengerCount),
          passenger_cards: newPassengerCards,
          location: scanData.location || prev.location
        };
      });
    }
  };

  const getOccupancyColor = () => {
    const occupancyRate = busInfo.current_passengers / busInfo.total_seats;
    if (occupancyRate >= 0.9) return 'bg-red-500';
    if (occupancyRate >= 0.7) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getOccupancyStatus = () => {
    const occupancyRate = busInfo.current_passengers / busInfo.total_seats;
    if (occupancyRate >= 0.9) return 'FULL';
    if (occupancyRate >= 0.7) return 'BUSY';
    return 'AVAILABLE';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-2 text-lg text-gray-600">Loading Bus Information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      {/* Header with Bus Info and Time */}
      <div className="mb-6">
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <BusIcon className="h-8 w-8 text-blue-600" />
                <div>
                  <h1 className="text-2xl font-bold text-gray-800">{busInfo.bus_id}</h1>
                  <p className="text-gray-600">{busInfo.route}</p>
                </div>
              </div>
              <div className="flex items-center space-x-6">
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-800">
                    {currentTime.toLocaleTimeString('en-US', { 
                      hour: '2-digit', 
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                  <div className="text-sm text-gray-600">
                    {currentTime.toLocaleDateString('en-US', { 
                      weekday: 'long',
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {isConnected ? (
                    <Wifi className="h-5 w-5 text-green-500" />
                  ) : (
                    <WifiOff className="h-5 w-5 text-red-500" />
                  )}
                  <Badge variant={isConnected ? "default" : "destructive"}>
                    {isConnected ? 'ONLINE' : 'OFFLINE'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Bus Occupancy - Large Display */}
        <Card className="lg:col-span-2 bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-xl">
              <Users className="h-6 w-6" />
              <span>Bus Occupancy</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Large Occupancy Display */}
              <div className="text-center p-8 bg-gray-50 rounded-lg">
                <div className="text-6xl font-bold text-gray-800 mb-2">
                  {busInfo.current_passengers}
                </div>
                <div className="text-xl text-gray-600 mb-4">
                  of {busInfo.total_seats} passengers
                </div>
                <Badge 
                  variant="outline" 
                  className={`text-lg px-4 py-2 ${getOccupancyColor()} text-white border-0`}
                >
                  {getOccupancyStatus()}
                </Badge>
              </div>

              {/* Occupancy Bar */}
              <div className="space-y-2">
                <div className="w-full bg-gray-200 rounded-full h-6">
                  <div 
                    className={`h-6 rounded-full transition-all duration-500 ${getOccupancyColor()}`}
                    style={{ 
                      width: `${Math.min((busInfo.current_passengers / busInfo.total_seats) * 100, 100)}%` 
                    }}
                  />
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>0</span>
                  <span className="font-medium">
                    Available Seats: {busInfo.total_seats - busInfo.current_passengers}
                  </span>
                  <span>{busInfo.total_seats}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Next Stop */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <MapPin className="h-5 w-5" />
              <span>Location</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Current Location</div>
                <div className="text-lg font-bold text-blue-800">
                  {busInfo.location}
                </div>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Next Stop</div>
                <div className="text-lg font-bold text-green-800">
                  {busInfo.next_stop}
                </div>
              </div>

              <div className="text-center">
                <div className="text-xs text-gray-500">Last Updated</div>
                <div className="text-sm font-medium">
                  {lastUpdate.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Activity className="h-5 w-5" />
            <span>Recent Passenger Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-48 overflow-y-auto">
            {scanEvents.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-gray-500">No recent activity</p>
              </div>
            ) : (
              scanEvents.map((event, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    {event.response?.success ? (
                      event.response.message.includes('started') ? (
                        <div className="flex items-center space-x-2">
                          <UserPlus className="h-5 w-5 text-green-500" />
                          <Badge variant="outline" className="text-green-600">
                            BOARDED
                          </Badge>
                        </div>
                      ) : event.response.message.includes('ended') ? (
                        <div className="flex items-center space-x-2">
                          <UserMinus className="h-5 w-5 text-red-500" />
                          <Badge variant="outline" className="text-red-600">
                            ALIGHTED
                          </Badge>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <CreditCard className="h-5 w-5 text-blue-500" />
                          <Badge variant="outline">
                            PROCESSED
                          </Badge>
                        </div>
                      )
                    ) : (
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-5 w-5 text-red-500" />
                        <Badge variant="destructive">
                          FAILED
                        </Badge>
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-lg">Card: {event.card_id}</div>
                      {event.response?.user && (
                        <div className="text-sm text-gray-600">
                          Passenger: {event.response.user.name}
                          {event.response.user.distance && (
                            <span className="ml-2 text-blue-600">
                              • {event.response.user.distance.distanceKm}km 
                              • ৳{event.response.user.fare_deducted}
                            </span>
                          )}
                        </div>
                      )}
                      {event.response?.message && (
                        <div className="text-xs text-gray-500">
                          {event.response.message}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                    {event.location && (
                      <div className="text-xs text-gray-400">
                        📍 {event.location}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
