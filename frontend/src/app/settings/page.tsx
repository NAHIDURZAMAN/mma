'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Shield,
  Bell,
  Globe,
  Lock,
  Palette,
  Database,
  Wifi,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';

export default function SettingsPage() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    siteName: 'Smart Transit System',
    siteUrl: 'http://localhost:3000',
    adminEmail: 'admin@smarttransit.com',
    enableNotifications: true,
    enableRegistration: true,
    maxBalance: 5000,
    minRecharge: 10,
    farePerKm: 2.5,
    baseFare: 15,
    systemMaintenance: false,
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Are you sure you want to reset all settings to default values?')) {
      setSettings({
        siteName: 'Smart Transit System',
        siteUrl: 'http://localhost:3000',
        adminEmail: 'admin@smarttransit.com',
        enableNotifications: true,
        enableRegistration: true,
        maxBalance: 5000,
        minRecharge: 10,
        farePerKm: 2.5,
        baseFare: 15,
        systemMaintenance: false,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">System Settings</h1>
        <p className="text-muted-foreground">
          Configure system-wide settings and preferences
        </p>
      </div>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>General Settings</span>
          </CardTitle>
          <CardDescription>Basic system configuration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Site Name</label>
              <Input
                value={settings.siteName}
                onChange={(e) => handleSettingChange('siteName', e.target.value)}
                placeholder="Enter site name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Site URL</label>
              <Input
                value={settings.siteUrl}
                onChange={(e) => handleSettingChange('siteUrl', e.target.value)}
                placeholder="Enter site URL"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Admin Email</label>
              <Input
                type="email"
                value={settings.adminEmail}
                onChange={(e) => handleSettingChange('adminEmail', e.target.value)}
                placeholder="Enter admin email"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">System Status</label>
              <div className="flex items-center space-x-2">
                <Badge variant={settings.systemMaintenance ? 'destructive' : 'default'}>
                  {settings.systemMaintenance ? (
                    <>
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Maintenance Mode
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Operational
                    </>
                  )}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSettingChange('systemMaintenance', !settings.systemMaintenance)}
                >
                  Toggle
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Security Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Security Settings</span>
          </CardTitle>
          <CardDescription>Configure security and access controls</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Enable User Registration</h4>
                <p className="text-sm text-muted-foreground">Allow new users to register accounts</p>
              </div>
              <Button
                variant={settings.enableRegistration ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSettingChange('enableRegistration', !settings.enableRegistration)}
              >
                {settings.enableRegistration ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Push Notifications</h4>
                <p className="text-sm text-muted-foreground">Send system notifications to users</p>
              </div>
              <Button
                variant={settings.enableNotifications ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleSettingChange('enableNotifications', !settings.enableNotifications)}
              >
                {settings.enableNotifications ? 'Enabled' : 'Disabled'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payment Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Database className="h-5 w-5" />
            <span>Payment Settings</span>
          </CardTitle>
          <CardDescription>Configure payment and fare settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Maximum Balance (৳)</label>
              <Input
                type="number"
                value={settings.maxBalance}
                onChange={(e) => handleSettingChange('maxBalance', parseInt(e.target.value))}
                placeholder="Enter maximum balance"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Minimum Recharge (৳)</label>
              <Input
                type="number"
                value={settings.minRecharge}
                onChange={(e) => handleSettingChange('minRecharge', parseInt(e.target.value))}
                placeholder="Enter minimum recharge"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Base Fare (৳)</label>
              <Input
                type="number"
                step="0.1"
                value={settings.baseFare}
                onChange={(e) => handleSettingChange('baseFare', parseFloat(e.target.value))}
                placeholder="Enter base fare"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fare per KM (৳)</label>
              <Input
                type="number"
                step="0.1"
                value={settings.farePerKm}
                onChange={(e) => handleSettingChange('farePerKm', parseFloat(e.target.value))}
                placeholder="Enter fare per kilometer"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Wifi className="h-5 w-5" />
            <span>System Information</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h4 className="font-medium">Application Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Version:</span>
                  <span>1.0.0</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Environment:</span>
                  <Badge variant="secondary">Development</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database:</span>
                  <span>PostgreSQL 15.3</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Node.js:</span>
                  <span>v18.17.0</span>
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <h4 className="font-medium">System Health</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">API Status:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Online
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Database:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Connected
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">WebSocket:</span>
                  <Badge variant="default" className="bg-green-100 text-green-800">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Backup:</span>
                  <span>2 hours ago</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardContent className="p-4">
          <div className="flex space-x-4">
            <Button onClick={handleSave} disabled={loading}>
              {loading ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reset to Default
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}