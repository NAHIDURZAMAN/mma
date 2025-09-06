'use client';

import React, { useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { LeafletMapHandle } from './LeafletMap';

// Dynamically import Leaflet to avoid SSR issues
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 lg:h-[600px] flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">🗺️</div>
        <p className="text-gray-600">Loading interactive map...</p>
      </div>
    </div>
  )
});

const GEOAPIFY_API_KEY = process.env.NEXT_PUBLIC_GEOPIFY_API_KEY || "7fa23b5a9b194102a9be9a11ce64a57c";

// Vehicle types with different characteristics
const VEHICLE_TYPES = {
  bus: { 
    speed: 25, 
    color: '#3B82F6', 
    icon: '🚌', 
    name: 'Bus',
    capacity: 50,
    fuel: 'Diesel'
  },
  rickshaw: { 
    speed: 15, 
    color: '#10B981', 
    icon: '🛺', 
    name: 'Rickshaw',
    capacity: 3,
    fuel: 'Manual'
  },
  car: { 
    speed: 40, 
    color: '#F59E0B', 
    icon: '🚗', 
    name: 'Private Car',
    capacity: 5,
    fuel: 'Petrol'
  },
  bike: { 
    speed: 20, 
    color: '#EF4444', 
    icon: '🏍️', 
    name: 'Motorcycle',
    capacity: 2,
    fuel: 'Petrol'
  }
};

type Destination = {
  lat: number;
  lng: number;
  name?: string;
};

