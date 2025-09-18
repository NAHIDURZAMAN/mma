'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Play, 
  Pause, 
  Square, 
  MapPin, 
  Clock, 
  Zap, 
  TrendingUp,
  Users,
  Bus,
  Navigation,
  Activity,
  Target,
  Route,
  Trash2,
  RotateCcw
} from 'lucide-react';
import dynamic from 'next/dynamic';
import PassengerManagement from '@/components/PassengerManagement';
import RfidScanner from '@/components/RfidScanner';
import { io } from 'socket.io-client';

// Dynamically import the map component to avoid SSR issues
const InteractiveMap = dynamic(() => import('./interactiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">🗺️</div>
        <p className="text-gray-600">Loading interactive map...</p>
      </div>
    </div>
  )
});

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOPIFY_API_KEY || "7fa23b5a9b194102a9be9a11ce64a57c";

// Vehicle types with enhanced properties
const VEHICLE_TYPES = {
  bus: { 
    name: 'City Bus', 
    icon: '�', 
    color: '#10B981', 
    speed: 45, 
    capacity: 10,
    efficiency: 80,
    costPerKm: 2.0
  },

};

// Destination interface
interface Destination {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

// InteractiveMap props interface
interface InteractiveMapProps {
  userLocation: [number, number] | null;
  destinations: Destination[];
  currentPosition: [number, number] | null;
  vehicleType: 'bus' | 'express' | 'metro' | 'tram';
  isSimulationRunning: boolean;
  onDestinationSelect: (destination: Destination) => void;
  routeData: any;
  currentDestinationIndex: number;
  onVehiclePositionUpdate?: (position: [number, number]) => void;
  simulationProgress?: number;
  isWaitingAtStation?: boolean;
  onDestinationReached?: () => void;
}

interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  vehicleType: keyof typeof VEHICLE_TYPES;
  currentDestinationIndex: number;
  progress: number;
  passengers: number;
  totalDistance: number;
  elapsedTime: number;
  speed: number;
  efficiency: number;
  completedDestinations: number[];
  isWaitingAtStation: boolean;
  currentRouteProgress: number;
  optimizedDestinations: Destination[];
}

