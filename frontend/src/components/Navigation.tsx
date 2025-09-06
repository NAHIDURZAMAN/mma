'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Home, 
  Users, 
  Activity, 
  Settings,
  CreditCard,
  Navigation as NavigationIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Users', href: '/users', icon: Users },
  { name: 'Monitor', href: '/monitor', icon: Activity },
  { name: 'RFID Simulator', href: '/simulator', icon: CreditCard },
  { name: 'Smart Transit', href: '/smart-transit', icon: NavigationIcon },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-r bg-muted/40 w-64">
      <div className="flex h-full max-h-screen flex-col gap-2">
        <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <div className="bg-primary text-primary-foreground p-1.5 rounded">
              <CreditCard className="h-4 w-4" />
            </div>
            <span>Smart Transit</span>
          </div>
        </div>
        <div className="flex-1">
          <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navigation.map((item) => (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                  pathname === item.href && "bg-muted text-primary"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </nav>
  );
}
