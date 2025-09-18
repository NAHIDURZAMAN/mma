'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { 
  Home, 
  Users, 
  Activity, 
  Settings,
  CreditCard,
  Navigation as NavigationIcon,
  LogOut,
  User,
  LogIn,
  MapPin,
  Menu,
  ChevronLeft,
  Shield,
  BarChart3,
  Database
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/', icon: Home },
  { name: 'User Management', href: '/users', icon: Users },
  { name: 'System Monitor', href: '/monitor', icon: Activity },
  { name: 'RFID Simulator', href: '/simulator', icon: CreditCard },
  { name: 'Smart Transit', href: '/smart-transit', icon: NavigationIcon },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
  { name: 'Database', href: '/database', icon: Database },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function AdminNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Don't show navigation on login page
  if (pathname === '/login') {
    return null;
  }

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <nav className={cn(
      "border-r bg-muted/40 transition-all duration-300 ease-in-out",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-full max-h-screen flex-col gap-2">
        {/* Header with Toggle Button */}
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <div className="flex items-center gap-2 font-semibold flex-1">
            <div className="bg-red-600 text-white p-1.5 rounded">
              <Shield className="h-4 w-4" />
            </div>
            {!isCollapsed && (
              <div>
                <span>Admin Panel</span>
                <Badge variant="destructive" className="ml-2 text-xs">ADMIN</Badge>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSidebar}
            className="h-8 w-8 p-0"
          >
            {isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Navigation Items */}
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {adminNavigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                  pathname === item.href && "bg-muted text-primary",
                  isCollapsed && "justify-center px-2"
                )}
                title={isCollapsed ? item.name : undefined}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            ))}
          </nav>
        </div>

        {/* User Section */}
        <div className={cn("p-4 border-t", isCollapsed && "px-2")}>
          {isLoading ? (
            <div className={cn(
              "text-center text-sm text-muted-foreground",
              isCollapsed && "text-xs"
            )}>
              {isCollapsed ? "..." : "Loading..."}
            </div>
          ) : user ? (
            <div className="space-y-3">
              {/* User Info */}
              <div className={cn(
                "flex items-center gap-3",
                isCollapsed && "justify-center"
              )}>
                <div className="bg-red-600 text-white p-2 rounded-full">
                  <Shield className="h-4 w-4" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <Badge variant="destructive" className="text-xs mt-1">Administrator</Badge>
                  </div>
                )}
              </div>
              
              {/* Logout Button */}
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className={cn("w-full", isCollapsed && "px-2")}
                title={isCollapsed ? "Sign Out" : undefined}
              >
                <LogOut className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Sign Out</span>}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {!isCollapsed && (
                <p className="text-sm text-muted-foreground text-center">Not signed in</p>
              )}
              <Button
                onClick={() => router.push('/login')}
                className="w-full"
                size="sm"
                title={isCollapsed ? "Sign In" : undefined}
              >
                <LogIn className="h-4 w-4" />
                {!isCollapsed && <span className="ml-2">Sign In</span>}
              </Button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}