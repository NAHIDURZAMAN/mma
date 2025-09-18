export interface User {
  user_id: number | string; // Allow both number and string
  name: string;
  email: string;
  phone?: string;
  card_id: string;
  balance: number;
  created_at: string;
  role?: 'admin' | 'user';
}

export interface Bus {
  bus_id: string;
  bus_number: string;
  route: string;
  total_seats: number;
  current_passengers: number;
  available_seats: number;
  location?: string;
  last_updated: string;
  passenger_cards: Set<string>; // Track which cards are currently on the bus
}

export interface TravelHistory {
  travel_id: string;
  user_id: string;
  pick_point: string;
  drop_point?: string;
  total_cost: number;
  remaining_balance: number;
  travel_time: string;
  status?: "ongoing" | "completed";
  distance?: number;
}

export interface RechargeHistory {
  recharge_id: string;
  user_id: string;
  recharge_amount: number;
  payment_method: string;
  recharge_date: string;
}

export interface CurrentTravel {
  travel_id: string;
  user_id: string;
  pick_point: string;
  current_longitude: number;
  current_latitude: number;
  created_at: string;
}

export interface RFIDScanData {
  card_id: string;
  device_id?: string;
  location?: string;
  timestamp?: string;
}

export interface RFIDResponse {
  success: boolean;
  message: string;
  action: "success_beep" | "error_beep" | "no_action";
  display?: [string, string];
  user?: {
    name: string;
    balance: number;
    fare_deducted?: number;
  };
}

export interface WebSocketMessage {
  type: "rfid_scan" | "user_update" | "travel_update" | "system_status";
  data: any;
  timestamp: string;
}

export interface Location {
  lat: number;
  lng: number;
  name: string;
  address?: string;
}

export interface RouteStop {
  id: string;
  name: string;
  location: Location;
  type: "bus_stop" | "station" | "terminal";
}

export interface TransportRoute {
  id: string;
  name: string;
  stops: RouteStop[];
  farePerKm: number;
  minimumFare: number;
}

export interface VirtualVehicle {
  id: string;
  routeId: string;
  currentLocation: Location;
  speed: number; // km/h
  isMoving: boolean;
  passengers: string[]; // card_ids
  capacity: number;
  direction: "forward" | "backward";
  nextStopIndex: number;
}

export interface TravelSimulation {
  id: string;
  vehicleId: string;
  cardId: string;
  userName: string;
  startLocation: Location;
  currentLocation: Location;
  endLocation?: Location;
  distance: number;
  fare: number;
  status: "boarding" | "traveling" | "completed";
  startTime: string;
  endTime?: string;
  route: Location[];
}
