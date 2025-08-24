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
  UserPlus
} from 'lucide-react';
import { wsService } from '@/lib/websocket';
import { apiService } from '@/lib/api';
import { Bus } from '@/types';

interface ScanEvent {
  card_id: string;
  device_id?: string;
  location?: string;
  timestamp: string;
  response: any;
  source: string;
}

export default function MonitorPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [systemHealth, setSystemHealth] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [buses, setBuses] = useState<Bus[]>([]);

  // Initialize mock buses - in a real application, this would come from your backend
  const initializeBuses = () => {
    const initialBuses: Bus[] = [
      {
        bus_id: '1',
        bus_number: 'BUS-001',
        route: 'Dhanmondi - Motijheel',
        total_seats: 40,
        current_passengers: 0,
        available_seats: 40,
        location: 'Dhanmondi',
        last_updated: new Date().toISOString(),
        passenger_cards: new Set()
      },
      {
        bus_id: '2', 
        bus_number: 'BUS-002',
        route: 'Gulshan - Uttara',
        total_seats: 35,
        current_passengers: 0,
        available_seats: 35,
        location: 'Gulshan',
        last_updated: new Date().toISOString(),
        passenger_cards: new Set()
      },
      {
        bus_id: '3',
        bus_number: 'BUS-003',
        route: 'Mirpur - Farmgate',
        total_seats: 45,
        current_passengers: 0,
        available_seats: 45,
        location: 'Mirpur',
        last_updated: new Date().toISOString(),
        passenger_cards: new Set()
      }
    ];
    setBuses(initialBuses);
  };

  useEffect(() => {
    initializeMonitoring();
    initializeBuses();
    return () => {
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
        setScanEvents(prev => [data, ...prev.slice(0, 99)]); // Keep last 100 events
        
        // Update bus passenger count based on RFID scan
        handlePassengerCountUpdate(data);
      });

      // Load system health
      await loadSystemHealth();
    } catch (error) {
      console.error('Failed to initialize monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePassengerCountUpdate = (scanData: any) => {
    if (scanData.response?.success) {
      const cardId = scanData.card_id;
      const busLocation = scanData.location || 'Unknown';
      
      setBuses(prevBuses => {
        return prevBuses.map(bus => {
          // Find the bus based on location or assign to first available bus for demo
          if (bus.location === busLocation || prevBuses.indexOf(bus) === 0) {
            const newPassengerCards = new Set(bus.passenger_cards);
            let passengerChange = 0;
            
            if (newPassengerCards.has(cardId)) {
              // Card already in bus - passenger is getting off
              newPassengerCards.delete(cardId);
              passengerChange = -1;
            } else {
              // New card - passenger is getting on
              if (bus.available_seats > 0) {
                newPassengerCards.add(cardId);
                passengerChange = 1;
              }
            }
            
            const newCurrentPassengers = Math.max(0, Math.min(bus.total_seats, bus.current_passengers + passengerChange));
            const newAvailableSeats = bus.total_seats - newCurrentPassengers;
            
            return {
              ...bus,
              current_passengers: newCurrentPassengers,
              available_seats: newAvailableSeats,
              passenger_cards: newPassengerCards,
              last_updated: new Date().toISOString()
            };
          }
          return bus;
        });
      });
    }
  };

  const loadSystemHealth = async () => {
    try {
      const health = await apiService.healthCheck();
      setSystemHealth(health);
    } catch (error) {
      console.error('Failed to load system health:', error);
    }
  };

  const clearEvents = () => {
    setScanEvents([]);
  };

  const getEventStatusIcon = (event: ScanEvent) => {
    if (event.response?.success) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  const getEventStatusColor = (event: ScanEvent) => {
    if (event.response?.success) {
      return event.response.action === 'success_beep' ? 'default' : 'secondary';
    }
    return 'destructive';
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading monitoring dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Real-time Monitoring</h1>
        <p className="text-muted-foreground">
          Monitor RFID scanner activity and system status in real-time.
        </p>
      </div>

      {/* System Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card variant={isConnected ? 'success' : 'destructive'}>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <div>
                <p className="text-sm font-medium">WebSocket</p>
                <p className="text-lg font-semibold">
                  {isConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Events</p>
                <p className="text-2xl font-bold">{scanEvents.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <div>
                <p className="text-sm font-medium">Successful</p>
                <p className="text-2xl font-bold">
                  {scanEvents.filter(e => e.response?.success).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-medium">Failed</p>
                <p className="text-2xl font-bold">
                  {scanEvents.filter(e => !e.response?.success).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Current system status and configuration</CardDescription>
            </div>
            <Button onClick={loadSystemHealth} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">API Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Status:</span>
                  <Badge variant="default">{systemHealth.status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Database:</span>
                  <Badge variant={systemHealth.database === 'Configured' ? 'default' : 'destructive'}>
                    {systemHealth.database}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span>WebSocket:</span>
                  <Badge variant="default">{systemHealth.websocket || 'Enabled'}</Badge>
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">Arduino Status</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>WiFi SSID:</span>
                  <span className="font-mono">{systemHealth.arduino?.wifi_ssid}</span>
                </div>
                <div className="flex justify-between">
                  <span>RFID Status:</span>
                  <Badge variant="default">{systemHealth.arduino?.rfid_status}</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Last Updated:</span>
                  <span>{new Date(systemHealth.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bus Fleet Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BusIcon className="h-5 w-5" />
            <span>Bus Fleet Status</span>
          </CardTitle>
          <CardDescription>
            Real-time bus occupancy and seat availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {buses.map((bus) => {
              const occupancyPercentage = (bus.current_passengers / bus.total_seats) * 100;
              const getOccupancyColor = () => {
                if (occupancyPercentage <= 60) return 'text-green-600';
                if (occupancyPercentage <= 80) return 'text-yellow-600';
                return 'text-red-600';
              };
              
              const getOccupancyBadgeVariant = () => {
                if (occupancyPercentage <= 60) return 'default';
                if (occupancyPercentage <= 80) return 'secondary';
                return 'destructive';
              };

              return (
                <Card key={bus.bus_id} className="border">
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      {/* Bus Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <BusIcon className="h-4 w-4 text-blue-500" />
                          <span className="font-semibold">{bus.bus_number}</span>
                        </div>
                        <Badge variant={getOccupancyBadgeVariant()}>
                          {occupancyPercentage.toFixed(0)}% Full
                        </Badge>
                      </div>
                      
                      {/* Route Info */}
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        <span>{bus.route}</span>
                      </div>
                      
                      {/* Passenger Count */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Passengers</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`font-bold ${getOccupancyColor()}`}>
                            {bus.current_passengers}
                          </span>
                          <span className="text-muted-foreground">/ {bus.total_seats}</span>
                        </div>
                      </div>
                      
                      {/* Available Seats */}
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Available Seats</span>
                        <span className={`font-semibold ${bus.available_seats === 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {bus.available_seats}
                        </span>
                      </div>
                      
                      {/* Occupancy Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Occupancy</span>
                          <span>{occupancyPercentage.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-300 ${
                              occupancyPercentage <= 60 
                                ? 'bg-green-500' 
                                : occupancyPercentage <= 80 
                                ? 'bg-yellow-500' 
                                : 'bg-red-500'
                            }`}
                            style={{ width: `${occupancyPercentage}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      {/* Last Updated */}
                      <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Updated: {formatTime(bus.last_updated)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Fleet Summary */}
          <div className="mt-6 pt-4 border-t">
            <h4 className="font-medium mb-3">Fleet Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
              <div className="space-y-1">
                <div className="text-2xl font-bold text-blue-600">
                  {buses.length}
                </div>
                <div className="text-sm text-muted-foreground">Total Buses</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-green-600">
                  {buses.reduce((sum, bus) => sum + bus.current_passengers, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Passengers</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-purple-600">
                  {buses.reduce((sum, bus) => sum + bus.total_seats, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Total Capacity</div>
              </div>
              <div className="space-y-1">
                <div className="text-2xl font-bold text-orange-600">
                  {buses.reduce((sum, bus) => sum + bus.available_seats, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Available Seats</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Live Events Feed */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Live RFID Events</CardTitle>
              <CardDescription>Real-time feed of RFID card scans</CardDescription>
            </div>
            <div className="flex space-x-2">
              <Button onClick={clearEvents} variant="outline" size="sm">
                Clear Events
              </Button>
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                <span>{isConnected ? 'Live' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {scanEvents.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No events yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  RFID scan events will appear here in real-time
                </p>
              </div>
            ) : (
              scanEvents.map((event, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    {getEventStatusIcon(event)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <CreditCard className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono font-medium">{event.card_id}</span>
                        <Badge variant={getEventStatusColor(event)}>
                          {event.response?.success ? 'Success' : 'Failed'}
                        </Badge>
                        {/* Show boarding/alighting status */}
                        {event.response?.success && (
                          <Badge variant="outline">
                            {event.response.message.includes('started') ? (
                              <div className="flex items-center space-x-1">
                                <UserPlus className="h-3 w-3 text-green-500" />
                                <span>Boarding</span>
                              </div>
                            ) : event.response.message.includes('ended') ? (
                              <div className="flex items-center space-x-1">
                                <UserMinus className="h-3 w-3 text-red-500" />
                                <span>Alighting</span>
                              </div>
                            ) : null}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-1">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{event.location || 'Unknown'}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Zap className="h-3 w-3" />
                          <span>{event.source}</span>
                        </div>
                        {event.response?.user && (
                          <div className="flex items-center space-x-1">
                            <User className="h-3 w-3" />
                            <span>{event.response.user.name}</span>
                          </div>
                        )}
                        {/* Show bus occupancy change */}
                        {event.response?.success && (
                          <div className="flex items-center space-x-1">
                            <BusIcon className="h-3 w-3" />
                            <span>
                              {event.response.message.includes('started') 
                                ? 'Passenger +1' 
                                : event.response.message.includes('ended') 
                                ? 'Passenger -1' 
                                : 'Status Update'}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center space-x-1 text-sm">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>{formatTime(event.timestamp)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {formatDate(event.timestamp)}
                    </div>
                    {event.response?.message && (
                      <div className="text-xs text-muted-foreground mt-1 max-w-48 truncate">
                        {event.response.message}
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
