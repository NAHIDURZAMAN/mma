'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Vehicle types colors
const VEHICLE_COLORS = {
  bus: '#10B981',
  express: '#F59E0B', 
  metro: '#3B82F6',
  tram: '#8B5CF6'
};

// Vehicle icons
const VEHICLE_ICONS = {
  bus: '🚌',
  express: '🚐',
  metro: '🚇',
  tram: '🚋'
};

interface Destination {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

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

const InteractiveMap: React.FC<InteractiveMapProps> = ({
  userLocation,
  destinations,
  currentPosition,
  vehicleType,
  isSimulationRunning,
  onDestinationSelect,
  routeData,
  currentDestinationIndex,
  onVehiclePositionUpdate,
  simulationProgress = 0,
  isWaitingAtStation = false,
  onDestinationReached
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const vehicleMarkerRef = useRef<L.Marker | null>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const animationRef = useRef<number | null>(null);
  const routeCoordsRef = useRef<[number, number][]>([]);
  const animationProgressRef = useRef(0);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Initialize map
    const map = L.map(mapContainerRef.current, {
      center: userLocation || [23.8103, 90.4125], // Default to Dhaka
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      dragging: true
    });

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Handle map click events separately to avoid reinitializing the map
  useEffect(() => {
    if (!mapRef.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      console.log('Map clicked:', e.latlng, 'Simulation running:', isSimulationRunning, 'Destinations count:', destinations.length);
      if (!isSimulationRunning && destinations.length < 5) {
        const destination: Destination = {
          lat: e.latlng.lat,
          lng: e.latlng.lng,
          name: `Destination ${destinations.length + 1}`
        };
        console.log('Adding destination:', destination);
        onDestinationSelect(destination);
      }
    };

    mapRef.current.off('click', handleMapClick);
    mapRef.current.on('click', handleMapClick);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('click', handleMapClick);
      }
    };
  }, [isSimulationRunning, destinations.length, onDestinationSelect]);

  // Update map center when user location changes
  useEffect(() => {
    if (mapRef.current && userLocation) {
      mapRef.current.setView(userLocation, 13);
    }
  }, [userLocation]);

  // Add user location marker
  useEffect(() => {
    if (!mapRef.current || !userLocation) return;

    const userIcon = L.divIcon({
      html: '<div style="background: #3B82F6; border: 3px solid white; border-radius: 50%; width: 20px; height: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
      iconSize: [20, 20],
      className: 'user-location-marker'
    });

    const userMarker = L.marker(userLocation, { icon: userIcon })
      .addTo(mapRef.current)
      .bindPopup('📍 Your Location');

    return () => {
      if (mapRef.current) {
        mapRef.current.removeLayer(userMarker);
      }
    };
  }, [userLocation]);

  // Add destination markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Clear existing destination markers
    markersRef.current.forEach(marker => {
      if (mapRef.current) {
        mapRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];

    // Add new destination markers
    destinations.forEach((dest, index) => {
      const isCompleted = currentDestinationIndex > index;
      const isCurrent = currentDestinationIndex === index && isSimulationRunning;
      
      let markerColor = '#EF4444'; // Default red
      let markerText = (index + 1).toString();
      
      if (isCompleted) {
        markerColor = '#10B981'; // Green for completed
        markerText = '✓';
      } else if (isCurrent) {
        markerColor = '#F59E0B'; // Orange for current
      }

      const destIcon = L.divIcon({
        html: `<div style="
          background: ${markerColor}; 
          color: white; 
          border-radius: 50%; 
          width: 25px; 
          height: 25px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          font-size: 12px; 
          font-weight: bold; 
          border: 2px solid white; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${markerText}</div>`,
        iconSize: [25, 25],
        className: 'destination-marker'
      });

      const marker = L.marker([dest.lat, dest.lng], { icon: destIcon })
        .addTo(mapRef.current!)
        .bindPopup(`🎯 ${dest.name || dest.address || `Destination ${index + 1}`}`);

      markersRef.current.push(marker);
    });
  }, [destinations, currentDestinationIndex, isSimulationRunning]);

