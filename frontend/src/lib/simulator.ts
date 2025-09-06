import { Location, VirtualVehicle, TravelSimulation, TransportRoute } from '@/types';
import { GeopifyService, DEFAULT_LOCATIONS, TRANSPORT_ROUTES } from './geopify';

export class TransportSimulator {
  private vehicles: VirtualVehicle[] = [];
  private activeSimulations: TravelSimulation[] = [];
  private geopify: GeopifyService;
  private simulationInterval?: NodeJS.Timeout;
  private onUpdateCallback?: (simulations: TravelSimulation[], vehicles: VirtualVehicle[]) => void;

  constructor(geopifyApiKey: string) {
    this.geopify = new GeopifyService(geopifyApiKey);
    this.initializeVehicles();
  }

  private initializeVehicles() {
    // Create virtual vehicles for each route
    TRANSPORT_ROUTES.forEach((route, index) => {
      const vehicle: VirtualVehicle = {
        id: `vehicle-${index + 1}`,
        routeId: route.id,
        currentLocation: route.stops[0].location,
        speed: 25 + Math.random() * 15, // 25-40 km/h
        isMoving: true,
        passengers: [],
        capacity: 40,
        direction: 'forward',
        nextStopIndex: 1
      };
      this.vehicles.push(vehicle);
    });
  }

