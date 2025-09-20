'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  route_destinations?: string[];
  current_destination_index?: number;
  is_route_active?: boolean;
}

interface SystemStats {
  totalUsers: number;
  activePassengers: number;
  totalRevenue: number;
  totalTrips: number;
  lastUpdated: string;
}

interface RouteInfo {
  destinations: Array<{name: string; lat: number; lng: number}>;
  currentDestinationIndex: number;
  isActive: boolean;
  vehicleType: string;
  progress: number;
}

export default function MonitorPage() {
  const [isConnected, setIsConnected] = useState(false);
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [systemStats, setSystemStats] = useState<SystemStats>({
    totalUsers: 0,
    activePassengers: 0,
    totalRevenue: 0,
    totalTrips: 0,
    lastUpdated: new Date().toISOString()
  });
  const [realTimePassengers, setRealTimePassengers] = useState(0);
  const [currentRoute, setCurrentRoute] = useState<RouteInfo | null>(null);
  const [busInfo, setBusInfo] = useState<BusInfo>({
    bus_id: 'BUS-001',
    route: 'Loading route...',
    current_passengers: 0,
    total_seats: 40,
    location: 'Waiting for GPS update...',
    next_stop: 'Route planning...',
    passenger_cards: new Set(),
    route_destinations: [],
    current_destination_index: 0,
    is_route_active: false
  });

  // Track if we have an active route from simulation
  const [hasActiveSimulation, setHasActiveSimulation] = useState(false);

  // Dynamic route update handler
  const updateRoute = async (routeData: any) => {
    console.log('�️ Updating route with dynamic data:', routeData);
    
    if (routeData.destinations && routeData.destinations.length > 0) {
      const destinations = routeData.destinations;
      const routeString = destinations.map((dest: any) => dest.name || dest.geocodedName || 'Unknown').join(' → ');
      
      setBusInfo(prev => ({
        ...prev,
        route: routeString,
        route_destinations: destinations.map((dest: any) => dest.name || dest.geocodedName || 'Unknown'),
        current_destination_index: routeData.currentDestinationIndex || 0,
        is_route_active: routeData.isActive !== false,
        next_stop: destinations[Math.min(routeData.currentDestinationIndex + 1 || 0, destinations.length - 1)]?.name || 'Final destination'
      }));
      
      setHasActiveSimulation(true);
      console.log('✅ Route updated successfully:', routeString);
    }
  };

  // Clear route when simulation stops
  const clearRoute = () => {
    console.log('🧹 Clearing route - simulation stopped');
    setBusInfo(prev => ({
      ...prev,
      route: 'No active route',
      route_destinations: [],
      current_destination_index: 0,
      is_route_active: false,
      next_stop: 'Route planning...',
      location: 'Waiting for GPS update...'
    }));
    setHasActiveSimulation(false);
  };

  // Request current status from server
  const refreshStatus = () => {
    console.log('🔄 Requesting current status from server...');
    if (wsService.isConnected()) {
      wsService.send('request_simulation_status', {});
      wsService.send('request_stats', {});
    }
    fetchSystemStats();
  };

  useEffect(() => {
    initializeMonitoring();
    
    // Update clock every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Request fresh stats every 15 seconds for real-time updates
    const statsInterval = setInterval(() => {
      if (wsService.isConnected()) {
        wsService.send('request_stats', {});
      }
    }, 15000);

    // Request simulation status every 10 seconds
    const simulationInterval = setInterval(() => {
      if (wsService.isConnected()) {
        wsService.send('request_simulation_status', {});
      }
    }, 10000);

    return () => {
      clearInterval(clockInterval);
      clearInterval(statsInterval);
      clearInterval(simulationInterval);
      wsService.disconnect();
    };
  }, []);

  const initializeMonitoring = async () => {
    try {
      console.log('🔧 Initializing monitor page...');
      
      // Force disconnect any existing connection
      wsService.disconnect();
      
      // Wait a moment before reconnecting
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Connect to WebSocket with explicit URL
      console.log('🔌 Connecting to WebSocket...');
      wsService.connect('http://localhost:2000');
      
      // Set up event listeners
      wsService.on('connection', (data: any) => {
        console.log('📡 WebSocket connection status:', data);
        setIsConnected(data.status === 'connected');
        if (data.status === 'connected') {
          console.log('✅ WebSocket connected! Requesting initial stats...');
          // Request initial stats when connected
          fetchSystemStats();
          // Request real-time stats from server
          wsService.send('request_stats', {});
        } else if (data.status === 'error') {
          console.error('❌ WebSocket connection error:', data.error);
        }
      });

      // Listen for RFID scan events
      wsService.on('rfid_scan', (data: any) => {
        console.log('🔍 RFID scan received:', data);
        setScanEvents(prev => [data, ...prev.slice(0, 4)]); // Keep last 5 events
        setLastUpdate(new Date());
        
        // Update bus passenger count based on RFID scan
        handlePassengerCountUpdate(data);
      });

      // Listen for stats updates with enhanced real-time processing
      wsService.on('stats_update', (data: any) => {
        console.log('📊 Real-time stats update received:', data);
        
        // Update system stats immediately
        setSystemStats(prev => ({
          ...prev,
          totalUsers: data.totalUsers || prev.totalUsers,
          activePassengers: data.activeVehicles || prev.activePassengers,
          totalRevenue: data.dailyRevenue || prev.totalRevenue,
          totalTrips: data.totalTrips || prev.totalTrips,
          lastUpdated: data.timestamp || new Date().toISOString()
        }));
        
        // Update real-time passenger count from stats
        if (data.activeVehicles !== undefined) {
          setRealTimePassengers(data.activeVehicles);
          
          // Also update bus info passenger count if no local override
          setBusInfo(prev => ({
            ...prev,
            current_passengers: data.activeVehicles
          }));
        }
        
        setLastUpdate(new Date());
        console.log(`📈 Stats updated: ${data.totalUsers} users, ${data.activeVehicles} passengers, ৳${data.dailyRevenue} revenue`);
      });

      // Listen for user creation events to update user count
      wsService.on('user_created', (data: any) => {
        console.log('👤 User created:', data);
        
        setSystemStats(prev => ({
          ...prev,
          totalUsers: prev.totalUsers + 1,
          lastUpdated: new Date().toISOString()
        }));
        
        setLastUpdate(new Date());
      });

      // Listen for balance updates to potentially update revenue
      wsService.on('balance_updated', (data: any) => {
        console.log('💰 Balance updated:', data);
        
        // Request fresh stats after balance change
        setTimeout(() => {
          if (wsService.isConnected()) {
            wsService.send('request_stats', {});
          }
        }, 500);
        
        setLastUpdate(new Date());
      });

      // Listen for travel updates with real-time passenger tracking
      wsService.on('travel_update', (data: any) => {
        console.log('🚌 Travel update received:', data);
        
        if (data.action === 'travel_start') {
          // Passenger boarding
          setBusInfo(prev => ({
            ...prev,
            current_passengers: prev.current_passengers + 1
          }));
          setRealTimePassengers(prev => prev + 1);
          console.log('� Passenger boarded via WebSocket');
        }
        
        setLastUpdate(new Date());
      });

      // Listen for travel completion with passenger alighting
      wsService.on('travel_completed', (data: any) => {
        console.log('✅ Travel completed:', data);
        
        // Passenger alighting
        setBusInfo(prev => ({
          ...prev,
          current_passengers: Math.max(0, prev.current_passengers - 1)
        }));
        setRealTimePassengers(prev => Math.max(0, prev - 1));
        console.log('👇 Passenger alighted via WebSocket');
        
        setLastUpdate(new Date());
        
        // Update stats after travel completion
        setTimeout(() => {
          if (wsService.isConnected()) {
            wsService.send('request_stats', {});
          }
        }, 500);
      });

      // Listen for bus location updates with enhanced GPS tracking
      wsService.on('bus_location_update', async (data: any) => {
        console.log('📍 Bus location update received:', data);
        
        if (data.location) {
          let locationName = data.location.address;
          
          // Enhanced location processing with route context
          if (data.location.lat && data.location.lng) {
            // If address is just coordinates or unclear, do reverse geocoding
            if (!locationName || locationName.includes(data.location.lat) || 
                locationName.match(/^\d+\.\d+,\s*\d+\.\d+$/)) {
              try {
                locationName = await reverseGeocode(data.location.lat, data.location.lng);
                console.log(`📍 Enhanced location: ${locationName}`);
              } catch (error) {
                console.error('Failed to reverse geocode:', error);
                locationName = data.location.address || `${data.location.lat}, ${data.location.lng}`;
              }
            }
          }
          
          setBusInfo(prev => ({
            ...prev,
            location: locationName || 'Location update received'
          }));
          
          // Process route details if available
          if (data.routeDetails) {
            setBusInfo(prev => ({
              ...prev,
              location: data.routeDetails.currentLocation || locationName,
              next_stop: data.routeDetails.nextDestination || prev.next_stop,
              current_passengers: data.routeDetails.passengers || prev.current_passengers
            }));
            
            // Update real-time passenger count from route details
            if (data.routeDetails.passengers !== undefined) {
              setRealTimePassengers(data.routeDetails.passengers);
            }
            
            console.log(`🚌 Route details: ${data.routeDetails.currentLocation} → ${data.routeDetails.nextDestination} (${data.routeDetails.passengers} passengers)`);
          }
        }
        
        setLastUpdate(new Date());
      });

      // Listen for vehicle position updates
      wsService.on('vehicle_position_update', (data: any) => {
        console.log('🚗 Vehicle position update received:', data);
        if (data.address) {
          setBusInfo(prev => ({
            ...prev,
            location: data.address
          }));
        }
        setLastUpdate(new Date());
      });

      // Listen for route updates from Smart Transit simulation
      wsService.on('route_updated', (data: any) => {
        console.log('🗺️ Route update received:', data);
        if (data.route) {
          updateRoute({
            destinations: data.route.destinations || [],
            currentDestinationIndex: data.route.currentDestinationIndex || 0,
            isActive: data.route.status === 'active'
          });
        }
        setLastUpdate(new Date());
      });

      // Listen for any WebSocket events that might indicate active simulation
      wsService.on('connect', () => {
        console.log('🔄 WebSocket connected, requesting current state...');
        setTimeout(() => {
          wsService.send('request_simulation_status', {});
          wsService.send('get_current_route', {});
          wsService.send('request_stats', {});
        }, 1000);
      });

      // Listen for simulation status updates
      wsService.on('simulation_status', async (data: any) => {
        console.log('🚌 Simulation status update received:', data);
        
        if (data && data.isRunning && data.destinations) {
          console.log('✅ Active simulation detected - updating route dynamically');
          await updateRoute({
            destinations: data.destinations,
            currentDestinationIndex: data.currentDestinationIndex || 0,
            isActive: true
          });
          
          // Update position if available
          if (data.currentPosition) {
            const locationName = await reverseGeocode(data.currentPosition.lat, data.currentPosition.lng);
            setBusInfo(prev => ({
              ...prev,
              location: locationName
            }));
          }
        } else if (data && data.isRunning === false) {
          console.log('⏹️ Simulation stopped');
          clearRoute();
        }
        
        setLastUpdate(new Date());
      });

      // Listen for vehicle position updates
      wsService.on('vehicle_position_update', async (data: any) => {
        console.log('🚗 Vehicle position update received:', data);
        
        let locationName = data.address;
        
        // Reverse geocode if needed
        if (data.lat && data.lng && (!data.address || data.address.includes(data.lat))) {
          try {
            locationName = await reverseGeocode(parseFloat(data.lat), parseFloat(data.lng));
          } catch (error) {
            console.error('Failed to reverse geocode:', error);
            locationName = data.address || `${data.lat}, ${data.lng}`;
          }
        }
        
        setBusInfo(prev => ({
          ...prev,
          location: locationName
        }));
        
        setLastUpdate(new Date());
      });

      // Listen for route status changes
      wsService.on('route_status_changed', (data: any) => {
        console.log('📊 Route status changed:', data);
        setBusInfo(prev => ({
          ...prev,
          is_route_active: data.status === 'active',
          current_destination_index: data.currentDestinationIndex || prev.current_destination_index
        }));
        setHasActiveSimulation(data.status === 'active');
        setLastUpdate(new Date());
      });

      // Initial stats fetch
      await fetchSystemStats();

    } catch (error) {
      console.error('❌ Failed to initialize monitoring:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reverse geocoding function
  const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
    try {
      const GEOAPIFY_API_KEY = '7fa23b5a9b194102a9be9a11ce64a57c';
      const response = await fetch(
        `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data.features && data.features.length > 0) {
          const properties = data.features[0].properties;
          // Build a readable address
          const parts = [];
          if (properties.name) parts.push(properties.name);
          if (properties.street) parts.push(properties.street);
          if (properties.district) parts.push(properties.district);
          if (properties.city) parts.push(properties.city);
          
          const address = parts.length > 0 ? parts.join(', ') : properties.formatted;
          return address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
      }
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
    }
    
    // Fallback to coordinates if geocoding fails
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  };

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Process destinations and build route names
  const processDestinations = async (destinations: any[], currentPos?: any) => {
    if (!destinations || destinations.length === 0) {
      return [];
    }

    const processedDestinations = await Promise.all(
      destinations.map(async (dest: any) => {
        if (dest.name) {
          return { ...dest, geocodedName: dest.name };
        }
        if (dest.lat && dest.lng) {
          try {
            const locationName = await reverseGeocode(dest.lat, dest.lng);
            return { ...dest, geocodedName: locationName };
          } catch (error) {
            console.error('Failed to geocode destination:', error);
            return { ...dest, geocodedName: `${dest.lat}, ${dest.lng}` };
          }
        }
        return { ...dest, geocodedName: 'Unknown Location' };
      })
    );

    return processedDestinations;
  };
  const fetchSystemStats = async () => {
    // Don't override route if simulation is active
    if (hasActiveSimulation) {
      console.log('🚫 Skipping route updates - simulation active');
    }
    
    try {
      const result = await apiService.getMonitorStats();
      if (result.success) {
        setSystemStats({
          totalUsers: result.data.totalUsers || 0,
          activePassengers: result.data.activePassengers || 0,
          totalRevenue: result.data.totalRevenue || 0,
          totalTrips: result.data.totalTrips || 0,
          lastUpdated: result.data.lastUpdated || new Date().toISOString()
        });
        setRealTimePassengers(result.data.activePassengers || 0);
        
        // Update bus info with real data
        setBusInfo(prev => ({
          ...prev,
          current_passengers: result.data.activePassengers || 0
        }));

        // If we have recent activity, try to build a dynamic route ONLY if no simulation is active
        if (result.data.recentActivity && result.data.recentActivity.length > 0 && !hasActiveSimulation) {
          setTimeout(() => {
            console.log('📊 No active simulation, building route from recent activity');
            updateRouteFromRecentActivity(result.data.recentActivity);
          }, 100);
        }

        // Request simulation status from WebSocket to get current route
        if (wsService.isConnected()) {
          console.log('📡 Requesting simulation status after stats fetch...');
          wsService.send('request_simulation_status', {});
          wsService.send('get_current_route', {});
        }
      }
    } catch (error) {
      console.error('Failed to fetch system stats:', error);
      // Fallback: try direct fetch if API service fails
      try {
        const response = await fetch('http://localhost:2000/api/monitor/stats');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setSystemStats({
              totalUsers: result.data.totalUsers || 0,
              activePassengers: result.data.activePassengers || 0,
              totalRevenue: result.data.totalRevenue || 0,
              totalTrips: result.data.totalTrips || 0,
              lastUpdated: result.data.lastUpdated || new Date().toISOString()
            });
            setRealTimePassengers(result.data.activePassengers || 0);
            
            setBusInfo(prev => ({
              ...prev,
              current_passengers: result.data.activePassengers || 0
            }));

            if (result.data.recentActivity && result.data.recentActivity.length > 0 && !hasActiveSimulation) {
              setTimeout(() => {
                console.log('📊 Fallback: Building route from recent activity');
                updateRouteFromRecentActivity(result.data.recentActivity);
              }, 100);
            }

            // Request simulation status
            if (wsService.isConnected()) {
              wsService.send('request_simulation_status', {});
            }
          }
        }
      } catch (fallbackError) {
        console.error('Fallback fetch also failed:', fallbackError);
      }
    }
  };

  // Update route information from recent travel activity
  const updateRouteFromRecentActivity = (recentActivity: any[]) => {
    if (!recentActivity || recentActivity.length === 0 || hasActiveSimulation) {
      return;
    }

    // Get unique locations from recent trips
    const locations = new Set<string>();
    let hasActiveTravel = false;
    
    recentActivity.forEach((activity: any) => {
      if (!activity.drop_point) hasActiveTravel = true;
      
      if (activity.pick_point) {
        const cleanPickPoint = activity.pick_point.split('(')[0].split(',')[0].trim();
        locations.add(cleanPickPoint);
      }
      if (activity.drop_point) {
        const cleanDropPoint = activity.drop_point.split('(')[0].split(',')[0].trim();
        locations.add(cleanDropPoint);
      }
    });

    if (locations.size > 1) {
      const routeArray = Array.from(locations).slice(0, 5);
      const dynamicRoute = routeArray.join(' → ');
      
      setBusInfo(prev => ({
        ...prev,
        route: dynamicRoute,
        route_destinations: routeArray,
        is_route_active: hasActiveTravel,
        location: routeArray[0] || prev.location,
        next_stop: routeArray[1] || 'End of route'
      }));

      console.log('📍 Route built from recent activity:', dynamicRoute);
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
          console.log(`👆 Passenger boarded: ${cardId} - Total: ${newPassengerCount}`);
        } else if (isAlighting && newPassengerCards.has(cardId)) {
          newPassengerCards.delete(cardId);
          newPassengerCount -= 1;
          console.log(`👇 Passenger alighted: ${cardId} - Total: ${newPassengerCount}`);
        }

        const updatedCount = Math.max(0, newPassengerCount);
        
        // Update the real-time passenger count immediately
        setRealTimePassengers(updatedCount);

        return {
          ...prev,
          current_passengers: updatedCount,
          passenger_cards: newPassengerCards,
          location: scanData.location || prev.location
        };
      });

      // Broadcast passenger count change via WebSocket if needed
      if (wsService.isConnected()) {
        wsService.send('passenger_count_update', {
          passenger_count: busInfo.current_passengers,
          timestamp: new Date().toISOString()
        });
      }
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
                  <div className="flex items-center space-x-2">
                    <p className="text-gray-600">{busInfo.route}</p>
                    {busInfo.is_route_active && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        🚀 Active Route
                      </Badge>
                    )}
                    {!busInfo.is_route_active && busInfo.route !== 'No active route' && busInfo.route !== 'Simulation stopped' && (
                      <Badge variant="outline" className="text-orange-600 border-orange-600">
                        📋 Route Planned
                      </Badge>
                    )}
                    {busInfo.route === 'Simulation stopped' && (
                      <Badge variant="outline" className="text-red-600 border-red-600">
                        ⏹️ Stopped
                      </Badge>
                    )}
                    {busInfo.route === 'No active route' && (
                      <Badge variant="outline" className="text-gray-600 border-gray-600">
                        ⏳ Waiting
                      </Badge>
                    )}
                  </div>
                  {busInfo.route_destinations && busInfo.route_destinations.length > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      Progress: {(busInfo.current_destination_index || 0) + 1} of {busInfo.route_destinations.length} stops
                    </div>
                  )}
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
                    <>
                      <Wifi className="h-5 w-5 text-green-500" />
                      <Badge variant="default" className="bg-green-500">
                        ONLINE
                      </Badge>
                    </>
                  ) : (
                    <>
                      <WifiOff className="h-5 w-5 text-red-500" />
                      <Badge variant="destructive">
                        OFFLINE
                      </Badge>
                    </>
                  )}
                  <Button 
                    onClick={() => {
                      console.log('🔄 Manual reconnection attempt...');
                      initializeMonitoring();
                    }}
                    variant="outline"
                    size="sm"
                    className="ml-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Users */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Users</p>
                <p className="text-2xl font-bold text-gray-800">{systemStats.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-gray-500">Registered</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Active Passengers */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Passengers</p>
                <p className="text-2xl font-bold text-green-600">{realTimePassengers}</p>
                <p className="text-xs text-gray-500">Currently traveling</p>
              </div>
              <div className="relative">
                <BusIcon className="h-8 w-8 text-green-600" />
                {realTimePassengers > 0 && (
                  <div className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Revenue */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
                <p className="text-2xl font-bold text-green-600">৳{systemStats.totalRevenue.toFixed(2)}</p>
                <p className="text-xs text-gray-500">From completed trips</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Trips */}
        <Card className="bg-white/90 backdrop-blur-sm border-0 shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Trips</p>
                <p className="text-2xl font-bold text-purple-600">{systemStats.totalTrips}</p>
                <p className="text-xs text-gray-500">Completed journeys</p>
              </div>
              <MapPin className="h-8 w-8 text-purple-600" />
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
                {busInfo.route_destinations && busInfo.current_destination_index !== undefined && (
                  <div className="text-xs text-gray-500 mt-1">
                    Stop {(busInfo.current_destination_index || 0) + 1}: {busInfo.route_destinations[busInfo.current_destination_index || 0] || 'Unknown'}
                  </div>
                )}
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-sm text-gray-600 mb-1">Next Stop</div>
                <div className="text-lg font-bold text-green-800">
                  {busInfo.next_stop}
                </div>
                {busInfo.route_destinations && busInfo.current_destination_index !== undefined && (
                  <div className="text-xs text-gray-500 mt-1">
                    {busInfo.route_destinations.length - (busInfo.current_destination_index || 0) - 1} stops remaining
                  </div>
                )}
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
