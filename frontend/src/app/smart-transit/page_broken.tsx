'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// Dynamically import the map component to avoid SSR issues
const InteractiveMap = dynamic(() => import('./interactiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[500px] bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">🗺️</div>
        <p className="text-gray-600">Loading interactive map...</p>
      </div>
    </div>
  )
}) as React.ComponentType<InteractiveMapProps>;

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOPIFY_API_KEY || "7fa23b5a9b194102a9be9a11ce64a57c";

// Vehicle types with enhanced properties
const VEHICLE_TYPES = {
  bus: { 
    name: 'City Bus', 
    icon: '�', 
    color: '#10B981', 
    speed: 35, 
    capacity: 50,
    efficiency: 80,
    costPerKm: 2.0
  },
  express: { 
    name: 'Express Bus', 
    icon: '�', 
    color: '#F59E0B', 
    speed: 45, 
    capacity: 30,
    efficiency: 85,
    costPerKm: 2.5
  },
  metro: { 
    name: 'Metro Train', 
    icon: '�', 
    color: '#3B82F6', 
    speed: 60, 
    capacity: 200,
    efficiency: 95,
    costPerKm: 1.5
  },
  tram: { 
    name: 'Modern Tram', 
    icon: '🚋', 
    color: '#8B5CF6', 
    speed: 25, 
    capacity: 80,
    efficiency: 90,
    costPerKm: 1.8
  }
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
}