  // Start a travel simulation
  async startTravel(cardId: string, userName: string, startLocationName: string, endLocationName?: string): Promise<TravelSimulation> {
    const startLocation = DEFAULT_LOCATIONS.find(loc => loc.name === startLocationName);
    if (!startLocation) {
      throw new Error('Start location not found');
    }

    // Find nearest vehicle
    const nearestVehicle = this.findNearestVehicle(startLocation);
    if (!nearestVehicle) {
      throw new Error('No vehicles available');
    }

    // If no end location specified, simulate a random destination
    let endLocation: Location;
    if (endLocationName) {
      const foundEndLocation = DEFAULT_LOCATIONS.find(loc => loc.name === endLocationName);
      if (!foundEndLocation) {
        throw new Error('End location not found');
      }
      endLocation = foundEndLocation;
    } else {
      // Random destination from the route
      const route = TRANSPORT_ROUTES.find(r => r.id === nearestVehicle.routeId);
      if (route) {
        const availableStops = route.stops.filter(stop => stop.location.name !== startLocationName);
        endLocation = availableStops[Math.floor(Math.random() * availableStops.length)].location;
      } else {
        endLocation = DEFAULT_LOCATIONS[Math.floor(Math.random() * DEFAULT_LOCATIONS.length)];
      }
    }

    const distance = this.geopify.calculateDistance(
      startLocation.lat, startLocation.lng,
      endLocation.lat, endLocation.lng
    );

    const route = TRANSPORT_ROUTES.find(r => r.id === nearestVehicle.routeId);
    const farePerKm = route?.farePerKm || 2.5;
    const minimumFare = route?.minimumFare || 10;
    const fare = Math.max(Math.ceil(distance * farePerKm), minimumFare);

    const simulation: TravelSimulation = {
      id: `sim-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      vehicleId: nearestVehicle.id,
      cardId,
      userName,
      startLocation,
      currentLocation: { ...startLocation },
      endLocation,
      distance,
      fare,
      status: 'boarding',
      startTime: new Date().toISOString(),
      route: [startLocation]
    };

    // Add passenger to vehicle
    nearestVehicle.passengers.push(cardId);
    this.activeSimulations.push(simulation);

    // Start the simulation after a brief boarding time
    setTimeout(() => {
      simulation.status = 'traveling';
      this.notifyUpdate();
    }, 2000);

    this.notifyUpdate();
    return simulation;
  }

  // Stop a travel simulation
  stopTravel(simulationId: string): TravelSimulation | null {
    const simulation = this.activeSimulations.find(s => s.id === simulationId);
    if (!simulation) return null;

    simulation.status = 'completed';
    simulation.endTime = new Date().toISOString();

    // Remove passenger from vehicle
    const vehicle = this.vehicles.find(v => v.id === simulation.vehicleId);
    if (vehicle) {
      vehicle.passengers = vehicle.passengers.filter(cardId => cardId !== simulation.cardId);
    }

    // Remove from active simulations
    this.activeSimulations = this.activeSimulations.filter(s => s.id !== simulationId);

    this.notifyUpdate();
    return simulation;
  }

  // Find nearest vehicle to a location
  private findNearestVehicle(location: Location): VirtualVehicle | null {
    let nearest: VirtualVehicle | null = null;
    let minDistance = Infinity;

    this.vehicles.forEach(vehicle => {
      if (vehicle.passengers.length < vehicle.capacity) {
        const distance = this.geopify.calculateDistance(
          location.lat, location.lng,
          vehicle.currentLocation.lat, vehicle.currentLocation.lng
        );
        if (distance < minDistance) {
          minDistance = distance;
          nearest = vehicle;
        }
      }
    });

    return nearest;
  }

  // Start simulation updates
  startSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
    }

    this.simulationInterval = setInterval(() => {
      this.updateVehiclePositions();
      this.updateTravelSimulations();
      this.notifyUpdate();
    }, 1000); // Update every second
  }

  // Stop simulation updates
  stopSimulation() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = undefined;
    }
  }

  // Update vehicle positions along their routes
  private updateVehiclePositions() {
    this.vehicles.forEach(vehicle => {
      if (!vehicle.isMoving) return;

      const route = TRANSPORT_ROUTES.find(r => r.id === vehicle.routeId);
      if (!route) return;

      const currentStop = route.stops[vehicle.nextStopIndex - 1];
      const nextStop = route.stops[vehicle.nextStopIndex];

      if (!nextStop) {
        // Reached end of route, turn around
        vehicle.direction = vehicle.direction === 'forward' ? 'backward' : 'forward';
        vehicle.nextStopIndex = vehicle.direction === 'forward' ? 1 : route.stops.length - 1;
        return;
      }

      // Calculate movement towards next stop
      const speedMs = vehicle.speed / 3.6; // Convert km/h to m/s
      const distanceToMove = speedMs / 1000; // km per second

      const currentLat = vehicle.currentLocation.lat;
      const currentLng = vehicle.currentLocation.lng;
      const nextLat = nextStop.location.lat;
      const nextLng = nextStop.location.lng;

      const totalDistance = this.geopify.calculateDistance(currentLat, currentLng, nextLat, nextLng);
      
      if (totalDistance < 0.1) { // Within 100m of next stop
        vehicle.currentLocation = { ...nextStop.location };
        if (vehicle.direction === 'forward') {
          vehicle.nextStopIndex++;
        } else {
          vehicle.nextStopIndex--;
        }
        
        // Pause at stop for passenger boarding/alighting
        vehicle.isMoving = false;
        setTimeout(() => {
          vehicle.isMoving = true;
        }, 3000 + Math.random() * 2000); // 3-5 seconds
        
      } else {
        // Move towards next stop
        const ratio = distanceToMove / totalDistance;
        vehicle.currentLocation.lat = currentLat + (nextLat - currentLat) * ratio;
        vehicle.currentLocation.lng = currentLng + (nextLng - currentLng) * ratio;
      }
    });
  }

  // Update active travel simulations
  private updateTravelSimulations() {
    this.activeSimulations.forEach(simulation => {
      if (simulation.status !== 'traveling') return;

      const vehicle = this.vehicles.find(v => v.id === simulation.vehicleId);
      if (!vehicle) return;

      // Update simulation location to vehicle location
      simulation.currentLocation = { ...vehicle.currentLocation };
      simulation.route.push({ ...vehicle.currentLocation });

      // Check if reached destination
      if (simulation.endLocation) {
        const distanceToEnd = this.geopify.calculateDistance(
          vehicle.currentLocation.lat, vehicle.currentLocation.lng,
          simulation.endLocation.lat, simulation.endLocation.lng
        );

        if (distanceToEnd < 0.2) { // Within 200m of destination
          this.stopTravel(simulation.id);
        }
      }
    });
  }

  // Get current simulation state
  getSimulationState() {
    return {
      vehicles: [...this.vehicles],
      activeSimulations: [...this.activeSimulations]
    };
  }

  // Set update callback
  onUpdate(callback: (simulations: TravelSimulation[], vehicles: VirtualVehicle[]) => void) {
    this.onUpdateCallback = callback;
  }

  private notifyUpdate() {
    if (this.onUpdateCallback) {
      this.onUpdateCallback([...this.activeSimulations], [...this.vehicles]);
    }
  }

  // Calculate fare for a journey
  calculateFare(startLocation: Location, endLocation: Location, routeId?: string): number {
    const distance = this.geopify.calculateDistance(
      startLocation.lat, startLocation.lng,
      endLocation.lat, endLocation.lng
    );

    const route = routeId ? TRANSPORT_ROUTES.find(r => r.id === routeId) : TRANSPORT_ROUTES[0];
    const farePerKm = route?.farePerKm || 2.5;
    const minimumFare = route?.minimumFare || 10;

    return Math.max(Math.ceil(distance * farePerKm), minimumFare);
  }

  // Get available locations
  getAvailableLocations(): Location[] {
    return [...DEFAULT_LOCATIONS];
  }

  // Get available routes
  getAvailableRoutes(): TransportRoute[] {
    return [...TRANSPORT_ROUTES];
  }
}
