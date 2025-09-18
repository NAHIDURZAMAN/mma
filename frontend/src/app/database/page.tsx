'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Database, 
  Server,
  HardDrive,
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Settings,
  Download,
  Upload
} from 'lucide-react';

export default function DatabasePage() {
  const [loading, setLoading] = useState(false);
  const [dbStats] = useState({
    totalTables: 8,
    totalRecords: 15847,
    dbSize: '124.7 MB',
    lastBackup: '2024-01-15 10:30:00',
    status: 'healthy',
    connections: 12,
    uptime: '15 days, 7 hours'
  });

  const tables = [
    { name: 'USER_PROFILE', records: 1247, size: '45.2 MB', status: 'healthy' },
    { name: 'TRAVEL_HISTORY', records: 8934, size: '67.3 MB', status: 'healthy' },
    { name: 'CURRENT_TRAVEL', records: 23, size: '2.1 MB', status: 'healthy' },
    { name: 'RECHARGE_HISTORY', records: 3456, size: '8.7 MB', status: 'healthy' },
    { name: 'BUS_INFO', records: 15, size: '0.8 MB', status: 'healthy' },
    { name: 'ROUTE_STOPS', records: 156, size: '0.4 MB', status: 'warning' },
    { name: 'SYSTEM_LOGS', records: 2016, size: '0.2 MB', status: 'healthy' },
  ];

  const handleBackup = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Database backup completed successfully!');
    } catch (error) {
      alert('Backup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOptimize = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      alert('Database optimization completed!');
    } catch (error) {
      alert('Optimization failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Database Management</h1>
        <p className="text-muted-foreground">
          Monitor and manage database performance and operations
        </p>
      </div>

      {/* Database Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Database Status</p>
                <div className="flex items-center mt-1">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    {dbStats.status.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="bg-green-100 p-2 rounded-full">
                <Database className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                <p className="text-2xl font-bold">{dbStats.totalRecords.toLocaleString()}</p>
              </div>
              <div className="bg-blue-100 p-2 rounded-full">
                <HardDrive className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Database Size</p>
                <p className="text-2xl font-bold">{dbStats.dbSize}</p>
              </div>
              <div className="bg-purple-100 p-2 rounded-full">
                <Server className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Connections</p>
                <p className="text-2xl font-bold">{dbStats.connections}</p>
              </div>
              <div className="bg-orange-100 p-2 rounded-full">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Database Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Database Operations</CardTitle>
          <CardDescription>Perform maintenance and backup operations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Button onClick={handleBackup} disabled={loading} className="h-20 flex flex-col items-center justify-center space-y-2">
              <Download className="h-6 w-6" />
              <span>Backup Database</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <Upload className="h-6 w-6" />
              <span>Restore Backup</span>
            </Button>
            <Button variant="outline" onClick={handleOptimize} disabled={loading} className="h-20 flex flex-col items-center justify-center space-y-2">
              <RefreshCw className="h-6 w-6" />
              <span>Optimize</span>
            </Button>
            <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
              <Settings className="h-6 w-6" />
              <span>Configuration</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table Information */}
      <Card>
        <CardHeader>
          <CardTitle>Database Tables</CardTitle>
          <CardDescription>Overview of all database tables and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {tables.map((table) => (
              <div key={table.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="bg-primary/10 p-2 rounded-full">
                    <Database className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">{table.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {table.records.toLocaleString()} records • {table.size}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Badge variant={table.status === 'healthy' ? 'default' : 'secondary'}>
                    {table.status === 'healthy' ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Healthy
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Warning
                      </>
                    )}
                  </Badge>
                  <Button variant="outline" size="sm">
                    View
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">Database Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Engine:</span>
                  <span>PostgreSQL 15.3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span>15.3-1.pgdg110+1</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Encoding:</span>
                  <span>UTF8</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Tables:</span>
                  <span>{dbStats.totalTables}</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">Performance</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Uptime:</span>
                  <span>{dbStats.uptime}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Backup:</span>
                  <span>{new Date(dbStats.lastBackup).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Active Connections:</span>
                  <span>{dbStats.connections}/100</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Memory Usage:</span>
                  <span>67.3%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}