  // Add/update vehicle marker
  useEffect(() => {
    if (!mapRef.current || !currentPosition) return;

    const vehicleColor = VEHICLE_COLORS[vehicleType];
    const vehicleIcon = VEHICLE_ICONS[vehicleType];

    const vehicleMarkerIcon = L.divIcon({
      html: `<div style="
        background: ${vehicleColor}; 
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
        ${isSimulationRunning ? 'animation: pulse 2s infinite;' : ''}
        transition: all 0.3s ease;
      ">${vehicleIcon}</div>`,
      iconSize: [30, 30],
      className: 'vehicle-marker'
    });

    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      vehicleMarkerRef.current.setIcon(vehicleMarkerIcon);
    } else {
      vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleMarkerIcon })
        .addTo(mapRef.current)
        .bindPopup(`${vehicleIcon} Vehicle ${isSimulationRunning ? '(Moving)' : '(Stopped)'}`);
    }

    // Update popup text based on simulation state
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.bindPopup(`${vehicleIcon} Vehicle ${isSimulationRunning ? '(Moving)' : '(Stopped)'}`);
    }
  }, [currentPosition, vehicleType, isSimulationRunning]);

  // Vehicle animation along route
  useEffect(() => {
    if (!isSimulationRunning || !routeCoordsRef.current.length || !vehicleMarkerRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      // Reset vehicle to original position when simulation stops
      if (!isSimulationRunning && vehicleMarkerRef.current && userLocation) {
        vehicleMarkerRef.current.setLatLng(userLocation);
        if (onVehiclePositionUpdate) {
          onVehiclePositionUpdate(userLocation);
        }
        
        // Reset vehicle icon to non-animated state
        const vehicleColor = VEHICLE_COLORS[vehicleType];
        const vehicleIcon = VEHICLE_ICONS[vehicleType];
        
        const resetIcon = L.divIcon({
          html: `<div style="
            background: ${vehicleColor}; 
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
            transition: all 0.3s ease;
          ">${vehicleIcon}</div>`,
          iconSize: [30, 30],
          className: 'vehicle-marker'
        });
        
        vehicleMarkerRef.current.setIcon(resetIcon);
      }
      
      return;
    }

    const animateVehicle = () => {
      const route = routeCoordsRef.current;
      if (!route.length || !vehicleMarkerRef.current) return;

      // Use simulation progress from parent component (0-100)
      const progress = Math.min(simulationProgress, 100) / 100;
      
      if (progress >= 1) {
        // Animation complete - reached destination
        const lastPosition = route[route.length - 1];
        if (lastPosition) {
          vehicleMarkerRef.current.setLatLng(lastPosition);
          if (onVehiclePositionUpdate) {
            onVehiclePositionUpdate(lastPosition);
          }
        }
        
        // Don't trigger callback if already waiting
        if (!isWaitingAtStation && onDestinationReached) {
          onDestinationReached();
        }
        return;
      }

      // Don't animate if waiting at station
      if (isWaitingAtStation) {
        return;
      }

      // Calculate the actual position along the route based on progress
      // This ensures the vehicle position matches the progress bar exactly
      const totalRouteLength = route.length - 1;
      const targetIndex = progress * totalRouteLength;
      const currentSegment = Math.floor(targetIndex);
      const segmentProgress = targetIndex - currentSegment;

      // Ensure we don't go beyond the route bounds
      const safeCurrentSegment = Math.min(currentSegment, route.length - 2);
      const safeSegmentProgress = Math.max(0, Math.min(1, segmentProgress));

      if (safeCurrentSegment >= 0 && safeCurrentSegment < route.length - 1) {
        const start = route[safeCurrentSegment];
        const end = route[safeCurrentSegment + 1];

        if (start && end) {
          // Linear interpolation between route points
          const lat = start[0] + (end[0] - start[0]) * safeSegmentProgress;
          const lng = start[1] + (end[1] - start[1]) * safeSegmentProgress;
          
          const newPosition: [number, number] = [lat, lng];
          vehicleMarkerRef.current.setLatLng(newPosition);
          
          // Notify parent of position update
          if (onVehiclePositionUpdate) {
            onVehiclePositionUpdate(newPosition);
          }
          
          // Calculate heading for rotation (direction of movement)
          const deltaLat = end[0] - start[0];
          const deltaLng = end[1] - start[1];
          const heading = Math.atan2(deltaLng, deltaLat) * 180 / Math.PI;
          
          // Update vehicle icon with rotation and animation
          const vehicleColor = VEHICLE_COLORS[vehicleType];
          const vehicleIcon = VEHICLE_ICONS[vehicleType];
          
          const rotatedIcon = L.divIcon({
            html: `<div style="
              background: ${vehicleColor}; 
              color: white; 
              border-radius: 50%; 
              width: 30px; 
              height: 30px; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 16px;
              border: 2px solid white;
              box-shadow: 0 4px 8px rgba(0,0,0,0.3);
              transform: rotate(${heading + 90}deg);
              transition: all 0.2s ease;
              animation: vehicleMove 1s infinite ease-in-out;
            ">${vehicleIcon}</div>`,
            iconSize: [30, 30],
            className: 'vehicle-marker moving'
          });
          
          vehicleMarkerRef.current.setIcon(rotatedIcon);
        }
      }

      // Continue animation
      animationRef.current = requestAnimationFrame(animateVehicle);
    };

    animateVehicle();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [isSimulationRunning, vehicleType, simulationProgress, onVehiclePositionUpdate, userLocation, isWaitingAtStation, onDestinationReached]);

  // Helper function to calculate distance between two points
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLng = (lng2 - lng1) * (Math.PI / 180);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  // Add route line
  useEffect(() => {
    if (!mapRef.current || !routeData || !routeData.features || routeData.features.length === 0) {
      // Clear existing route
      if (routeLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(routeLayerRef.current);
        routeLayerRef.current = null;
      }
      routeCoordsRef.current = [];
      animationProgressRef.current = 0;
      return;
    }

    // Clear existing route
    if (routeLayerRef.current && mapRef.current) {
      mapRef.current.removeLayer(routeLayerRef.current);
    }

    try {
      const routeGeometry = routeData.features[0].geometry.coordinates[0];
      const routeCoords: [number, number][] = routeGeometry.map((coord: number[]) => [coord[1], coord[0]]);
      
      // Store route coordinates for animation
      routeCoordsRef.current = routeCoords;
      animationProgressRef.current = 0;

      routeLayerRef.current = L.polyline(routeCoords, {
        color: VEHICLE_COLORS[vehicleType],
        weight: 4,
        opacity: 0.7,
        dashArray: isSimulationRunning ? '0' : '10, 5' // Solid line when simulation is running
      }).addTo(mapRef.current);

      // Fit map to show the route
      mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [20, 20] });
    } catch (error) {
      console.error('Error displaying route:', error);
    }
  }, [routeData, vehicleType, isSimulationRunning]);

  return (
    <div className="relative">
      <div 
        ref={mapContainerRef}
        className="w-full h-[600px] relative rounded-lg overflow-hidden"
        style={{ background: '#f8fafc' }}
      >
        {!mapRef.current && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin text-4xl mb-4">🗺️</div>
              <p className="text-gray-600">Loading interactive map...</p>
            </div>
          </div>
        )}
      </div>
      
      {/* Map Instructions */}
      {!isSimulationRunning && destinations.length < 5 && (
        <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs border-2 border-blue-200">
          <p className="text-sm font-medium text-blue-800 mb-1">🗺️ Add Destinations</p>
          <p className="text-xs text-blue-600">
            • 📍 Blue dot: Your current location<br/>
            • 🎯 Click anywhere on the map to add destinations<br/>
            • ➕ You can add up to 5 destinations<br/>
            • 🚌 Vehicle will follow optimal route when started
          </p>
          <div className="mt-2 text-xs bg-blue-50 p-2 rounded">
            <strong>Destinations: {destinations.length}/5</strong>
          </div>
        </div>
      )}

      {isSimulationRunning && isWaitingAtStation && (
        <div className="absolute top-4 left-4 bg-yellow-500/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs text-white animate-pulse">
          <p className="text-sm font-medium mb-1">� Station Reached</p>
          <p className="text-xs">
            Arrived at destination {currentDestinationIndex + 1}.<br/>
            Waiting for permission to continue...
          </p>
        </div>
      )}

      {isSimulationRunning && !isWaitingAtStation && (
        <div className="absolute top-4 left-4 bg-green-500/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs text-white">
          <p className="text-sm font-medium mb-1">🚌 En Route</p>
          <p className="text-xs">
            Moving to destination {currentDestinationIndex + 1} of {destinations.length}
          </p>
        </div>
      )}

      {/* Route Info */}
      {routeData && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg">
          <p className="text-sm font-medium text-gray-800 mb-1">📊 Route Info</p>
          <p className="text-xs text-gray-600">
            Distance: {routeData.features?.[0]?.properties?.distance ? 
              (routeData.features[0].properties.distance / 1000).toFixed(1) + ' km' : 'Calculating...'}<br/>
            Duration: {routeData.features?.[0]?.properties?.time ? 
              Math.round(routeData.features[0].properties.time / 60) + ' min' : 'Calculating...'}
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        @keyframes vehicleMove {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-2px) scale(1.05); }
        }
        .vehicle-marker.moving {
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.3));
        }
        .leaflet-marker-icon {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        }
      `}</style>
    </div>
  );
};

export default InteractiveMap;
