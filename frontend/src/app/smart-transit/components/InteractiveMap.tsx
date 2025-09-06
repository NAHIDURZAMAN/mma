'use client';

import React, { useEffect, useRef, useState } from 'react';

interface Stop {
  name: string;
  lat: number;
  lng: number;
}

interface Route {
  id: string;
  name: string;
  stops: Stop[];
  distance: number;
  avgTime: number;
}

interface Vehicle {
  name: string;
  icon: string;
  color: string;
  speed: number;
  capacity: number;
  efficiency: number;
  costPerKm: number;
}

interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  currentRoute: string;
  vehicleType: string;
  currentStop: number;
  progress: number;
  passengers: number;
  totalDistance: number;
  elapsedTime: number;
  speed: number;
  efficiency: number;
}

interface RealTimeData {
  currentPosition: { lat: number; lng: number };
  heading: number;
  nextStop: string;
  eta: string;
}

interface Props {
  route?: Route;
  vehicle: Vehicle;
  simulation: SimulationState;
  realTimeData: RealTimeData;
}

export default function InteractiveMap({ route, vehicle, simulation, realTimeData }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const stopMarkersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Load Leaflet dynamically
    import('leaflet').then((L) => {
      // Fix for default markers
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      });

      const map = L.map(mapRef.current!, {
        center: [23.7368, 90.3951], // Dhaka center
        zoom: 12,
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

      mapInstanceRef.current = map;
      setMapLoaded(true);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapLoaded(false);
      }
    };
  }, []);

  // Update route and stops
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !route) return;

    import('leaflet').then((L) => {
      const map = mapInstanceRef.current;

      // Clear existing route and stops
      if (routeLayerRef.current) {
        map.removeLayer(routeLayerRef.current);
      }
      stopMarkersRef.current.forEach(marker => map.removeLayer(marker));
      stopMarkersRef.current = [];

      // Add route polyline
      const routeCoords = route.stops.map(stop => [stop.lat, stop.lng] as [number, number]);
      const polyline = L.polyline(routeCoords, {
        color: vehicle.color,
        weight: 4,
        opacity: 0.8,
        dashArray: simulation.isRunning ? undefined : '10, 10'
      }).addTo(map);
      
      routeLayerRef.current = polyline;

      // Add stop markers
      route.stops.forEach((stop, index) => {
        const isCurrentStop = simulation.currentStop === index && simulation.isRunning;
        const isCompletedStop = simulation.currentStop > index && simulation.isRunning;
        
        const stopIcon = L.divIcon({
          html: `
            <div style="
              background: ${isCompletedStop ? '#10B981' : isCurrentStop ? '#F59E0B' : vehicle.color}; 
              color: white; 
              border-radius: 50%; 
              width: 24px; 
              height: 24px; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
              font-size: 12px; 
              font-weight: bold; 
              border: 3px solid white;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">
              ${isCompletedStop ? '✓' : index + 1}
            </div>
          `,
          iconSize: [24, 24],
          className: 'stop-marker'
        });

        const marker = L.marker([stop.lat, stop.lng], { icon: stopIcon })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; min-width: 150px;">
              <h3 style="margin: 0 0 8px 0; color: ${vehicle.color};">${stop.name}</h3>
              <p style="margin: 0; font-size: 12px; color: #666;">
                Stop ${index + 1} of ${route.stops.length}
              </p>
              ${isCurrentStop ? '<p style="margin: 4px 0 0 0; font-size: 11px; color: #F59E0B; font-weight: bold;">🚌 Vehicle Here</p>' : ''}
              ${isCompletedStop ? '<p style="margin: 4px 0 0 0; font-size: 11px; color: #10B981; font-weight: bold;">✅ Completed</p>' : ''}
            </div>
          `);

        stopMarkersRef.current.push(marker);
      });

      // Fit map to route bounds
      map.fitBounds(polyline.getBounds(), { padding: [20, 20] });
    });
  }, [mapLoaded, route, vehicle, simulation.currentStop, simulation.isRunning]);

  // Update vehicle position
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !simulation.isRunning) {
      // Remove vehicle marker if simulation is stopped
      if (vehicleMarkerRef.current) {
        mapInstanceRef.current.removeLayer(vehicleMarkerRef.current);
        vehicleMarkerRef.current = null;
      }
      return;
    }

    import('leaflet').then((L) => {
      const map = mapInstanceRef.current;
      const { lat, lng } = realTimeData.currentPosition;

      const vehicleIcon = L.divIcon({
        html: `
          <div style="
            background: ${vehicle.color}; 
            color: white; 
            border-radius: 50%; 
            width: 32px; 
            height: 32px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            font-size: 18px;
            border: 3px solid white;
            box-shadow: 0 3px 8px rgba(0,0,0,0.4);
            transform: rotate(${realTimeData.heading}deg);
            z-index: 1000;
          ">
            ${vehicle.icon}
          </div>
        `,
        iconSize: [32, 32],
        className: 'vehicle-marker'
      });

      if (vehicleMarkerRef.current) {
        vehicleMarkerRef.current.setLatLng([lat, lng]);
        vehicleMarkerRef.current.setIcon(vehicleIcon);
      } else {
        vehicleMarkerRef.current = L.marker([lat, lng], { icon: vehicleIcon })
          .addTo(map)
          .bindPopup(`
            <div style="text-align: center; min-width: 200px;">
              <h3 style="margin: 0 0 8px 0; color: ${vehicle.color};">${vehicle.name}</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px;">
                <div>
                  <strong>Speed:</strong><br>${simulation.speed} km/h
                </div>
                <div>
                  <strong>Passengers:</strong><br>${Math.max(0, Math.min(simulation.passengers, vehicle.capacity))}/${vehicle.capacity}
                </div>
                <div>
                  <strong>Progress:</strong><br>${Math.round(simulation.progress)}%
                </div>
                <div>
                  <strong>ETA:</strong><br>${realTimeData.eta}
                </div>
              </div>
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #eee;">
                <strong style="color: ${vehicle.color};">Next Stop:</strong> ${realTimeData.nextStop}
              </div>
            </div>
          `);
      }
    });
  }, [mapLoaded, simulation, realTimeData, vehicle]);

  return (
    <div className="relative w-full h-[500px] rounded-lg overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      
      {!mapLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin text-4xl mb-4">🗺️</div>
            <p className="text-gray-600 font-medium">Loading Interactive Map...</p>
          </div>
        </div>
      )}

      {/* Map Controls Overlay */}
      {mapLoaded && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg">
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>Route Path</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span>Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <span>Current Stop</span>
            </div>
            {simulation.isRunning && (
              <div className="flex items-center gap-2 pt-1 border-t">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
                <span className="font-medium text-red-600">LIVE</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Route Info Overlay */}
      {route && (
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg max-w-xs">
          <h4 className="font-semibold text-gray-800 mb-1">{route.name}</h4>
          <div className="text-sm text-gray-600 space-y-1">
            <div>📍 {route.stops.length} stops</div>
            <div>📏 {route.distance} km total</div>
            <div>⏱️ ~{route.avgTime} minutes</div>
            {simulation.isRunning && (
              <div className="pt-2 border-t text-xs">
                <div className="text-blue-600 font-medium">
                  Progress: {simulation.totalDistance.toFixed(1)} km ({Math.round(simulation.progress)}%)
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        /* Import Leaflet CSS */
        @import url('https://unpkg.com/leaflet@1.7.1/dist/leaflet.css');
        
        .vehicle-marker {
          z-index: 1000 !important;
        }
        
        .stop-marker {
          z-index: 500 !important;
        }
      `}</style>
    </div>
  );
}
