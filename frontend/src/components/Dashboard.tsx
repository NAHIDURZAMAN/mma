'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Wifi, 
  WifiOff, 
  CreditCard, 
  Bus, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  Activity,
  MapPin,
  UserPlus,
  UserMinus
} from 'lucide-react';
import { wsService } from '@/lib/websocket';
import { apiService } from '@/lib/api';
import { RFIDScanData, User, WebSocketMessage } from '@/types';

interface DashboardProps {
  className?: string;
}

interface BusInfo {
  bus_id: string;
  total_seats: number;
  current_passengers: number;
  location: string;
  passenger_cards: Set<string>;
}

export function Dashboard({ className }: DashboardProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [simulateCardId, setSimulateCardId] = useState('');
  const [busInfo, setBusInfo] = useState<BusInfo>({
    bus_id: 'BUS-001',
    total_seats: 40,
    current_passengers: 0,
    location: 'Starting Point',
    passenger_cards: new Set()
  });

  useEffect(() => {
    // Initialize WebSocket connection
    wsService.connect();

    // Set up event listeners
    wsService.on('connection', (data: any) => {
      setIsConnected(data.status === 'connected');
    });

    wsService.on('rfid_scan', (data: any) => {
      setRecentScans(prev => [data, ...prev.slice(0, 9)]); // Keep last 10 scans
      handlePassengerUpdate(data);
    });

    wsService.on('user_update', (data: any) => {
      setUsers(prev => prev.map(user => 
        user.user_id === data.user_id ? { ...user, ...data } : user
      ));
    });

    // Load initial data
    loadUsers();
    loadSystemStatus();

    return () => {
      wsService.disconnect();
    };
  }, []);

  const handlePassengerUpdate = (scanData: any) => {
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

  const loadUsers = async () => {
    try {
      const response = await apiService.getUsers();
      if (response.success) {
        setUsers(response.data);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  };

  const loadSystemStatus = async () => {
    try {
      const [healthData, configData] = await Promise.all([
        apiService.healthCheck(),
        apiService.getArduinoConfig()
      ]);
      setSystemStatus({ health: healthData, config: configData });
    } catch (error) {
      console.error('Failed to load system status:', error);
    }
  };

  const handleSimulateRFID = async () => {
    if (!simulateCardId.trim()) return;
    
    try {
      const scanData: RFIDScanData = {
        card_id: simulateCardId.trim(),
        device_id: 'WEB_SIMULATOR',
        location: 'Web Dashboard'
      };
      
      const response = await apiService.simulateRFIDScan(scanData);
      
      // Add to recent scans
      setRecentScans(prev => [{
        ...scanData,
        timestamp: new Date().toISOString(),
        response
      }, ...prev.slice(0, 9)]);
      
      setSimulateCardId('');
    } catch (error) {
      console.error('Failed to simulate RFID scan:', error);
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Bus Status Header */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Bus className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">
                {busInfo.bus_id}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">
                {busInfo.current_passengers}/{busInfo.total_seats} Passengers
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">
                {busInfo.location}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              {isConnected ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm font-medium">
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bus Occupancy Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Bus className="h-5 w-5" />
            <span>Bus {busInfo.bus_id} - Seat Occupancy</span>
          </CardTitle>
          <CardDescription>
            Real-time passenger count and seat availability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Occupancy Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Occupancy</span>
                <span>{busInfo.current_passengers} / {busInfo.total_seats} seats</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div 
                  className={`h-4 rounded-full transition-all duration-300 ${
                    busInfo.current_passengers / busInfo.total_seats >= 0.8 
                      ? 'bg-red-500' 
                      : busInfo.current_passengers / busInfo.total_seats >= 0.6 
                      ? 'bg-yellow-500' 
                      : 'bg-green-500'
                  }`}
                  style={{ 
                    width: `${(busInfo.current_passengers / busInfo.total_seats) * 100}%` 
                  }}
                />
              </div>
            </div>

            {/* Seat Statistics */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {busInfo.total_seats - busInfo.current_passengers}
                </div>
                <div className="text-sm text-green-600">Available Seats</div>
              </div>
              
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">
                  {busInfo.current_passengers}
                </div>
                <div className="text-sm text-blue-600">Occupied Seats</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-600">
                  {busInfo.total_seats}
                </div>
                <div className="text-sm text-gray-600">Total Seats</div>
              </div>
            </div>

            {/* Current Location */}
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center space-x-2">
                <MapPin className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-medium text-purple-900">Current Location</div>
                  <div className="text-purple-700">{busInfo.location}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RFID Scanner Simulator */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5" />
              <span>RFID Scanner Simulator</span>
            </CardTitle>
            <CardDescription>
              Simulate card scans for testing passenger boarding/alighting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex space-x-2">
                <Input
                  placeholder="Enter card ID (e.g., 1234567890)"
                  value={simulateCardId}
                  onChange={(e) => setSimulateCardId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSimulateRFID()}
                />
                <Button onClick={handleSimulateRFID} disabled={!simulateCardId.trim()}>
                  Scan
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Simulates the Arduino ESP8266 RFID scanner. First scan = boarding, second scan = alighting.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Recent RFID Scans */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Passenger Activity</CardTitle>
            <CardDescription>Live feed of boarding and alighting</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {recentScans.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent activity</p>
              ) : (
                recentScans.map((scan, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded">
                    <div className="flex items-center space-x-3">
                      {scan.response?.success ? (
                        scan.response.message.includes('started') ? (
                          <UserPlus className="h-4 w-4 text-green-500" />
                        ) : scan.response.message.includes('ended') ? (
                          <UserMinus className="h-4 w-4 text-red-500" />
                        ) : (
                          <CreditCard className="h-4 w-4 text-blue-500" />
                        )
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium">{scan.card_id}</div>
                        <div className="text-xs text-muted-foreground">
                          {scan.response?.success ? (
                            scan.response.message.includes('started') ? (
                              <Badge variant="outline" className="text-green-600">
                                Journey Started
                              </Badge>
                            ) : scan.response.message.includes('ended') ? (
                              <div className="flex items-center space-x-2">
                                <Badge variant="outline" className="text-red-600">
                                  Journey Ended
                                </Badge>
                                {scan.response?.user?.distance && (
                                  <span className="text-blue-600 text-xs">
                                    {scan.response.user.distance.distanceKm}km • ৳{scan.response.user.fare_deducted}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <Badge variant="outline">
                                {scan.response.message}
                              </Badge>
                            )
                          ) : (
                            <Badge variant="destructive">
                              {scan.response?.message || 'Failed'}
                            </Badge>
                          )}
                        </div>
                        {scan.response?.user && (
                          <div className="text-xs text-muted-foreground">
                            {scan.response.user.name}
                            {scan.response.user.balance !== undefined && (
                              <span className="ml-2">• Balance: ৳{scan.response.user.balance}</span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{new Date(scan.timestamp).toLocaleTimeString()}</div>
                      {scan.location && (
                        <div className="text-purple-600">📍 {scan.location}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Registered Users */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Registered Passengers</CardTitle>
            <CardDescription>Users with RFID cards</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Name</th>
                    <th className="text-left p-2">Card ID</th>
                    <th className="text-left p-2">Balance</th>
                    <th className="text-left p-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.user_id} className="border-b">
                      <td className="p-2 font-medium">{user.name}</td>
                      <td className="p-2 font-mono">{user.card_id}</td>
                      <td className="p-2">
                        <Badge variant={user.balance < 10 ? 'destructive' : 'default'}>
                          ৳{user.balance}
                        </Badge>
                      </td>
                      <td className="p-2">
                        <Badge 
                          variant={busInfo.passenger_cards.has(user.card_id) ? 'default' : 'secondary'}
                        >
                          {busInfo.passenger_cards.has(user.card_id) ? 'On Bus' : 'Not On Bus'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
