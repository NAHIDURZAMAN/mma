'use client';

import { useAuth } from '@/contexts/AuthContext';
import { AdminNavigation } from '@/components/AdminNavigation';
import { UserNavigation } from '@/components/UserNavigation';
import { Navigation } from '@/components/Navigation';

// Helper function to determine user role
// For now, we'll use email patterns to determine admin vs user
// In production, this should come from the database
function determineUserRole(user: any): 'admin' | 'user' {
  if (!user) return 'user';
  
  // Check if role is already set in user object
  if (user.role) {
    return user.role;
  }
  
  // Fallback: Admin determination logic
  // You can customize this logic based on your requirements
  const adminEmails = [
    'admin@smarttransit.com',
    'john.doe@example.com', // Make John Doe an admin for demo
    'admin@example.com',
    'administrator@smarttransit.com'
  ];
  
  const adminDomains = ['@admin.smarttransit.com'];
  
  // Check if user email is in admin list
  if (adminEmails.includes(user.email)) {
    return 'admin';
  }
  
  // Check if user email has admin domain
  if (adminDomains.some(domain => user.email.endsWith(domain))) {
    return 'admin';
  }
  
  // Check if user ID indicates admin (e.g., starts with 'A' for admin)
  if (typeof user.user_id === 'string' && user.user_id.startsWith('A')) {
    return 'admin';
  }
  
  // Default to regular user
  return 'user';
}

export function NavigationRouter() {
  const { user, isLoading } = useAuth();
  
  // Debug logging
  console.log('NavigationRouter - isLoading:', isLoading);
  console.log('NavigationRouter - user:', user);
  
  // Show loading state
  if (isLoading) {
    console.log('NavigationRouter - Showing original navigation (loading)');
    return <Navigation />; // Fallback to original navigation during loading
  }
  
  // If no user is logged in, show default navigation
  if (!user) {
    console.log('NavigationRouter - Showing original navigation (no user)');
    return <Navigation />;
  }
  
  // Determine user role and show appropriate navigation
  const userRole = determineUserRole(user);
  console.log('NavigationRouter - Determined role:', userRole, 'for user:', user.email);
  
  if (userRole === 'admin') {
    console.log('NavigationRouter - Showing AdminNavigation');
    return <AdminNavigation />;
  } else {
    console.log('NavigationRouter - Showing UserNavigation');
    return <UserNavigation />;
  }
}