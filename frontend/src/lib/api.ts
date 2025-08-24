import { User, TravelHistory, RechargeHistory, RFIDScanData } from "@/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2000";

class ApiService {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Health check
  async healthCheck() {
    return this.request<any>("/api/health");
  }

  // User management
  async getUsers() {
    return this.request<{ success: boolean; data: User[]; count: number }>(
      "/api/users"
    );
  }

  async login(email: string, password: string) {
    return this.request<any>("/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  }

  async logout() {
    return this.request<any>("/logout", {
      method: "POST",
    });
  }

  // RFID operations
  async simulateRFIDScan(data: RFIDScanData) {
    return this.request<any>("/api/rfid/scan", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // Travel operations
  async getTravelHistory(userId?: string) {
    const endpoint = userId
      ? `/api/travel/history/${userId}`
      : "/api/travel/history";
    return this.request<{ success: boolean; data: TravelHistory[] }>(endpoint);
  }

  async getCurrentTravels() {
    return this.request<{ success: boolean; data: any[] }>(
      "/api/travel/current"
    );
  }

  async startTravel(pickPoint: string, longitude?: number, latitude?: number) {
    return this.request<any>("/travel/start", {
      method: "POST",
      body: JSON.stringify({
        pick_point: pickPoint,
        current_longitude: longitude || 0,
        current_latitude: latitude || 0,
      }),
    });
  }

  // Recharge operations
  async recharge(amount: number, paymentMethod: string) {
    return this.request<any>("/recharge", {
      method: "POST",
      body: JSON.stringify({
        amount,
        payment_method: paymentMethod,
      }),
    });
  }

  // Arduino configuration
  async getArduinoConfig() {
    return this.request<any>("/api/arduino/config");
  }
}

export const apiService = new ApiService();
