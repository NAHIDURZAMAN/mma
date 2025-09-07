// Reverse Geocoding Service
import dotenv from 'dotenv'

dotenv.config()

const GEOAPIFY_API_KEY = process.env.GEOAPIFY_API_KEY || '7fa23b5a9b194102a9be9a11ce64a57c'

/**
 * Convert address to coordinates using forward geocoding
 * @param {string} address - Address to geocode
 * @returns {Promise<{lat: number, lng: number, address: string}>} - Coordinates and formatted address
 */
export async function forwardGeocode(address) {
  try {
    const encodedAddress = encodeURIComponent(address)
    const response = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodedAddress}&apiKey=${GEOAPIFY_API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const coordinates = feature.geometry.coordinates
      const properties = feature.properties
      
      return {
        lat: coordinates[1],
        lng: coordinates[0],
        address: properties.formatted || address
      }
    }
    
    throw new Error('No results found for address')
    
  } catch (error) {
    console.error('Forward geocoding error:', error)
    throw error
  }
}

/**
 * Convert coordinates to human-readable address using reverse geocoding
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {Promise<string>} - Formatted address
 */
export async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${GEOAPIFY_API_KEY}`
    )
    
    if (!response.ok) {
      throw new Error(`Geocoding API error: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.features && data.features.length > 0) {
      const feature = data.features[0]
      const properties = feature.properties
      
      // Build address from components
      const addressParts = []
      
      if (properties.name) addressParts.push(properties.name)
      if (properties.street) addressParts.push(properties.street)
      if (properties.district) addressParts.push(properties.district)
      if (properties.city) addressParts.push(properties.city)
      if (properties.state) addressParts.push(properties.state)
      
      // If we have a formatted address, use it
      if (properties.formatted) {
        return properties.formatted
      }
      
      // Otherwise build from parts
      if (addressParts.length > 0) {
        return addressParts.join(', ')
      }
      
      // Fallback to suburb/neighbourhood + city
      if (properties.suburb && properties.city) {
        return `${properties.suburb}, ${properties.city}`
      }
      
      // Last resort - just city or state
      if (properties.city) {
        return properties.city
      }
      
      if (properties.state) {
        return properties.state
      }
    }
    
    // Fallback if no results
    return `Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`
    
  } catch (error) {
    console.error('Reverse geocoding error:', error)
    return `Location ${lat.toFixed(4)}, ${lng.toFixed(4)}`
  }
}

/**
 * Get current location using browser geolocation API (for client-side)
 * @returns {Promise<{lat: number, lng: number, address: string}>}
 */
export function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by this browser'))
      return
    }
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        
        try {
          const address = await reverseGeocode(lat, lng)
          resolve({ lat, lng, address })
        } catch (error) {
          resolve({ 
            lat, 
            lng, 
            address: `Current Location ${lat.toFixed(4)}, ${lng.toFixed(4)}` 
          })
        }
      },
      (error) => {
        reject(error)
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000 // 5 minutes
      }
    )
  })
}

/**
 * Calculate distance between two coordinates
 * @param {number} lat1 
 * @param {number} lng1 
 * @param {number} lat2 
 * @param {number} lng2 
 * @returns {number} Distance in kilometers
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371 // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180)
  const dLng = (lng2 - lng1) * (Math.PI / 180)
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Format journey time in a human-readable format
 * @param {number} minutes 
 * @returns {string}
 */
export function formatJourneyTime(minutes) {
  if (minutes < 60) {
    return `${Math.round(minutes)} minutes`
  } else {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = Math.round(minutes % 60)
    if (remainingMinutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`
    }
    return `${hours} hour${hours > 1 ? 's' : ''} ${remainingMinutes} minutes`
  }
}

export default {
  forwardGeocode,
  reverseGeocode,
  getCurrentLocation,
  calculateDistance,
  formatJourneyTime
}
