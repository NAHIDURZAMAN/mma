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

  async createUser(userData: {
    name: string;
    email: string;
    phone: string;
    dob: string;
    address: string;
    password: string;
    balance?: number;
  }) {
    return this.request<{
      success: boolean;
      user: User;
      cardId: string;
      message: string;
    }>("/user/create", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async getAllUsersAdmin() {
    return this.request<{
      success: boolean;
      users: User[];
      total: number;
    }>("/user/admin/users");
  }

  async updateUserBalance(userId: string, balance: number) {
    return this.request<{
      success: boolean;
      user: User;
      message: string;
    }>(`/user/admin/users/${userId}/balance`, {
      method: "PUT",
      body: JSON.stringify({ balance }),
    });
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

  // User operations - replaced old RFID simulation
  async simulateRFIDScan(data: RFIDScanData) {
    // Deprecated: This endpoint has been replaced with user creation functionality
    // Keeping for backward compatibility, but redirects to user lookup
    console.warn('simulateRFIDScan is deprecated. Use user creation APIs instead.');
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

  // Simulation operations
  async createTravelSimulation(data: {
    cardId: string;
    userName: string;
    startLocation: string;
    endLocation?: string;
    estimatedFare: number;
  }) {
    return this.request<any>("/api/simulation/travel", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTravelLocation(simulationId: string, location: { lat: number; lng: number }) {
    return this.request<any>(`/api/simulation/travel/${simulationId}/location`, {
      method: "PATCH", 
      body: JSON.stringify(location),
    });
  }

  async completeTravelSimulation(simulationId: string, finalFare: number) {
    return this.request<any>(`/api/simulation/travel/${simulationId}/complete`, {
      method: "POST",
      body: JSON.stringify({ finalFare }),
    });
  }

  // Analytics operations
  async getAnalyticsOverview() {
    return this.request<{
      success: boolean;
      data: {
        totalUsers: number;
        totalRevenue: number;
        totalTrips: number;
        activeUsers: number;
        todayTrips: number;
        monthlyGrowth: {
          revenue: number;
          trips: number;
          users: number;
        };
        recentActivity: any[];
        lastUpdated: string;
      };
    }>("/api/analytics/overview");
  }

  // Monitor operations
  async getMonitorStats() {
    return this.request<{
      success: boolean;
      data: {
        totalUsers: number;
        activePassengers: number;
        currentPassengers: number;
        totalRevenue: number;
        totalTrips: number;
        recentActivity: any[];
        lastUpdated: string;
      };
    }>("/api/monitor/stats");
  }

  async getCurrentPassengers() {
    return this.request<{
      success: boolean;
      data: any[];
      count: number;
      lastUpdated: string;
    }>("/api/monitor/passengers");
  }

  async getRevenueAnalytics() {
    return this.request<{
      success: boolean;
      data: {
        monthlyRevenue: Array<{
          month: string;
          revenue: number;
          trips: number;
        }>;
        totalRevenue: number;
        totalTrips: number;
        lastUpdated: string;
      };
    }>("/api/analytics/revenue");
  }

  async getRouteAnalytics() {
    return this.request<{
      success: boolean;
      data: {
        popularRoutes: Array<{
          route: string;
          count: number;
          totalRevenue: number;
          averageFare: number;
          percentage: number;
        }>;
        totalRoutes: number;
        totalTrips: number;
        lastUpdated: string;
      };
    }>("/api/analytics/routes");
  }

  async getUserAnalytics() {
    return this.request<{
      success: boolean;
      data: {
        totalUsers: number;
        activeUsers: number;
        newUsersThisMonth: number;
        topUsers: Array<{
          userId: string;
          name: string;
          email: string;
          tripCount: number;
        }>;
        balanceDistribution: {
          '0-100': number;
          '101-500': number;
          '501-1000': number;
          '1000+': number;
        };
        averageBalance: number;
        lastUpdated: string;
      };
    }>("/api/analytics/users");
  }

  // Settings API methods
  async getSystemSettings() {
    return this.request<{
      success: boolean;
      data: SystemSettings;
    }>("/api/settings");
  }

  async updateSystemSettings(settings: Partial<SystemSettings>) {
    return this.request<{
      success: boolean;
      data: SystemSettings;
      message: string;
    }>("/api/settings", {
      method: "POST",
      body: JSON.stringify(settings),
    });
  }

  async resetSystemSettings() {
    return this.request<{
      success: boolean;
      data: SystemSettings;
      message: string;
    }>("/api/settings/reset", {
      method: "POST",
    });
  }

  async getSystemHealth() {
    return this.request<{
      success: boolean;
      data: SystemHealth;
    }>("/api/system/health");
  }

  // Database Management Methods
  async getDatabaseStats() {
    return this.request<{
      success: boolean;
      data: DatabaseStats;
    }>("/api/database/stats");
  }

  async getDatabaseTables() {
    return this.request<{
      success: boolean;
      data: DatabaseTable[];
    }>("/api/database/tables");
  }

  async createDatabaseBackup() {
    return this.request<{
      success: boolean;
      data: BackupInfo;
      message: string;
    }>("/api/database/backup", {
      method: "POST",
    });
  }

  async optimizeDatabase() {
    return this.request<{
      success: boolean;
      data: OptimizeInfo;
      message: string;
    }>("/api/database/optimize", {
      method: "POST",
    });
  }

  async getDatabasePerformance() {
    return this.request<{
      success: boolean;
      data: PerformanceMetrics;
    }>("/api/database/performance");
  }

  // Card Blocking Management Methods
  async blockCard(data: {
    userId?: string;
    cardId?: string;
    reason: string;
    blockedBy?: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      data: {
        user: any;
        emailSent: boolean;
      };
    }>("/api/cards/block", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async unblockCard(data: {
    userId?: string;
    cardId?: string;
    reason: string;
    unblockedBy?: string;
  }) {
    return this.request<{
      success: boolean;
      message: string;
      data: {
        user: any;
        emailSent: boolean;
      };
    }>("/api/cards/unblock", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getBlockedCards() {
    return this.request<{
      success: boolean;
      data: any[];
      count: number;
    }>("/api/cards/blocked");
  }

  async getCardBlockHistory(cardId?: string, userId?: string) {
    const params = new URLSearchParams();
    if (cardId) params.set('cardId', cardId);
    if (userId) params.set('userId', userId);
    
    const query = params.toString() ? `?${params.toString()}` : '';
    
    return this.request<{
      success: boolean;
      data: any[];
      count: number;
    }>(`/api/cards/block-history${query}`);
  }
}

// Settings interfaces
export interface SystemSettings {
  siteName: string;
  siteUrl: string;
  adminEmail: string;
  enableNotifications: boolean;
  enableRegistration: boolean;
  maxBalance: number;
  minRecharge: number;
  farePerKm: number;
  baseFare: number;
  systemMaintenance: boolean;
  lastUpdated: string;
}

export interface SystemHealth {
  status: string;
  timestamp: string;
  database: {
    status: string;
    type: string;
    userCount: number;
  };
  api: {
    status: string;
    version: string;
    environment: string;
  };
  websocket: {
    status: string;
    connectedClients: number;
  };
}

export interface DatabaseStats {
  totalTables: number;
  totalRecords: number;
  dbSize: string;
  status: string;
  connections: number;
  uptime: string;
  lastBackup: string;
  engine: string;
  version: string;
  encoding: string;
}

export interface DatabaseTable {
  name: string;
  records: number;
  size: string;
  status: string;
  description: string;
}

export interface BackupInfo {
  id: string;
  timestamp: string;
  duration: string;
  size: string;
  status: string;
  type: string;
}

export interface OptimizeInfo {
  duration: string;
  operations: string[];
  spaceSaved: string;
  performanceImprovement: string;
  status: string;
}

export interface PerformanceMetrics {
  queryPerformance: {
    averageQueryTime: string;
    slowQueries: number;
    totalQueries: number;
    cacheHitRatio: string;
  };
  connections: {
    active: number;
    idle: number;
    max: number;
    usage: string;
  };
  storage: {
    used: string;
    available: string;
    usage: string;
  };
  indexEfficiency: string;
  uptime: string;
  lastOptimized: string;
}

export const apiService = new ApiService();
