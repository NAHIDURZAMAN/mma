// Geopify API service for maps and geocoding
export class GeopifyService {
  private apiKey: string;
  private baseUrl = 'https://api.geoapify.com/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Calculate distance between two points using Haversine formula
  calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLng = this.toRadians(lng2 - lng1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in kilometers
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Get route between two points
  async getRoute(start: {lat: number, lng: number}, end: {lat: number, lng: number}) {
    try {
      const response = await fetch(
        `${this.baseUrl}/routing?waypoints=${start.lat},${start.lng}|${end.lat},${end.lng}&mode=transit&apiKey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`Geopify API error: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Route calculation failed:', error);
      // Fallback to straight line calculation
      return {
        features: [{
          properties: {
            distance: this.calculateDistance(start.lat, start.lng, end.lat, end.lng) * 1000, // Convert to meters
            time: this.calculateDistance(start.lat, start.lng, end.lat, end.lng) * 3.6 * 60 // Estimate 3.6 minutes per km
          },
          geometry: {
            coordinates: [[start.lng, start.lat], [end.lng, end.lat]]
          }
        }]
      };
    }
  }

  // Geocode an address to coordinates
  async geocode(address: string) {
    try {
      const response = await fetch(
        `${this.baseUrl}/geocode/search?text=${encodeURIComponent(address)}&apiKey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`Geocoding failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Geocoding failed:', error);
      return { features: [] };
    }
  }

  // Reverse geocode coordinates to address
  async reverseGeocode(lat: number, lng: number) {
    try {
      const response = await fetch(
        `${this.baseUrl}/geocode/reverse?lat=${lat}&lon=${lng}&apiKey=${this.apiKey}`
      );
      
      if (!response.ok) {
        throw new Error(`Reverse geocoding failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return { features: [] };
    }
  }

  // Generate map URL for static map
  getStaticMapUrl(
    center: {lat: number, lng: number}, 
    zoom: number = 14, 
    width: number = 600, 
    height: number = 400,
    markers?: Array<{lat: number, lng: number, color?: string}>
  ): string {
    let url = `${this.baseUrl}/staticmap?style=osm-bright&width=${width}&height=${height}&center=lonlat:${center.lng},${center.lat}&zoom=${zoom}&apiKey=${this.apiKey}`;
    
    if (markers && markers.length > 0) {
      const markerString = markers.map(marker => 
        `lonlat:${marker.lng},${marker.lat};color:${marker.color || 'red'};size:medium`
      ).join('|');
      url += `&marker=${markerString}`;
    }
    
    return url;
  }
}

// Default locations in Dhaka for simulation
export const DEFAULT_LOCATIONS = [
  { lat: 23.8103, lng: 90.4125, name: "Dhaka University", address: "Dhaka University, Dhaka" },
  { lat: 23.7808, lng: 90.4218, name: "Shahbagh", address: "Shahbagh, Dhaka" },
  { lat: 23.7616, lng: 90.3740, name: "Motijheel", address: "Motijheel Commercial Area, Dhaka" },
  { lat: 23.7956, lng: 90.4076, name: "New Market", address: "New Market, Dhaka" },
  { lat: 23.8223, lng: 90.3654, name: "Farmgate", address: "Farmgate, Dhaka" },
  { lat: 23.8103, lng: 90.3654, name: "Dhanmondi", address: "Dhanmondi, Dhaka" },
  { lat: 23.7439, lng: 90.3914, name: "Gulistan", address: "Gulistan, Dhaka" },
  { lat: 23.7298, lng: 90.3854, name: "Sadarghat", address: "Sadarghat, Dhaka" },
  { lat: 23.8759, lng: 90.3795, name: "Mirpur 1", address: "Mirpur 1, Dhaka" },
  { lat: 23.8546, lng: 90.3908, name: "Kallayanpur", address: "Kallayanpur, Dhaka" },
];

export const TRANSPORT_ROUTES = [
  {
    id: 'route-1',
    name: 'University - Commercial Route',
    stops: [
      { id: 'stop-1', name: 'Dhaka University', location: DEFAULT_LOCATIONS[0], type: 'station' as const },
      { id: 'stop-2', name: 'Shahbagh', location: DEFAULT_LOCATIONS[1], type: 'bus_stop' as const },
      { id: 'stop-3', name: 'New Market', location: DEFAULT_LOCATIONS[3], type: 'bus_stop' as const },
      { id: 'stop-4', name: 'Motijheel', location: DEFAULT_LOCATIONS[2], type: 'terminal' as const },
    ],
    farePerKm: 2.5,
    minimumFare: 10
  },
  {
    id: 'route-2',
    name: 'Residential - City Route',
    stops: [
      { id: 'stop-5', name: 'Mirpur 1', location: DEFAULT_LOCATIONS[8], type: 'terminal' as const },
      { id: 'stop-6', name: 'Kallayanpur', location: DEFAULT_LOCATIONS[9], type: 'bus_stop' as const },
      { id: 'stop-7', name: 'Farmgate', location: DEFAULT_LOCATIONS[4], type: 'bus_stop' as const },
      { id: 'stop-8', name: 'Dhanmondi', location: DEFAULT_LOCATIONS[5], type: 'bus_stop' as const },
      { id: 'stop-9', name: 'New Market', location: DEFAULT_LOCATIONS[3], type: 'bus_stop' as const },
    ],
    farePerKm: 3.0,
    minimumFare: 12
  },
  {
    id: 'route-3',
    name: 'Historical Circuit',
    stops: [
      { id: 'stop-10', name: 'Gulistan', location: DEFAULT_LOCATIONS[6], type: 'terminal' as const },
      { id: 'stop-11', name: 'Sadarghat', location: DEFAULT_LOCATIONS[7], type: 'station' as const },
      { id: 'stop-12', name: 'Motijheel', location: DEFAULT_LOCATIONS[2], type: 'bus_stop' as const },
      { id: 'stop-13', name: 'Shahbagh', location: DEFAULT_LOCATIONS[1], type: 'bus_stop' as const },
    ],
    farePerKm: 2.0,
    minimumFare: 8
  }
];
