"use client";

import { io, Socket } from "socket.io-client";
import { WebSocketMessage } from "@/types";

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Function[]> = new Map();

  connect(url: string = "http://localhost:2000") {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.socket = io(url, {
      transports: ["websocket", "polling"],
      timeout: 20000,
      forceNew: true,
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