export default function TransportSimulation() {
  const mapRef = useRef<LeafletMapHandle>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const routeLayersRef = useRef<any[]>([]);
  const destinationMarkersRef = useRef<any[]>([]);
  const userMarkerRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  
  const [selectedVehicle, setSelectedVehicle] = useState<keyof typeof VEHICLE_TYPES>('bus');
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isSimulating, setIsSimulating] = useState(false);
  const [routeData, setRouteData] = useState<any>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [currentDestinationIndex, setCurrentDestinationIndex] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string>('');
  const [nearbyPlaces, setNearbyPlaces] = useState<any[]>([]);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [simulationStats, setSimulationStats] = useState({
    distance: 0,
    duration: 0,
    avgSpeed: 0,
    stops: 0
  });
  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [visitedDestinations, setVisitedDestinations] = useState<number[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [currentRouteIndex, setCurrentRouteIndex] = useState(0);
  const [remainingDestinations, setRemainingDestinations] = useState<Destination[]>([]);

  // Handle map ready
  const handleMapReady = useCallback((map: any) => {
    mapInstanceRef.current = map;
    
    // Get user location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos: [number, number] = [position.coords.latitude, position.coords.longitude];
          setUserLocation(userPos);
          map.setView(userPos, 15);
          
          // Add user location marker
          const L = (window as any).L;
          const userIcon = L.divIcon({
            html: '<div style="background: #3B82F6; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            className: 'user-location-marker'
          });
          
          userMarkerRef.current = L.marker(userPos, { icon: userIcon })
            .addTo(map)
            .bindPopup('📍 Your Location')
            .openPopup();
        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }
  }, []);

  // Handle map click for destinations
  const handleMapClick = useCallback((e: any) => {
    if (isSimulating || isPaused || destinations.length >= 5) return;
    
    const clickPos: Destination = { lat: e.latlng.lat, lng: e.latlng.lng };
    const newDestinations = [...destinations, clickPos];
    setDestinations(newDestinations);
    
    // Add destination marker
    if (mapInstanceRef.current) {
      const L = (window as any).L;
      const destIcon = L.divIcon({
        html: `<div style="background: #EF4444; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${newDestinations.length}</div>`,
        iconSize: [25, 25],
        className: 'destination-marker'
      });
      
      const marker = L.marker([clickPos.lat, clickPos.lng], { icon: destIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`🎯 Destination ${newDestinations.length}`)
        .openPopup();
      
      destinationMarkersRef.current.push(marker);
    }
  }, [isSimulating, isPaused, destinations]);

  // Remove destination
  const removeDestination = useCallback((index: number) => {
    if (isSimulating || isPaused) return;
    
    const newDestinations = destinations.filter((_, i) => i !== index);
    setDestinations(newDestinations);
    
    // Remove marker
    if (destinationMarkersRef.current[index] && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(destinationMarkersRef.current[index]);
    }
    destinationMarkersRef.current = destinationMarkersRef.current.filter((_, i) => i !== index);
    
    // Update remaining markers with new numbers
    destinationMarkersRef.current.forEach((marker, i) => {
      const L = (window as any).L;
      const destIcon = L.divIcon({
        html: `<div style="background: #EF4444; color: white; border-radius: 50%; width: 25px; height: 25px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${i + 1}</div>`,
        iconSize: [25, 25],
        className: 'destination-marker'
      });
      marker.setIcon(destIcon);
      marker.setPopupContent(`🎯 Destination ${i + 1}`);
    });
  }, [isSimulating, isPaused, destinations]);

  // Clear all destinations
  const clearAllDestinations = useCallback(() => {
    if (isSimulating || isPaused) return;
    
    setDestinations([]);
    
    // Remove all destination markers
    destinationMarkersRef.current.forEach(marker => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    destinationMarkersRef.current = [];
  }, [isSimulating, isPaused]);

  // Fetch route data from Geoapify
  const fetchRoute = useCallback(async (waypoints: [number, number][]) => {
    if (!GEOAPIFY_API_KEY || waypoints.length < 2) {
      console.error('Geoapify API key is missing or insufficient waypoints');
      return null;
    }

    setIsLoadingRoute(true);
    try {
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
      console.error('Error fetching route:', error);
      setIsLoadingRoute(false);
      return null;
    }
  }, []);

  // Fetch nearby places
  const fetchNearbyPlaces = useCallback(async (center: [number, number]) => {
    if (!GEOAPIFY_API_KEY) return;

    try {
      const response = await fetch(
        `https://api.geoapify.com/v2/places?categories=commercial.transport,service.vehicle&filter=circle:${center[1]},${center[0]},5000&bias=proximity:${center[1]},${center[0]}&limit=10&apiKey=${GEOAPIFY_API_KEY}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setNearbyPlaces(data.features || []);
      }
    } catch (error) {
      console.error('Error fetching nearby places:', error);
    }
  }, []);

  // Calculate distance between two points using Haversine formula
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }, []);

  // Find the closest destination from current position
  const findClosestDestination = useCallback((currentPos: [number, number], availableDestinations: Destination[]): { destination: Destination; index: number } | null => {
    if (availableDestinations.length === 0) return null;

    let closestDistance = Infinity;
    let closestDestination = null;
    let closestIndex = -1;

    availableDestinations.forEach((dest, index) => {
      const distance = calculateDistance(currentPos[0], currentPos[1], dest.lat, dest.lng);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestDestination = dest;
        closestIndex = index;
      }
    });

    return closestDestination ? { destination: closestDestination, index: closestIndex } : null;
  }, [calculateDistance]);

  // Generate fallback route when API fails
  const generateFallbackRoute = useCallback((start: [number, number], end: [number, number]): [number, number][] => {
    const route: [number, number][] = [];
    const steps = 20;
    
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      const lat = start[0] + (end[0] - start[0]) * ratio + (Math.random() - 0.5) * 0.0005;
      const lng = start[1] + (end[1] - start[1]) * ratio + (Math.random() - 0.5) * 0.0005;
      route.push([lat, lng]);
    }
    
    return route;
  }, []);

  // Start simulation with intelligent route planning
  const startSimulation = useCallback(async () => {
    if (!userLocation || destinations.length === 0 || !mapInstanceRef.current) return;

    setIsSimulating(true);
    setSimulationProgress(0);
    setCurrentDestinationIndex(0);
    setCurrentPosition(userLocation);
    setVisitedDestinations([]);
    setIsPaused(false);
    setRemainingDestinations([...destinations]);

    // Start with the first leg of the journey, passing destinations directly
    await startNextLegWithDestinations(userLocation, [...destinations]);

    // Fetch nearby places
    fetchNearbyPlaces(userLocation);
  }, [userLocation, destinations]);

  // Start the next leg of the journey (to closest destination)
  const startNextLeg = useCallback(async () => {
    const currentPos = currentPosition || userLocation;
    if (!currentPos || remainingDestinations.length === 0 || !mapInstanceRef.current) {
      // Journey complete
      setIsSimulating(false);
      setSimulationProgress(100);
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.bindPopup('🎉 Journey Complete! All destinations reached.').openPopup();
      }
      return;
    }

    await startNextLegWithDestinations(currentPos, remainingDestinations);
  }, [currentPosition, userLocation, remainingDestinations]);

  // Helper function to start next leg with explicit destinations
  const startNextLegWithDestinations = useCallback(async (currentPos: [number, number], availableDestinations: Destination[]) => {
    if (!currentPos || availableDestinations.length === 0 || !mapInstanceRef.current) {
      // Journey complete
      setIsSimulating(false);
      setSimulationProgress(100);
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.bindPopup('🎉 Journey Complete! All destinations reached.').openPopup();
      }
      return;
    }

    // Find closest destination
    const closestResult = findClosestDestination(currentPos, availableDestinations);
    if (!closestResult) return;

    const { destination: nextDestination, index: destIndex } = closestResult;
    
    // Fetch route to next destination
    const waypoints: [number, number][] = [currentPos, [nextDestination.lat, nextDestination.lng]];
    const route = await fetchRoute(waypoints);
    
    let routeCoords: [number, number][] = [];
    
    if (route && route.features && route.features[0]) {
      setRouteData(route);
      const routeGeometry = route.features[0].geometry.coordinates[0];
      routeCoords = routeGeometry.map((coord: number[]) => [coord[1], coord[0]]);
      
      const properties = route.features[0].properties;
      
      // Update stats for this leg
      setSimulationStats(prev => ({
        distance: prev.distance + Math.round(properties.distance / 1000 * 10) / 10,
        duration: prev.duration + Math.round(properties.time / 60),
        avgSpeed: VEHICLE_TYPES[selectedVehicle].speed,
        stops: destinations.length
      }));
    } else {
      // Fallback route
      routeCoords = generateFallbackRoute(currentPos, [nextDestination.lat, nextDestination.lng]);
      const distance = calculateDistance(currentPos[0], currentPos[1], nextDestination.lat, nextDestination.lng);
      
      setSimulationStats(prev => ({
        distance: prev.distance + Math.round(distance * 10) / 10,
        duration: prev.duration + Math.round((distance / VEHICLE_TYPES[selectedVehicle].speed) * 60),
        avgSpeed: VEHICLE_TYPES[selectedVehicle].speed,
        stops: destinations.length
      }));
    }

    // Clear previous route layers
    routeLayersRef.current.forEach(layer => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    routeLayersRef.current = [];

    // Create new route polyline
    const L = (window as any).L;
    const routePolyline = L.polyline(routeCoords, {
      color: VEHICLE_TYPES[selectedVehicle].color,
      weight: 4,
      opacity: 0.7
    });

    routePolyline.addTo(mapInstanceRef.current);
    routeLayersRef.current.push(routePolyline);

    // Start animation to this destination - pass the actual destination index from original array
    const originalDestIndex = destinations.findIndex(dest => 
      dest.lat === nextDestination.lat && dest.lng === nextDestination.lng
    );
    animateVehicleToDestination(routeCoords, nextDestination, originalDestIndex, availableDestinations);
  }, [selectedVehicle, fetchRoute, calculateDistance, generateFallbackRoute, findClosestDestination, destinations]);

  // Resume journey to next destination
  const resumeJourney = useCallback(async () => {
    setIsPaused(false);
    setIsSimulating(true); // Resume simulation
    
    // Use current position and remaining destinations
    const currentPos = currentPosition || userLocation;
    if (!currentPos || remainingDestinations.length === 0 || !mapInstanceRef.current) {
      // Journey complete
      setIsSimulating(false);
      setSimulationProgress(100);
      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.bindPopup('🎉 Journey Complete! All destinations reached.').openPopup();
      }
      return;
    }

    // Ensure vehicle marker is visible and positioned correctly before resuming
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPos);
      const vehicle = VEHICLE_TYPES[selectedVehicle];
      const L = (window as any).L;
      const vehicleIcon = L.divIcon({
        html: `<div style="
          background: ${vehicle.color}; 
          color: white; 
          border-radius: 50%; 
          width: 30px; 
          height: 30px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 16px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${vehicle.icon}</div>`,
        iconSize: [30, 30],
        className: 'vehicle-marker'
      });
      vehicleMarkerRef.current.setIcon(vehicleIcon);
      
      // Make sure the marker is visible
      if (mapInstanceRef.current && !mapInstanceRef.current.hasLayer(vehicleMarkerRef.current)) {
        vehicleMarkerRef.current.addTo(mapInstanceRef.current);
      }
    }

    await startNextLegWithDestinations(currentPos, remainingDestinations);
  }, [currentPosition, userLocation, remainingDestinations, selectedVehicle, startNextLegWithDestinations]);

  // Animate vehicle movement to a specific destination
  const animateVehicleToDestination = useCallback((route: [number, number][], destination: Destination, destinationIndex: number, currentAvailableDestinations?: Destination[]) => {
    if (!mapInstanceRef.current) return;

    const vehicle = VEHICLE_TYPES[selectedVehicle];
    const totalSteps = route.length * 8;
    let currentStep = 0;

    // Create or update vehicle marker
    const L = (window as any).L;
    const vehicleIcon = L.divIcon({
      html: `<div style="
        background: ${vehicle.color}; 
        color: white; 
        border-radius: 50%; 
        width: 30px; 
        height: 30px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        font-size: 16px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${vehicle.icon}</div>`,
      iconSize: [30, 30],
      className: 'vehicle-marker'
    });

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker(route[0], { icon: vehicleIcon })
        .addTo(mapInstanceRef.current);
    } else {
      vehicleMarkerRef.current.setIcon(vehicleIcon);
      vehicleMarkerRef.current.setLatLng(route[0]); // Ensure it's at the start of the new route
      
      // Make sure the marker is still on the map (in case it was accidentally removed)
      if (!mapInstanceRef.current.hasLayer(vehicleMarkerRef.current)) {
        vehicleMarkerRef.current.addTo(mapInstanceRef.current);
      }
    }

    vehicleMarkerRef.current.bindPopup(`${vehicle.name} - Speed: ${vehicle.speed} km/h`);

    const animate = () => {
      if (currentStep >= totalSteps) {
        // Reached destination
        const reachedPosition: [number, number] = [destination.lat, destination.lng];
        
        console.log('Reached destination:', destination, 'Vehicle marker exists:', !!vehicleMarkerRef.current);
        
        // Update current position immediately
        setCurrentPosition(reachedPosition);
        
        // Update visited destinations
        setVisitedDestinations(prev => [...prev, destinationIndex]);
        
        // Remove this destination from remaining destinations
        const updatedDestinations = currentAvailableDestinations ? 
          currentAvailableDestinations.filter(dest => 
            !(dest.lat === destination.lat && dest.lng === destination.lng)
          ) : 
          remainingDestinations.filter(dest => 
            !(dest.lat === destination.lat && dest.lng === destination.lng)
          );
        
        setRemainingDestinations(updatedDestinations);
        
        // Update progress
        const completedDestinations = visitedDestinations.length + 1;
        const progress = (completedDestinations / destinations.length) * 100;
        setSimulationProgress(progress);
        setCurrentDestinationIndex(completedDestinations - 1);

        if (vehicleMarkerRef.current) {
          console.log('Updating vehicle marker at destination');
          vehicleMarkerRef.current.bindPopup(`✅ Reached destination! ${updatedDestinations.length} destinations remaining.`).openPopup();
          
          // Ensure the marker stays visible by updating its position explicitly
          vehicleMarkerRef.current.setLatLng(reachedPosition);
          
          // Make sure the marker is still on the map
          if (mapInstanceRef.current && !mapInstanceRef.current.hasLayer(vehicleMarkerRef.current)) {
            console.log('Re-adding vehicle marker to map');
            vehicleMarkerRef.current.addTo(mapInstanceRef.current);
          }
        } else {
          console.log('Vehicle marker is null when reaching destination');
        }

        // Check if journey is complete
        if (updatedDestinations.length === 0) {
          setIsSimulating(false);
          setSimulationProgress(100);
          if (vehicleMarkerRef.current) {
            vehicleMarkerRef.current.bindPopup('🎉 Journey Complete! All destinations reached.').openPopup();
          }
        } else {
          // Pause for manual resume - keep simulation active but paused
          setIsPaused(true);
          // Don't set isSimulating to false - keep it true so marker stays
        }
        
        return;
      }

      const routeIndex = Math.floor(currentStep / 8);
      const stepProgress = (currentStep % 8) / 8;
      
      if (routeIndex < route.length - 1) {
        const start = route[routeIndex];
        const end = route[routeIndex + 1];
        
        const lat = start[0] + (end[0] - start[0]) * stepProgress;
        const lng = start[1] + (end[1] - start[1]) * stepProgress;
        
        if (vehicleMarkerRef.current) {
          vehicleMarkerRef.current.setLatLng([lat, lng]);
        }
        
        // Update progress for this leg
        const legProgress = (currentStep / totalSteps);
        const completedDestinations = visitedDestinations.length;
        const overallProgress = ((completedDestinations + legProgress) / destinations.length) * 100;
        setSimulationProgress(overallProgress);
      }

      currentStep++;
      setTimeout(animate, 120 - (vehicle.speed * 2)); // Speed affects animation
    };

    animate();
  }, [selectedVehicle, destinations, visitedDestinations, remainingDestinations, startNextLegWithDestinations]);

  // Original animate vehicle function (keeping as fallback)
  const animateVehicle = useCallback((route: [number, number][]) => {
    if (!mapInstanceRef.current) return;

    const vehicle = VEHICLE_TYPES[selectedVehicle];
    const totalSteps = route.length * 10;
    let currentStep = 0;

    // Create vehicle marker
    const L = (window as any).L;
    const vehicleIcon = L.divIcon({
      html: `<div style="
        background: ${vehicle.color}; 
        color: white; 
        border-radius: 50%; 
        width: 30px; 
        height: 30px; 
        display: flex; 
        align-items: center; 
        justify-content: center; 
        font-size: 16px;
        border: 2px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${vehicle.icon}</div>`,
      iconSize: [30, 30],
      className: 'vehicle-marker'
    });

    vehicleMarkerRef.current = L.marker(route[0], { icon: vehicleIcon })
      .addTo(mapInstanceRef.current)
      .bindPopup(`${vehicle.name} - Speed: ${vehicle.speed} km/h`);

    const animate = () => {
      if (currentStep >= totalSteps) {
        setIsSimulating(false);
        setSimulationProgress(100);
        if (vehicleMarkerRef.current) {
          vehicleMarkerRef.current.bindPopup('🎉 Journey Complete! All destinations reached.').openPopup();
        }
        return;
      }

      const routeIndex = Math.floor(currentStep / 10);
      const stepProgress = (currentStep % 10) / 10;
      
      if (routeIndex < route.length - 1) {
        const start = route[routeIndex];
        const end = route[routeIndex + 1];
        
        const lat = start[0] + (end[0] - start[0]) * stepProgress;
        const lng = start[1] + (end[1] - start[1]) * stepProgress;
        
        if (vehicleMarkerRef.current) {
          vehicleMarkerRef.current.setLatLng([lat, lng]);
        }
        
        // Update progress
        const progress = (currentStep / totalSteps) * 100;
        setSimulationProgress(progress);
        
        // Update current destination index based on progress
        const newDestIndex = Math.floor((progress / 100) * destinations.length);
        if (newDestIndex !== currentDestinationIndex && newDestIndex < destinations.length) {
          setCurrentDestinationIndex(newDestIndex);
        }
      }

      currentStep++;
      setTimeout(animate, 100 - (vehicle.speed * 2)); // Speed affects animation
    };

    animate();
  }, [selectedVehicle, destinations, currentDestinationIndex]);

  // Stop simulation
  const stopSimulation = useCallback(() => {
    setIsSimulating(false);
    setSimulationProgress(0);
    setCurrentDestinationIndex(0);
    setCurrentPosition(null);
    setVisitedDestinations([]);
    setIsPaused(false);
    setRemainingDestinations([]);
    
    // Clear route layers
    routeLayersRef.current.forEach(layer => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });
    routeLayersRef.current = [];

    // Remove vehicle marker
    if (vehicleMarkerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(vehicleMarkerRef.current);
      vehicleMarkerRef.current = null;
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 animate-slide-in">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🚀 Smart Transport Simulation
          </h1>
          <p className="text-gray-600">
            Select up to 5 destinations and experience realistic multi-stop vehicle movement
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Control Panel */}
          <div className="lg:col-span-1 space-y-4">
            {/* Vehicle Selection */}
            <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">🚗 Vehicle Selection</h3>
              <div className="space-y-3">
                {Object.entries(VEHICLE_TYPES).map(([key, vehicle]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedVehicle(key as keyof typeof VEHICLE_TYPES)}
                    disabled={isSimulating}
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all duration-300 ${
                      selectedVehicle === key
                        ? 'border-blue-500 bg-blue-50 shadow-md transform scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                    } ${isSimulating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-lg">{vehicle.icon}</span>
                          <span className="font-medium">{vehicle.name}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          Speed: {vehicle.speed} km/h • Capacity: {vehicle.capacity}
                        </div>
                      </div>
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                        style={{ backgroundColor: vehicle.color }}
                      ></div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Destinations List */}
            {destinations.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-gray-800">🎯 Destinations ({destinations.length}/5)</h3>
                  {!isSimulating && !isPaused && (
                    <button
                      onClick={clearAllDestinations}
                      className="text-red-500 hover:text-red-700 text-sm font-medium"
                    >
                      Clear All
                    </button>
                  )}
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {destinations.map((dest, index) => (
                    <div key={index} className={`flex items-center justify-between p-2 rounded-lg ${
                      visitedDestinations.includes(index) ? 'bg-green-100 border border-green-300' :
                      index === currentDestinationIndex && isSimulating ? 'bg-blue-100 border border-blue-300' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          visitedDestinations.includes(index) ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                        }`}>
                          {visitedDestinations.includes(index) ? '✓' : index + 1}
                        </span>
                        <span className="text-sm text-gray-700">
                          {dest.name || `${dest.lat.toFixed(4)}, ${dest.lng.toFixed(4)}`}
                        </span>
                      </div>
                      {!isSimulating && !isPaused && (
                        <button
                          onClick={() => removeDestination(index)}
                          className="text-red-500 hover:text-red-700 text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simulation Controls */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-semibold mb-4 text-gray-800">🎮 Controls</h3>
              <div className="space-y-3">
                {!isSimulating && !isPaused && (
                  <button
                    onClick={startSimulation}
                    disabled={!userLocation || destinations.length === 0 || isLoadingRoute}
                    className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-medium hover:from-green-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105"
                  >
                    {isLoadingRoute ? '🔄 Loading Route...' : '▶️ Start Smart Journey'}
                  </button>
                )}
                
                {isPaused && (
                  <button
                    onClick={resumeJourney}
                    className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-300 transform hover:scale-105"
                  >
                    🚀 Resume Journey ({remainingDestinations.length} destinations left)
                  </button>
                )}
                
                <button
                  onClick={stopSimulation}
                  disabled={!isSimulating && !isPaused}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-lg font-medium hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                >
                  ⏹️ Stop & Reset Journey
                </button>
              </div>

              {!userLocation && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-700">
                    📍 Allow location access for better experience
                  </p>
                </div>
              )}

              {userLocation && destinations.length === 0 && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-700">
                    🎯 Click on the map to add destinations (up to 5)
                  </p>
                </div>
              )}

              {destinations.length >= 5 && (
                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-700">
                    ⚠️ Maximum 5 destinations reached
                  </p>
                </div>
              )}

              {isPaused && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-700 font-medium">
                    ✅ Destination reached! Vehicle is waiting at current location.
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    Click "Resume Journey" to continue to the next closest destination
                  </p>
                </div>
              )}
            </div>

            {/* Simulation Stats */}
            {(isSimulating || isPaused || simulationProgress > 0) && (
              <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">📊 Journey Progress</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Distance:</span>
                    <span className="font-medium">{simulationStats.distance} km</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Total Duration:</span>
                    <span className="font-medium">{simulationStats.duration} min</span>
                  </div>
                  
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Vehicle Speed:</span>
                    <span className="font-medium">{simulationStats.avgSpeed} km/h</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Destinations Visited:</span>
                    <span className="font-medium">{visitedDestinations.length} of {destinations.length}</span>
                  </div>

                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Remaining:</span>
                    <span className="font-medium">{remainingDestinations.length} destinations</span>
                  </div>

                  {currentPosition && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Current Position:</span>
                      <span className="font-medium text-xs">
                        {currentPosition[0].toFixed(4)}, {currentPosition[1].toFixed(4)}
                      </span>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-gray-600">Overall Progress:</span>
                      <span className="font-medium">{Math.round(simulationProgress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${simulationProgress}%` }}
                      ></div>
                    </div>
                  </div>

                  {isPaused && (
                    <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700 font-medium">
                        🎯 Journey paused at destination {visitedDestinations.length + 1}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Next: Going to closest remaining destination
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Nearby Places */}
            {nearbyPlaces.length > 0 && (
              <div className="bg-white rounded-xl shadow-lg p-6 animate-fade-in">
                <h3 className="text-lg font-semibold mb-4 text-gray-800">📍 Nearby Transport</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {nearbyPlaces.slice(0, 5).map((place, index) => (
                    <div key={index} className="p-2 bg-gray-50 rounded-lg">
                      <div className="text-sm font-medium text-gray-800">
                        {place.properties.name || 'Transport Hub'}
                      </div>
                      <div className="text-xs text-gray-500">
                        {place.properties.categories?.[0] || 'Transport'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Map Container */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden animate-slide-in">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <h2 className="text-xl font-semibold">🗺️ Interactive Route Map</h2>
                <p className="text-blue-100 text-sm">
                  Powered by Geoapify • Click to add destinations (max 5)
                </p>
              </div>
              
              <LeafletMap
                ref={mapRef}
                onMapReady={handleMapReady}
                onMapClick={handleMapClick}
              />
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .animate-fade-in { animation: fadeIn 0.8s ease-out; }
        .animate-slide-in { animation: slideIn 0.6s ease-out; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
