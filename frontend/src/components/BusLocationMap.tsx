'use client'

import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Fix for default markers in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

interface BusLocationMapProps {
  latitude: number
  longitude: number
  locationName: string
}

export default function BusLocationMap({ latitude, longitude, locationName }: BusLocationMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map only once
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current).setView([latitude, longitude], 15)

      // Add tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current)

      // Create custom bus icon
      const busIcon = L.divIcon({
        className: 'custom-bus-marker',
        html: `
          <div style="
            background-color: #2563eb;
            color: white;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            font-size: 16px;
          ">
            🚌
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      })

      // Add initial marker
      markerRef.current = L.marker([latitude, longitude], { icon: busIcon })
        .addTo(mapInstanceRef.current)
        .bindPopup(`
          <div style="text-align: center; padding: 5px;">
            <strong>Smart Transit Bus</strong><br>
            📍 ${locationName}<br>
            <small>Live Location</small>
          </div>
        `)
        .openPopup()
    }

    // Update marker position when coordinates change
    if (mapInstanceRef.current && markerRef.current) {
      const newLatLng = L.latLng(latitude, longitude)
      
      // Smooth animation to new position
      markerRef.current.setLatLng(newLatLng)
      mapInstanceRef.current.panTo(newLatLng)
      
      // Update popup content
      markerRef.current.bindPopup(`
        <div style="text-align: center; padding: 5px;">
          <strong>Smart Transit Bus</strong><br>
          📍 ${locationName}<br>
          <small>Last updated: ${new Date().toLocaleTimeString()}</small>
        </div>
      `)
    }

    // Cleanup function
    return () => {
      // Don't destroy map on coordinate updates, only on component unmount
    }
  }, [latitude, longitude, locationName])

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full rounded-lg overflow-hidden" />
      
      {/* Live indicator */}
      <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 shadow-lg">
        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        LIVE
      </div>
      
      {/* Location info overlay */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg max-w-xs">
        <div className="text-sm font-semibold text-gray-800">{locationName}</div>
        <div className="text-xs text-gray-600">
          {latitude.toFixed(6)}, {longitude.toFixed(6)}
        </div>
      </div>
    </div>
  )
}