export default function SmartTransitSimulation() {
  const [simulation, setSimulation] = useState<SimulationState>({
    isRunning: false,
    isPaused: false,
    vehicleType: 'bus',
    currentDestinationIndex: 0,
    progress: 0,
    passengers: 0,
    totalDistance: 0,
    elapsedTime: 0,
    speed: 0,
    efficiency: 0,
    completedDestinations: []
  });

  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [currentRoute, setCurrentRoute] = useState<any>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);

  const [stats, setStats] = useState({
    totalTrips: 127,
    activeVehicles: 8,
    avgEfficiency: 87,
    dailyRevenue: 45600
  });

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
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

  const handleDestinationSelect = useCallback((destination: Destination) => {
    if (destinations.length >= 5 || simulation.isRunning) return;
    
    const newDestinations = [...destinations, destination];
    setDestinations(newDestinations);
  }, [destinations, simulation.isRunning]);

  // Handle vehicle position updates from the map
  const handleVehiclePositionUpdate = useCallback((position: [number, number]) => {
    setCurrentPosition(position);
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

  // Start simulation
  const startSimulation = useCallback(async () => {
    if (!userLocation || destinations.length === 0) return;

    // Create waypoints array starting from user location
    const waypoints: [number, number][] = [userLocation, ...destinations.map(dest => [dest.lat, dest.lng] as [number, number])];
    
    // Fetch route through all destinations
    const route = await fetchRouteWithMultipleDestinations(waypoints);
    setCurrentRoute(route);
    setRouteData(route);

    setSimulation(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      currentDestinationIndex: 0,
      progress: 0,
      totalDistance: 0,
      elapsedTime: 0,
      passengers: Math.floor(Math.random() * currentVehicle.capacity * 0.7),
      speed: currentVehicle.speed,
      efficiency: currentVehicle.efficiency,
      completedDestinations: []
    }));

    // Start simulation loop for multi-destination journey
    intervalRef.current = setInterval(() => {
      setSimulation(prev => {
        if (!prev.isRunning || prev.isPaused) return prev;

        let newProgress = prev.progress + 1.5; // Slower progress for better visualization
        let newDestinationIndex = prev.currentDestinationIndex;
        let newCompletedDestinations = [...prev.completedDestinations];

        // Calculate which destination we should be at based on progress
        const progressPerDestination = 100 / destinations.length;
        const expectedDestinationIndex = Math.floor(prev.progress / progressPerDestination);

        // Check if we've reached a new destination
        if (expectedDestinationIndex > newDestinationIndex && expectedDestinationIndex < destinations.length) {
          newCompletedDestinations.push(newDestinationIndex);
          newDestinationIndex = expectedDestinationIndex;
        }

        // Check if journey is complete
        if (newProgress >= 100) {
          newProgress = 100;
          // Complete the final destination if not already completed
          if (!newCompletedDestinations.includes(destinations.length - 1)) {
            newCompletedDestinations.push(destinations.length - 1);
          }
          newDestinationIndex = destinations.length - 1;
        }

        const totalDistance = calculateTotalRouteDistance();

        const currentDest = destinations[Math.min(newDestinationIndex, destinations.length - 1)];
        const nextDestIndex = newDestinationIndex + 1;
        const nextDest = nextDestIndex < destinations.length ? destinations[nextDestIndex] : null;

        setRealTimeData({
          currentPosition: currentDest ? { lat: currentDest.lat, lng: currentDest.lng } : { lat: userLocation[0], lng: userLocation[1] },
          heading: Math.random() * 360,
          nextStop: nextDest?.name || nextDest?.address || 'Final Destination',
          eta: `${Math.ceil((destinations.length - newDestinationIndex) * 3)} min`,
          remainingDistance: totalDistance * ((100 - newProgress) / 100)
        });

        return {
          ...prev,
          progress: newProgress,
          currentDestinationIndex: newDestinationIndex,
          totalDistance: totalDistance * (newProgress / 100),
          elapsedTime: prev.elapsedTime + 0.5,
          completedDestinations: newCompletedDestinations
        };
      });
    }, 200); // Faster update interval for smoother animation

  }, [userLocation, destinations, currentVehicle, calculateTotalRouteDistance]);

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

  // Start simulation
  const startSimulation = useCallback(async () => {
    if (!userLocation || destinations.length === 0) return;

    // Create waypoints array starting from user location
    const waypoints: [number, number][] = [userLocation, ...destinations.map(dest => [dest.lat, dest.lng] as [number, number])];
    
    // Fetch route through all destinations
    const route = await fetchRouteWithMultipleDestinations(waypoints);
    setCurrentRoute(route);
    setRouteData(route);

    setSimulation(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      currentDestinationIndex: 0,
      progress: 0,
      totalDistance: 0,
      elapsedTime: 0,
      passengers: Math.floor(Math.random() * currentVehicle.capacity * 0.7),
      speed: currentVehicle.speed,
      efficiency: currentVehicle.efficiency,
      completedDestinations: []
    }));

    // Start simulation loop for multi-destination journey
    intervalRef.current = setInterval(() => {
      setSimulation(prev => {
        if (!prev.isRunning || prev.isPaused) return prev;

        let newProgress = prev.progress + 1.5; // Slower progress for better visualization
        let newDestinationIndex = prev.currentDestinationIndex;
        let newCompletedDestinations = [...prev.completedDestinations];

        // Calculate which destination we should be at based on progress
        const progressPerDestination = 100 / destinations.length;
        const expectedDestinationIndex = Math.floor(prev.progress / progressPerDestination);

        // Check if we've reached a new destination
        if (expectedDestinationIndex > newDestinationIndex && expectedDestinationIndex < destinations.length) {
          newCompletedDestinations.push(newDestinationIndex);
          newDestinationIndex = expectedDestinationIndex;
        }

        // Check if journey is complete
        if (newProgress >= 100) {
          newProgress = 100;
          // Complete the final destination if not already completed
          if (!newCompletedDestinations.includes(destinations.length - 1)) {
            newCompletedDestinations.push(destinations.length - 1);
          }
          newDestinationIndex = destinations.length - 1;
        }

        const totalDistance = calculateTotalRouteDistance();

        const currentDest = destinations[Math.min(newDestinationIndex, destinations.length - 1)];
        const nextDestIndex = newDestinationIndex + 1;
        const nextDest = nextDestIndex < destinations.length ? destinations[nextDestIndex] : null;

        setRealTimeData({
          currentPosition: currentDest ? { lat: currentDest.lat, lng: currentDest.lng } : { lat: userLocation[0], lng: userLocation[1] },
          heading: Math.random() * 360,
          nextStop: nextDest?.name || nextDest?.address || 'Final Destination',
          eta: `${Math.ceil((destinations.length - newDestinationIndex) * 3)} min`,
          remainingDistance: totalDistance * ((100 - newProgress) / 100)
        });

        return {
          ...prev,
          progress: newProgress,
          currentDestinationIndex: newDestinationIndex,
          totalDistance: totalDistance * (newProgress / 100),
          elapsedTime: prev.elapsedTime + 0.5,
          completedDestinations: newCompletedDestinations
        };
      });
    }, 200); // Faster update interval for smoother animation

  }, [userLocation, destinations, currentVehicle, fetchRouteWithMultipleDestinations, calculateTotalRouteDistance]);

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
      totalDistance: 0,
      elapsedTime: 0,
      passengers: 0,
      completedDestinations: []
    }));
    setCurrentPosition(userLocation);
  };

  // Change vehicle type
  const changeVehicleType = (type: keyof typeof VEHICLE_TYPES) => {
    if (!simulation.isRunning) {
      setSimulation(prev => ({ ...prev, vehicleType: type }));
    }
  };

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
            🚀 Smart Transit Simulation
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
                      {destinations.map((dest, index) => (
                        <div key={index} className={`flex items-center justify-between p-3 rounded-lg border ${
                          simulation.completedDestinations.includes(index) 
                            ? 'bg-green-50 border-green-300' 
                            : index === simulation.currentDestinationIndex && simulation.isRunning
                            ? 'bg-blue-50 border-blue-300'
                            : 'bg-gray-50 border-gray-200'
                        }`}>
                          <div className="flex items-center gap-3">
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              simulation.completedDestinations.includes(index)
                                ? 'bg-green-500 text-white'
                                : index === simulation.currentDestinationIndex && simulation.isRunning
                                ? 'bg-blue-500 text-white'
                                : 'bg-purple-500 text-white'
                            }`}>
                              {simulation.completedDestinations.includes(index) ? '✓' : index + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {dest.name || dest.address || 'Selected Location'}
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
                              onClick={() => removeDestination(index)}
                              className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
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
                      <span className="text-gray-600">Journey Progress</span>
                      <span className="font-semibold">{Math.round(simulation.progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${simulation.progress}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 text-center">
                      Destination {simulation.currentDestinationIndex + 1} of {destinations.length}
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
                        {destinations[simulation.currentDestinationIndex]?.name || 
                         destinations[simulation.currentDestinationIndex]?.address || 
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
                      <p className="font-semibold">{simulation.completedDestinations.length} of {destinations.length}</p>
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
                  destinations={destinations}
                  currentPosition={currentPosition}
                  vehicleType={simulation.vehicleType}
                  isSimulationRunning={simulation.isRunning}
                  onDestinationSelect={handleDestinationSelect}
                  onVehiclePositionUpdate={handleVehiclePositionUpdate}
                  routeData={routeData}
                  currentDestinationIndex={simulation.currentDestinationIndex}
                  simulationProgress={simulation.progress}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
