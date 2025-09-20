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
  UserMinus,
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Database,
  BarChart3,
  Navigation,
  Clock,
  Target,
  PieChart
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

interface AnalyticsData {
  totalUsers: number;
  totalRevenue: number;
  totalTrips: number;
  activeUsers: number;
  todayTrips: number;
  monthlyGrowth: {
    revenue: number;
    trips: number;
    users: number;
  };
  recentActivity: any[];
  lastUpdated: string;
}

interface DatabaseMetrics {
  status: string;
  totalRecords: number;
  dbSize: string;
  connections: number;
  uptime: string;
}

export function Dashboard({ className }: DashboardProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [recentScans, setRecentScans] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [systemStatus, setSystemStatus] = useState<any>({});
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [databaseMetrics, setDatabaseMetrics] = useState<DatabaseMetrics | null>(null);
  const [simulateCardId, setSimulateCardId] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
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
    loadAllData();

    return () => {
      wsService.disconnect();
    };
  }, []);

  // Auto-refresh functionality
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (autoRefresh) {
      interval = setInterval(() => {
        console.log('Auto-refreshing dashboard data...');
        loadAllData();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [autoRefresh]);

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

  const loadAllData = async () => {
    try {
      setLastRefresh(new Date());
      
      // Load data in parallel for better performance
      const [usersData, analyticsData, dbStats] = await Promise.allSettled([
        loadUsers(),
        loadAnalytics(),
        loadDatabaseMetrics(),
        loadSystemStatus()
      ]);
      
      console.log('Dashboard data refreshed');
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
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

  const loadAnalytics = async () => {
    try {
      const response = await apiService.getAnalyticsOverview();
      if (response.success) {
        setAnalyticsData(response.data);
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const loadDatabaseMetrics = async () => {
    try {
      const response = await apiService.getDatabaseStats();
      if (response.success) {
        setDatabaseMetrics(response.data);
      }
    } catch (error) {
      console.error('Failed to load database metrics:', error);
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
      {/* Dashboard Header with Refresh Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">System Overview</h2>
          <p className="text-muted-foreground">Real-time monitoring and analytics</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
            >
              <Activity className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-pulse' : ''}`} />
              {autoRefresh ? 'Auto-Refresh On' : 'Auto-Refresh Off'}
            </Button>
            <span className="text-sm text-muted-foreground">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          </div>
          <Button 
            onClick={loadAllData} 
            variant="outline" 
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">System Status</p>
                <div className="flex items-center space-x-2 mt-1">
                  {isConnected ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span className="font-medium">
                    {isConnected ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className={`p-2 rounded-full ${isConnected ? 'bg-green-100' : 'bg-red-100'}`}>
                {isConnected ? (
                  <Wifi className="h-6 w-6 text-green-600" />
                ) : (
                  <WifiOff className="h-6 w-6 text-red-600" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-2xl font-bold">{analyticsData?.totalUsers?.toLocaleString() || users.length}</p>
                <div className="flex items-center mt-1">
                  <Users className="h-3 w-3 text-blue-600 mr-1" />
                  <span className="text-xs text-blue-600">
                    {analyticsData?.activeUsers || 0} active
                  </span>
                </div>
              </div>
              <div className="bg-blue-100 p-2 rounded-full">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Today's Revenue</p>
                <p className="text-2xl font-bold text-green-600">৳{analyticsData?.totalRevenue?.toLocaleString() || '0'}</p>
                <div className="flex items-center mt-1">
                  {(analyticsData?.monthlyGrowth.revenue || 0) >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                  )}
                  <span className="text-xs text-green-600">
                    {analyticsData?.todayTrips || 0} trips
                  </span>
                </div>
              </div>
              <div className="bg-green-100 p-2 rounded-full">
                <DollarSign className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Database</p>
                <p className="text-lg font-bold">{databaseMetrics?.totalRecords?.toLocaleString() || 'N/A'}</p>
                <div className="flex items-center mt-1">
                  <Database className="h-3 w-3 text-purple-600 mr-1" />
                  <span className="text-xs text-purple-600">
                    {databaseMetrics?.status || 'Unknown'} • {databaseMetrics?.dbSize || 'N/A'}
                  </span>
                </div>
              </div>
              <div className="bg-purple-100 p-2 rounded-full">
                <Database className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Real-time Analytics Cards */}
      {analyticsData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                <span>Trip Analytics</span>
              </CardTitle>
              <CardDescription>Travel statistics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Trips</span>
                  <span className="font-bold">{analyticsData.totalTrips.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Today's Trips</span>
                  <span className="font-bold">{analyticsData.todayTrips}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Growth Rate</span>
                  <div className="flex items-center space-x-1">
                    {analyticsData.monthlyGrowth.trips >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${analyticsData.monthlyGrowth.trips >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analyticsData.monthlyGrowth.trips >= 0 ? '+' : ''}{analyticsData.monthlyGrowth.trips.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Target className="h-5 w-5 text-green-600" />
                <span>Revenue Analytics</span>
              </CardTitle>
              <CardDescription>Financial performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Revenue</span>
                  <span className="font-bold text-green-600">৳{analyticsData.totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Avg. Fare</span>
                  <span className="font-bold">৳{(analyticsData.totalRevenue / analyticsData.totalTrips).toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Growth Rate</span>
                  <div className="flex items-center space-x-1">
                    {analyticsData.monthlyGrowth.revenue >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${analyticsData.monthlyGrowth.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analyticsData.monthlyGrowth.revenue >= 0 ? '+' : ''}{analyticsData.monthlyGrowth.revenue.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-orange-600" />
                <span>User Activity</span>
              </CardTitle>
              <CardDescription>User engagement metrics</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Registered Users</span>
                  <span className="font-bold">{analyticsData.totalUsers.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Active Users</span>
                  <span className="font-bold text-orange-600">{analyticsData.activeUsers}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Growth Rate</span>
                  <div className="flex items-center space-x-1">
                    {analyticsData.monthlyGrowth.users >= 0 ? (
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    ) : (
                      <TrendingDown className="h-3 w-3 text-red-600" />
                    )}
                    <span className={`text-sm font-medium ${analyticsData.monthlyGrowth.users >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {analyticsData.monthlyGrowth.users >= 0 ? '+' : ''}{analyticsData.monthlyGrowth.users.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bus Status and RFID Scanner Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bus Status Header */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Bus className="h-5 w-5 text-blue-600" />
              <span>Bus Status - {busInfo.bus_id}</span>
            </CardTitle>
            <CardDescription>Current vehicle information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-xl font-bold text-blue-600">
                  {busInfo.current_passengers}
                </div>
                <div className="text-sm text-blue-600">Current Passengers</div>
              </div>
              
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-600">
                  {busInfo.total_seats - busInfo.current_passengers}
                </div>
                <div className="text-sm text-green-600">Available Seats</div>
              </div>
              
              <div className="col-span-2 p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <MapPin className="h-4 w-4 text-purple-600" />
                  <div>
                    <div className="font-medium text-purple-900">Current Location</div>
                    <div className="text-sm text-purple-700">{busInfo.location}</div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">        {/* Recent RFID Scans */}
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

        {/* Recent System Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent System Activity</CardTitle>
            <CardDescription>Latest travel completions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {analyticsData?.recentActivity?.slice(0, 8).map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 bg-muted rounded-lg">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Navigation className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">
                      {activity.user_profile?.name || 'User'} • Card: {activity.user_profile?.card_id}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activity.pick_point} → {activity.drop_point}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">৳{activity.total_cost?.toFixed(0) || '0'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(activity.travel_time).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              )) || (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity data available</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Status */}
      {databaseMetrics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Database className="h-5 w-5" />
              <span>Database Status</span>
            </CardTitle>
            <CardDescription>Real-time database health and metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">{databaseMetrics.status}</div>
                <div className="text-sm text-green-600">Status</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">{databaseMetrics.totalRecords?.toLocaleString()}</div>
                <div className="text-sm text-blue-600">Total Records</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-lg font-bold text-purple-600">{databaseMetrics.dbSize}</div>
                <div className="text-sm text-purple-600">Database Size</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <div className="text-lg font-bold text-orange-600">{databaseMetrics.uptime}</div>
                <div className="text-sm text-orange-600">Uptime</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Registered Users */}
      <Card>
        <CardHeader>
          <CardTitle>Registered Passengers</CardTitle>
          <CardDescription>Users with RFID cards ({users.length} total)</CardDescription>
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
                  <th className="text-left p-2">Last Activity</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 10).map((user) => (
                  <tr key={user.user_id} className="border-b hover:bg-muted/50">
                    <td className="p-2 font-medium">{user.name}</td>
                    <td className="p-2 font-mono text-xs">{user.card_id}</td>
                    <td className="p-2">
                      <Badge variant={user.balance < 10 ? 'destructive' : user.balance < 50 ? 'secondary' : 'default'}>
                        ৳{user.balance}
                      </Badge>
                    </td>
                    <td className="p-2">
                      <Badge 
                        variant={busInfo.passenger_cards.has(user.card_id) ? 'default' : 'secondary'}
                      >
                        {busInfo.passenger_cards.has(user.card_id) ? 'On Bus' : 'Not Traveling'}
                      </Badge>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {users.length > 10 && (
              <div className="text-center py-3">
                <p className="text-sm text-muted-foreground">
                  Showing 10 of {users.length} users. View all in User Management.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
