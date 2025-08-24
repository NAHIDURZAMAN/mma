'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  MapPin,
  Clock,
  User,
  Settings
} from 'lucide-react';
import { apiService } from '@/lib/api';
import { wsService } from '@/lib/websocket';
import { RFIDScanData, User as UserType } from '@/types';

interface SimulationResult {
  request: RFIDScanData;
  response: any;
  timestamp: string;
}

export default function SimulatorPage() {
  const [cardId, setCardId] = useState('');
  const [location, setLocation] = useState('Bus Stop A');
  const [deviceId, setDeviceId] = useState('WEB_SIMULATOR');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');

  useEffect(() => {
    loadUsers();
    
    // Connect WebSocket for real-time updates
    wsService.connect();
    wsService.on('rfid_scan', (data: any) => {
      if (data.source === 'WEB_SIMULATOR' || data.device_id === 'WEB_SIMULATOR') {
        // This scan came from our simulator, no need to add to results
        // as it's already added when we make the request
      }
    });

    return () => {
      wsService.off('rfid_scan');
    };
  }, []);

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

  const handleSimulate = async () => {
    if (!cardId.trim()) return;

    setLoading(true);
    try {
      const scanData: RFIDScanData = {
        card_id: cardId.trim(),
        device_id: deviceId,
        location: location,
        timestamp: new Date().toISOString()
      };

      const response = await apiService.simulateRFIDScan(scanData);
      
      const result: SimulationResult = {
        request: scanData,
        response,
        timestamp: new Date().toISOString()
      };

      setResults(prev => [result, ...prev.slice(0, 19)]); // Keep last 20 results
      
    } catch (error) {
      console.error('Simulation failed:', error);
      const result: SimulationResult = {
        request: { card_id: cardId.trim(), device_id: deviceId, location },
        response: { success: false, message: 'Simulation failed', action: 'error_beep' },
        timestamp: new Date().toISOString()
      };
      setResults(prev => [result, ...prev.slice(0, 19)]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (userId: string) => {
    const user = users.find(u => u.user_id === userId);
    if (user) {
      setCardId(user.card_id);
      setSelectedUser(userId);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  const quickLocations = [
    'Bus Stop A',
    'Bus Stop B', 
    'Metro Station',
    'Main Terminal',
    'Junction Plaza'
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">RFID Simulator</h1>
        <p className="text-muted-foreground">
          Test RFID card scans without physical hardware. Perfect for development and testing.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Simulator Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CreditCard className="h-5 w-5" />
                <span>Scan Simulation</span>
              </CardTitle>
              <CardDescription>
                Simulate RFID card scans for testing the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Card ID</label>
                <Input
                  placeholder="Enter card ID (e.g., 1234567890)"
                  value={cardId}
                  onChange={(e) => setCardId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !loading && handleSimulate()}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Location</label>
                <div className="flex space-x-2">
                  <Input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                  <div className="flex flex-col">
                    <select 
                      className="px-3 py-2 border rounded-md text-sm"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                    >
                      {quickLocations.map(loc => (
                        <option key={loc} value={loc}>{loc}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Device ID</label>
                <Input
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="Device identifier"
                />
              </div>

              <Button 
                onClick={handleSimulate} 
                disabled={!cardId.trim() || loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Simulating...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Simulate Scan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Quick User Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Quick User Selection</span>
              </CardTitle>
              <CardDescription>
                Select a registered user to simulate their card
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                {users.map(user => (
                  <div
                    key={user.user_id}
                    className={`p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                      selectedUser === user.user_id ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleUserSelect(user.user_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{user.name}</span>
                        <div className="text-xs text-muted-foreground">
                          {user.card_id}
                        </div>
                      </div>
                      <Badge variant={user.balance < 10 ? 'destructive' : 'default'}>
                        ৳{user.balance}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Simulation Results */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Simulation Results</CardTitle>
                <CardDescription>Recent scan simulation results</CardDescription>
              </div>
              <Button onClick={clearResults} variant="outline" size="sm">
                Clear Results
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {results.length === 0 ? (
                <div className="text-center py-8">
                  <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No simulations yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Run a simulation to see results here
                  </p>
                </div>
              ) : (
                results.map((result, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {result.response.success ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className="font-mono font-medium">
                          {result.request.card_id}
                        </span>
                        <Badge variant={result.response.success ? 'default' : 'destructive'}>
                          {result.response.success ? 'Success' : 'Failed'}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(result.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    
                    <div className="text-sm space-y-1">
                      <div className="flex items-center space-x-4 text-muted-foreground">
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-3 w-3" />
                          <span>{result.request.location}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Settings className="h-3 w-3" />
                          <span>{result.request.device_id}</span>
                        </div>
                      </div>
                      
                      <div className="bg-muted p-2 rounded text-xs">
                        <strong>Response:</strong> {result.response.message}
                      </div>
                      
                      {result.response.user && (
                        <div className="bg-blue-50 p-2 rounded text-xs">
                          <strong>User:</strong> {result.response.user.name} 
                          {result.response.user.balance !== undefined && 
                            ` | Balance: ৳${result.response.user.balance}`
                          }
                          {result.response.user.fare_deducted && 
                            ` | Fare: ৳${result.response.user.fare_deducted}`
                          }
                        </div>
                      )}
                      
                      {result.response.display && (
                        <div className="bg-green-50 p-2 rounded text-xs">
                          <strong>LCD Display:</strong><br />
                          Line 1: {result.response.display[0]}<br />
                          Line 2: {result.response.display[1]}
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
    </div>
  );
}
