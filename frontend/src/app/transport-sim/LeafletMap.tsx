'use client';

import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface LeafletMapHandle {
  getMap: () => L.Map | null;
}

interface LeafletMapProps {
  onMapReady: (map: L.Map) => void;
  onMapClick: (e: L.LeafletMouseEvent) => void;
}

const LeafletMap = forwardRef<LeafletMapHandle, LeafletMapProps>(
  ({ onMapReady, onMapClick }, ref) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<L.Map | null>(null);

    useImperativeHandle(ref, () => ({
      getMap: () => mapRef.current,
    }));

    useEffect(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [23.8103, 90.4125], // Dhaka, Bangladesh
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true,
        doubleClickZoom: true,
        dragging: true
      });

      // Add tile layer with better styling
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;

      // Handle map clicks
      map.on('click', onMapClick);

      // Notify parent that map is ready
      onMapReady(map);

      return () => {
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      };
    }, [onMapReady, onMapClick]);

    return (
      <div 
        ref={mapContainerRef}
        className="w-full h-96 lg:h-[600px] relative"
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
    );
  }
);

LeafletMap.displayName = 'LeafletMap';

export default LeafletMap;