export default function SmartTransitSimulation() {
  const [simulation, setSimulation] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    vehicleType: 'bus',
    currentDestinationIndex: 0,
    progress: 0,
    currentRouteProgress: 0,
    passengers: 0,
    totalDistance: 0,
    elapsedTime: 0,
    speed: 0,
    efficiency: 0,
    completedDestinations: [],
    isWaitingAtStation: false,
    optimizedDestinations: []
  });

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [currentRoute, setCurrentRoute] = useState<any>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [isRfidConnected, setIsRfidConnected] = useState(false);
  const [lastRfidScan, setLastRfidScan] = useState<any>(null);

  const [stats, setStats] = useState({
    totalTrips: 127,
    activeVehicles: 8,
    avgEfficiency: 87,
    dailyRevenue: 45600
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [realTimeData, setRealTimeData] = useState({
    currentPosition: { lat: 23.7368, lng: 90.3951 },
    heading: 0,
    nextStop: '',
    eta: '',
    remainingDistance: 0
  });

  // Get current location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(userPos);
          setCurrentPosition(userPos);
          setRealTimeData(prev => ({
            ...prev,
            currentPosition: { lat: userPos[0], lng: userPos[1] }
          }));
        },
        (error) => {
          console.error('Error getting location:', error);
          // Fallback to Dhaka center if location access denied
          const fallbackPos: [number, number] = [23.8103, 90.4125];
          setUserLocation(fallbackPos);
          setCurrentPosition(fallbackPos);
        }
      );
    }
  }, []);

  // Setup WebSocket connection for RFID scanning
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        // Connect to Socket.IO server instead of raw WebSocket
        const socket = io('http://localhost:2000');
        
        socket.on('connect', () => {
          console.log('Connected to RFID Socket.IO server');
          setIsRfidConnected(true);
          wsRef.current = socket as any;
        });

        socket.on('rfid_scan', (data: any) => {
          console.log('RFID scan received via Socket.IO:', data);
          handleRfidScan(data);
        });

        socket.on('disconnect', () => {
          console.log('Disconnected from RFID Socket.IO server');
          setIsRfidConnected(false);
        });

        socket.on('connect_error', (error: any) => {
          console.error('Socket.IO connection error:', error);
          setIsRfidConnected(false);
        });

      } catch (error) {
        console.error('Failed to create Socket.IO connection:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current && (wsRef.current as any).disconnect) {
        (wsRef.current as any).disconnect();
      }
    };
  }, []);

  // Send vehicle position updates via Socket.IO
  useEffect(() => {
    if (wsRef.current && (wsRef.current as any).emit && currentPosition) {
      (wsRef.current as any).emit('vehicle_position_update', {
        lat: currentPosition[0],
        lng: currentPosition[1],
        address: `Vehicle Location: ${currentPosition[0].toFixed(6)}, ${currentPosition[1].toFixed(6)}`,
        busId: 'BUS001',
        timestamp: new Date().toISOString()
      });
    }
  }, [currentPosition]);

  // Send simulation status updates via Socket.IO
  useEffect(() => {
    if (wsRef.current && (wsRef.current as any).emit) {
      (wsRef.current as any).emit('simulation_status_update', {
        isRunning: simulation.isRunning,
        currentPosition: currentPosition ? { lat: currentPosition[0], lng: currentPosition[1] } : { lat: 23.8103, lng: 90.4125 },
        destinations: simulation.optimizedDestinations.length > 0 ? simulation.optimizedDestinations : destinations,
        currentDestinationIndex: simulation.currentDestinationIndex,
        progress: simulation.currentRouteProgress,
        isWaitingAtStation: simulation.isWaitingAtStation,
        vehicleType: simulation.vehicleType,
        timestamp: new Date().toISOString()
      });
    }
  }, [simulation.isRunning, simulation.currentDestinationIndex, simulation.currentRouteProgress, simulation.isWaitingAtStation, currentPosition]);

  // Handle RFID card scan
  const handleRfidScan = useCallback((scanData: any) => {
    console.log('RFID scan received:', scanData);
    setLastRfidScan(scanData);

    // Update user location to the bus/RFID scanner location
    if (scanData.busLocation) {
      const newLocation: [number, number] = [scanData.busLocation.lat, scanData.busLocation.lng];
      setUserLocation(newLocation);
      setCurrentPosition(newLocation);
      setRealTimeData(prev => ({
        ...prev,
        currentPosition: { lat: newLocation[0], lng: newLocation[1] }
      }));
      
      console.log('Updated user location from RFID scan:', newLocation);
    }

    // Update passenger count if someone boarded
    if (scanData.action === 'board') {
      setSimulation(prev => ({
        ...prev,
        passengers: prev.passengers + 1
      }));
    } else if (scanData.action === 'exit') {
      setSimulation(prev => ({
        ...prev,
        passengers: Math.max(0, prev.passengers - 1)
      }));
    }
  }, []);

  // Get current vehicle data
  const currentVehicle = VEHICLE_TYPES[simulation.vehicleType];

  // Fetch route from Geopify API
  const fetchRoute = useCallback(async (start: [number, number], end: [number, number]) => {
    if (!GEOAPIFY_API_KEY) {
      console.error('Geopify API key is missing');
      return null;
    }

    setIsLoadingRoute(true);
    try {
      const response = await fetch(
        `https://api.geoapify.com/v1/routing?waypoints=${start[0]},${start[1]}|${end[0]},${end[1]}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setIsLoadingRoute(false);
      return data;
    } catch (error) {
      console.error('Error fetching route:', error);
      setIsLoadingRoute(false);
      return null;
    }
  }, []);

  // Calculate distance between two points
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Find the shortest path to next destination
  const findShortestDestination = useCallback((currentPos: [number, number], remainingDestinations: Destination[]): Destination | null => {
    if (remainingDestinations.length === 0) return null;
    
    let shortestDistance = Infinity;
    let shortestDestination: Destination | null = null;
    
    remainingDestinations.forEach(dest => {
      const distance = calculateDistance(currentPos[0], currentPos[1], dest.lat, dest.lng);
      if (distance < shortestDistance) {
        shortestDistance = distance;
        shortestDestination = dest;
      }
    });
    
    return shortestDestination;
  }, [calculateDistance]);

  const handleDestinationSelect = useCallback((destination: Destination) => {
    if (destinations.length >= 5 || simulation.isRunning) return;
    
    const newDestinations = [...destinations, destination];
    setDestinations(newDestinations);
  }, [destinations, simulation.isRunning]);

  // Handle vehicle position updates from the map
  const handleVehiclePositionUpdate = useCallback((position: [number, number]) => {
    setCurrentPosition(position);
  }, []);

  // Handle when vehicle reaches a destination
  const handleDestinationReached = useCallback(() => {
    setSimulation(prev => ({
      ...prev,
      isWaitingAtStation: true,
      currentRouteProgress: 100,
      completedDestinations: [...prev.completedDestinations, prev.currentDestinationIndex]
    }));
  }, []);

  // Continue to next station
  const continueToNextStation = useCallback(async () => {
    if (!currentPosition || simulation.currentDestinationIndex >= simulation.optimizedDestinations.length - 1) {
      // Journey complete
      stopSimulation();
      return;
    }

    const nextDestIndex = simulation.currentDestinationIndex + 1;
    const nextDestination = simulation.optimizedDestinations[nextDestIndex];
    
    if (!nextDestination) {
      stopSimulation();
      return;
    }

    // Fetch route to next destination
    const route = await fetchRoute(currentPosition, [nextDestination.lat, nextDestination.lng]);
    setCurrentRoute(route);
    setRouteData(route);

    // Update simulation state
    setSimulation(prev => ({
      ...prev,
      currentDestinationIndex: nextDestIndex,
      isWaitingAtStation: false,
      currentRouteProgress: 0
    }));

    // Start animation to next destination
    startSingleDestinationJourney();
  }, [currentPosition, simulation.currentDestinationIndex, simulation.optimizedDestinations]);

  // Start journey to a single destination
  const startSingleDestinationJourney = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      setSimulation(prev => {
        if (!prev.isRunning || prev.isPaused || prev.isWaitingAtStation) return prev;

        const progressIncrement = 1.2; // Progress for single destination
        let newProgress = Math.min(prev.currentRouteProgress + progressIncrement, 100);

        return {
          ...prev,
          currentRouteProgress: newProgress,
          elapsedTime: prev.elapsedTime + 0.25
        };
      });
    }, 250);
  }, []);

  // Remove destination
  const removeDestination = useCallback((index: number) => {
    if (simulation.isRunning) return;
    
    const newDestinations = destinations.filter((_, i) => i !== index);
    setDestinations(newDestinations);
  }, [destinations, simulation.isRunning]);

  // Clear all destinations
  const clearAllDestinations = useCallback(() => {
    if (simulation.isRunning) return;
    setDestinations([]);
    setCurrentRoute(null);
    setRouteData(null);
  }, [simulation.isRunning]);

  // Fetch route with multiple destinations
  const fetchRouteWithMultipleDestinations = useCallback(async (waypoints: [number, number][]) => {
    if (!GEOAPIFY_API_KEY || waypoints.length < 2) {
      console.error('Geopify API key is missing or insufficient waypoints');
      return null;
    }

    setIsLoadingRoute(true);
    try {
      // Create waypoint string for Geopify API
      const waypointString = waypoints.map(wp => `${wp[0]},${wp[1]}`).join('|');
      const response = await fetch(
        `https://api.geoapify.com/v1/routing?waypoints=${waypointString}&mode=drive&apiKey=${GEOAPIFY_API_KEY}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setIsLoadingRoute(false);
      return data;
    } catch (error) {
      console.error('Error fetching multi-destination route:', error);
      setIsLoadingRoute(false);
      return null;
    }
  }, []);

  // Calculate total route distance
  const calculateTotalRouteDistance = useCallback(() => {
    if (!userLocation || destinations.length === 0) return 0;
    
    let totalDistance = 0;
    
    // Distance from user location to first destination
    totalDistance += calculateDistance(userLocation[0], userLocation[1], destinations[0].lat, destinations[0].lng);
    
    // Distance between consecutive destinations
    for (let i = 0; i < destinations.length - 1; i++) {
      const current = destinations[i];
      const next = destinations[i + 1];
      totalDistance += calculateDistance(current.lat, current.lng, next.lat, next.lng);
    }
    
    return totalDistance;
  }, [userLocation, destinations, calculateDistance]);

  // Start simulation
  const startSimulation = useCallback(async () => {
    if (!userLocation || destinations.length === 0) return;

    // Create optimized route using shortest path algorithm
    const optimized: Destination[] = [];
    const remaining = [...destinations];
    let currentPos = userLocation;

    // Find shortest path through all destinations
    while (remaining.length > 0) {
      const shortestDest = findShortestDestination(currentPos, remaining);
      if (shortestDest) {
        optimized.push(shortestDest);
        currentPos = [shortestDest.lat, shortestDest.lng];
        const index = remaining.findIndex(d => d.lat === shortestDest.lat && d.lng === shortestDest.lng);
        if (index !== -1) {
          remaining.splice(index, 1);
        }
      }
    }

    // Update simulation state with optimized destinations
    setSimulation(prev => ({
      ...prev,
      optimizedDestinations: optimized
    }));

    // Get route to first destination
    const firstDestination = optimized[0];
    if (!firstDestination) return;

    const route = await fetchRoute(userLocation, [firstDestination.lat, firstDestination.lng]);
    setCurrentRoute(route);
    setRouteData(route);

    setSimulation(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      currentDestinationIndex: 0,
      progress: 0,
      currentRouteProgress: 0,
      totalDistance: 0,
      elapsedTime: 0,
      passengers: Math.floor(Math.random() * currentVehicle.capacity * 0.7),
      speed: currentVehicle.speed,
      efficiency: currentVehicle.efficiency,
      completedDestinations: [],
      isWaitingAtStation: false
    }));

    // Start journey to first destination
    startSingleDestinationJourney();
  }, [userLocation, destinations, currentVehicle, fetchRoute, findShortestDestination, startSingleDestinationJourney]);

  // Pause simulation
  const pauseSimulation = () => {
    setSimulation(prev => ({ ...prev, isPaused: !prev.isPaused }));
  };

  // Stop simulation
  const stopSimulation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setSimulation(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false,
      progress: 0,
      currentDestinationIndex: 0,
      currentRouteProgress: 0,
      totalDistance: 0,
      elapsedTime: 0,
      passengers: 0,
      completedDestinations: [],
      isWaitingAtStation: false
    }));
    setCurrentPosition(userLocation);
    setSimulation(prev => ({
      ...prev,
      optimizedDestinations: []
    }));
  };

  // Reset travel database
  const resetTravelDatabase = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to reset ALL travel data? This will clear:\n\n' +
      '• ALL current passengers (will be removed from bus)\n' +
      '• Travel history\n' +
      '• Recent RFID scans\n' +
      '• Vehicle position (reset to terminal)\n\n' +
      'This will completely clear the system!\n' +
      'This action cannot be undone!'
    );

    if (!confirmed) return;

    try {
      const response = await fetch('http://localhost:2000/api/admin/reset-travel-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result = await response.json();

      if (result.success) {
        alert('✅ All travel data reset successfully! System is completely clear.');
        
        // Reset local simulation state
        stopSimulation();
        setDestinations([]);
        
        // Refresh passenger data
        if (window.location.pathname.includes('smart-transit')) {
          window.location.reload();
        }
      } else {
        alert('❌ Failed to reset travel database: ' + result.message);
      }
    } catch (error) {
      console.error('Error resetting travel database:', error);
      alert('❌ Error resetting travel database. Please try again.');
    }
  };

  // Change vehicle type
  const changeVehicleType = (type: keyof typeof VEHICLE_TYPES) => {
    if (!simulation.isRunning) {
      setSimulation(prev => ({ ...prev, vehicleType: type }));
    }
  };

  // Auto trigger destination reached when progress reaches 100%
  useEffect(() => {
    if (simulation.isRunning && simulation.currentRouteProgress >= 100 && !simulation.isWaitingAtStation) {
      handleDestinationReached();
    }
  }, [simulation.currentRouteProgress, simulation.isRunning, simulation.isWaitingAtStation, handleDestinationReached]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Calculate fare and efficiency
  const totalDistance = destinations.reduce((acc, dest, index) => {
    if (index === 0 && userLocation) {
      return acc + calculateDistance(userLocation[0], userLocation[1], dest.lat, dest.lng);
    } else if (index > 0) {
      const prevDest = destinations[index - 1];
      return acc + calculateDistance(prevDest.lat, prevDest.lng, dest.lat, dest.lng);
    }
    return acc;
  }, 0);

  const estimatedFare = totalDistance * currentVehicle.costPerKm;
  const efficiencyColor = simulation.efficiency > 85 ? 'text-green-600' : simulation.efficiency > 70 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
             Smart Transit Simulation
          </h1>
          <p className="text-gray-600 text-lg">
            Advanced Multi-Modal Transport System Simulator
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Trips</p>
                  <p className="text-2xl font-bold">{stats.totalTrips}</p>
                </div>
                <Route className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Active Vehicles</p>
                  <p className="text-2xl font-bold">{stats.activeVehicles}</p>
                </div>
                <Bus className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Efficiency</p>
                  <p className="text-2xl font-bold">{stats.avgEfficiency}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0 shadow-lg">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Revenue (Today)</p>
                  <p className="text-2xl font-bold">৳{stats.dailyRevenue.toLocaleString()}</p>
                </div>
                <Zap className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Vehicle Selection */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Bus className="h-5 w-5 text-blue-600" />
                  Vehicle Selection
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(VEHICLE_TYPES).map(([key, vehicle]) => (
                  <button
                    key={key}
                    onClick={() => changeVehicleType(key as keyof typeof VEHICLE_TYPES)}
                    disabled={simulation.isRunning}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-300 ${
                      simulation.vehicleType === key
                        ? 'border-blue-500 bg-blue-50 shadow-md transform scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    } ${simulation.isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{vehicle.icon}</span>
                        <div>
                          <p className="font-semibold text-gray-800">{vehicle.name}</p>
                          <p className="text-sm text-gray-500">
                            {vehicle.speed} km/h • {vehicle.capacity} seats
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div 
                          className="w-4 h-4 rounded-full border-2 border-white shadow-sm mb-1"
                          style={{ backgroundColor: vehicle.color }}
                        />
                        <p className="text-xs text-gray-500">{vehicle.efficiency}% eff</p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Destination Management */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-purple-600" />
                  Destinations ({destinations.length}/5)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {destinations.length === 0 ? (
                  <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <MapPin className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                    <p className="text-sm text-blue-700 font-medium">Click on the map to add destinations</p>
                    <p className="text-xs text-blue-600 mt-1">You can select up to 5 locations</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-48 overflow-y-auto space-y-2">
                      {(simulation.isRunning ? simulation.optimizedDestinations : destinations).map((dest: Destination, index: number) => {
                        const actualIndex = simulation.isRunning ? index : destinations.findIndex(d => d.lat === dest.lat && d.lng === dest.lng);
                        const isCompleted = simulation.completedDestinations.includes(index);
                        const isCurrent = simulation.currentDestinationIndex === index && simulation.isRunning;
                        
                        return (
                          <div key={`${dest.lat}-${dest.lng}`} className={`flex items-center justify-between p-3 rounded-lg border ${
                            isCompleted 
                              ? 'bg-green-50 border-green-300' 
                              : isCurrent && simulation.isRunning
                              ? simulation.isWaitingAtStation ? 'bg-yellow-50 border-yellow-300' : 'bg-blue-50 border-blue-300'
                              : 'bg-gray-50 border-gray-200'
                          }`}>
                            <div className="flex items-center gap-3">
                              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                isCompleted
                                  ? 'bg-green-500 text-white'
                                  : isCurrent && simulation.isRunning
                                  ? simulation.isWaitingAtStation ? 'bg-yellow-500 text-white' : 'bg-blue-500 text-white'
                                  : 'bg-purple-500 text-white'
                              }`}>
                                {isCompleted ? '✓' : simulation.isRunning ? index + 1 : actualIndex + 1}
                              </span>
                              <div>
                                <p className="text-sm font-medium text-gray-800">
                                  {dest.name || dest.address || `Destination ${actualIndex + 1}`}
                                  {simulation.isRunning && isCurrent && simulation.isWaitingAtStation && (
                                    <span className="ml-2 text-xs text-yellow-600 font-semibold">ARRIVED</span>
                                  )}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {dest.lat.toFixed(4)}, {dest.lng.toFixed(4)}
                                </p>
                              </div>
                            </div>
                            {!simulation.isRunning && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeDestination(actualIndex)}
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    
                    {!simulation.isRunning && (
                      <Button
                        variant="outline"
                        onClick={clearAllDestinations}
                        className="w-full border-2 border-red-200 text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Clear All Destinations
                      </Button>
                    )}

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Total Distance:</span>
                        <span className="font-medium">{totalDistance.toFixed(1)} km</span>
                      </div>
                      <div className="flex justify-between text-sm mt-1">
                        <span className="text-gray-600">Estimated Fare:</span>
                        <span className="font-medium">৳{estimatedFare.toFixed(0)}</span>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
             
            </Card>

            {/* Controls */}
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Activity className="h-5 w-5 text-green-600" />
                  Simulation Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {!simulation.isRunning ? (
                    <Button 
                      onClick={startSimulation}
                      disabled={!userLocation || destinations.length === 0 || isLoadingRoute}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      {isLoadingRoute ? 'Loading Route...' : 'Start Journey'}
                    </Button>
                  ) : simulation.isWaitingAtStation ? (
                    <Button 
                      onClick={continueToNextStation}
                      className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-lg"
                    >
                      <Navigation className="h-4 w-4 mr-2" />
                      Continue to Next Station
                    </Button>
                  ) : (
                    <Button 
                      onClick={pauseSimulation}
                      variant="outline"
                      className="flex-1 border-2 border-blue-500 text-blue-600 hover:bg-blue-50"
                    >
                      <Pause className="h-4 w-4 mr-2" />
                      {simulation.isPaused ? 'Resume' : 'Pause'}
                    </Button>
                  )}
                  
                  <Button 
                    onClick={stopSimulation}
                    disabled={!simulation.isRunning}
                    variant="outline"
                    className="border-2 border-red-500 text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                </div>

                {/* Reset Database Button */}
                <div className="pt-2 border-t border-gray-200">
                  <Button 
                    onClick={resetTravelDatabase}
                    variant="outline"
                    className="w-full border-2 border-red-500 text-red-600 hover:bg-red-50 font-medium"
                  >
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Reset ALL Travel Data
                  </Button>
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    ⚠️ Clear everything including current passengers
                  </p>
                </div>

                {/* Location Status */}
                {!userLocation && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-700 font-medium">📍 Getting your location...</p>
                    <p className="text-xs text-amber-600 mt-1">Allow location access for the best experience</p>
                  </div>
                )}

                {userLocation && destinations.length === 0 && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700 font-medium">🗺️ Ready to plan your journey</p>
                    <p className="text-xs text-blue-600 mt-1">Click on the map to select up to 5 destinations</p>
                  </div>
                )}

                {destinations.length >= 5 && (
                  <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <p className="text-sm text-orange-700 font-medium">⚠️ Maximum destinations reached</p>
                    <p className="text-xs text-orange-600 mt-1">Remove a destination to add a new one</p>
                  </div>
                )}

                {/* Progress Bar */}
                {simulation.isRunning && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {simulation.isWaitingAtStation ? 'Arrived at Station' : 'Route Progress'}
                      </span>
                      <span className="font-semibold">{Math.round(simulation.currentRouteProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all duration-300 ${
                          simulation.isWaitingAtStation 
                            ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
                            : 'bg-gradient-to-r from-blue-500 to-green-500'
                        }`}
                        style={{ width: `${simulation.currentRouteProgress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      {simulation.isWaitingAtStation 
                        ? `Station ${simulation.currentDestinationIndex + 1} - Waiting for approval`
                        : `To Station ${simulation.currentDestinationIndex + 1} of ${simulation.optimizedDestinations.length || destinations.length}`
                      }
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Real-time Journey Stats */}
            {simulation.isRunning && (
              <Card className="shadow-lg border-0 bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Target className="h-5 w-5" />
                    Live Journey Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-indigo-100 text-sm">Current Destination</p>
                      <p className="font-semibold">
                        {(simulation.isRunning ? simulation.optimizedDestinations : destinations)[simulation.currentDestinationIndex]?.name || 
                         (simulation.isRunning ? simulation.optimizedDestinations : destinations)[simulation.currentDestinationIndex]?.address || 
                         'Destination ' + (simulation.currentDestinationIndex + 1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">Next Stop</p>
                      <p className="font-semibold">{realTimeData.nextStop}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">ETA</p>
                      <p className="font-semibold">{realTimeData.eta}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">Passengers</p>
                      <p className="font-semibold">{Math.max(0, Math.min(simulation.passengers, currentVehicle.capacity))}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">Distance Covered</p>
                      <p className="font-semibold">{simulation.totalDistance.toFixed(1)} km</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">Current Fare</p>
                      <p className="font-semibold">৳{(simulation.totalDistance * currentVehicle.costPerKm).toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">Completed</p>
                      <p className="font-semibold">{simulation.completedDestinations.length} of {simulation.isRunning ? simulation.optimizedDestinations.length : destinations.length}</p>
                    </div>
                    <div>
                      <p className="text-indigo-100 text-sm">Remaining</p>
                      <p className="font-semibold">{realTimeData.remainingDistance.toFixed(1)} km</p>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-indigo-400">
                    <div className="flex justify-between items-center">
                      <span className="text-indigo-100 text-sm">Vehicle Efficiency</span>
                      <span className={`font-bold ${efficiencyColor.replace('text-', 'text-white')}`}>
                        {simulation.efficiency}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* RFID Scanner */}
            <RfidScanner 
              onLocationUpdate={(location) => {
                setUserLocation(location);
                setCurrentPosition(location);
              }}
            />
          </div>

          {/* Map and Visualization */}
          <div className="lg:col-span-2">
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <MapPin className="h-5 w-5 text-red-600" />
                  Live Transit Map
                  {simulation.isRunning && (
                    <Badge variant="secondary" className="ml-auto bg-green-100 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                      LIVE
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InteractiveMap
                  userLocation={userLocation}
                  destinations={simulation.isRunning ? simulation.optimizedDestinations : destinations}
                  currentPosition={currentPosition}
                  vehicleType={simulation.vehicleType}
                  isSimulationRunning={simulation.isRunning}
                  onDestinationSelect={handleDestinationSelect}
                  onVehiclePositionUpdate={handleVehiclePositionUpdate}
                  routeData={routeData}
                  currentDestinationIndex={simulation.currentDestinationIndex}
                  simulationProgress={simulation.currentRouteProgress}
                  isWaitingAtStation={simulation.isWaitingAtStation}
                  onDestinationReached={handleDestinationReached}
                />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Passenger Management Section */}
        <div className="mt-8">
          <PassengerManagement isSimulationRunning={simulation.isRunning} />
        </div>
      </div>
    </div>
  );
}
