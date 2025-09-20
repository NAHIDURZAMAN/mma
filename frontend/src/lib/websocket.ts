"use client";

import { io, Socket } from "socket.io-client";
import { WebSocketMessage } from "@/types";

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(url: string = "http://localhost:2000") {
    if (this.socket?.connected) {
      console.log("WebSocket already connected");
      return this.socket;
    }

    console.log(`Attempting to connect to WebSocket at ${url}`);
    
    this.socket = io(url, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on("connect", () => {
      console.log("WebSocket connected:", this.socket?.id);
      this.emit("connection", { status: "connected", id: this.socket?.id });
    });

    this.socket.on("disconnect", () => {
      console.log("WebSocket disconnected");
      this.emit("connection", { status: "disconnected" });
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      this.emit("connection", { status: "error", error: error.message });
    });

    // Listen for RFID scan events
    this.socket.on("rfid_scan", (data) => {
      console.log("RFID scan received:", data);
      this.emit("rfid_scan", data);
    });

    // Listen for user updates
    this.socket.on("user_update", (data) => {
      console.log("User update received:", data);
      this.emit("user_update", data);
    });

    // Listen for travel updates
    this.socket.on("travel_update", (data) => {
      console.log("Travel update received:", data);
      this.emit("travel_update", data);
    });

    // Listen for stats updates
    this.socket.on("stats_update", (data) => {
      console.log("Stats update received:", data);
      this.emit("stats_update", data);
    });

    // Listen for travel completion
    this.socket.on("travel_completed", (data) => {
      console.log("Travel completed received:", data);
      this.emit("travel_completed", data);
    });

    // Listen for bus location updates
    this.socket.on("bus_location_update", (data) => {
      console.log("Bus location update received:", data);
      this.emit("bus_location_update", data);
    });

    // Listen for vehicle position updates
    this.socket.on("vehicle_position_update", (data) => {
      console.log("Vehicle position update received:", data);
      this.emit("vehicle_position_update", data);
    });

    // Listen for route updates from Smart Transit Simulation
    this.socket.on("route_updated", (data) => {
      console.log("Route updated received:", data);
      this.emit("route_updated", data);
    });

    // Listen for simulation status updates
    this.socket.on("simulation_status", (data) => {
      console.log("Simulation status received:", data);
      this.emit("simulation_status", data);
    });

    // Listen for route status changes
    this.socket.on("route_status_changed", (data) => {
      console.log("Route status changed received:", data);
      this.emit("route_status_changed", data);
    });

    // Listen for security alerts
    this.socket.on("security_alert", (data) => {
      console.log("Security alert received:", data);
      this.emit("security_alert", data);
    });

    // Listen for user creation events
    this.socket.on("user_created", (data) => {
      console.log("User created received:", data);
      this.emit("user_created", data);
    });

    // Listen for balance updates
    this.socket.on("balance_updated", (data) => {
      console.log("Balance updated received:", data);
      this.emit("balance_updated", data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }

  off(event: string, callback?: Function) {
    if (!this.listeners.has(event)) return;

    if (callback) {
      const callbacks = this.listeners.get(event) || [];
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    } else {
      this.listeners.set(event, []);
    }
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event) || [];
    callbacks.forEach((callback) => callback(data));
  }

  // Send messages to server
  send(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn("WebSocket not connected. Cannot send:", event, data);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const wsService = new WebSocketService();
