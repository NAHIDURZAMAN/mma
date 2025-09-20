-- System Settings Table
-- This table stores all system configuration settings for the Smart Transit application
-- PostgreSQL/Supabase Compatible SQL

CREATE TABLE IF NOT EXISTS SYSTEM_SETTINGS (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  site_name VARCHAR(100) DEFAULT 'Smart Transit System',
  site_url VARCHAR(255) DEFAULT 'http://localhost:3000',
  admin_email VARCHAR(255) DEFAULT 'admin@smarttransit.com',
  enable_notifications BOOLEAN DEFAULT true,
  enable_registration BOOLEAN DEFAULT true,
  max_balance DECIMAL(10,2) DEFAULT 5000.00,
  min_recharge DECIMAL(10,2) DEFAULT 10.00,
  fare_per_km DECIMAL(5,2) DEFAULT 2.50,
  base_fare DECIMAL(5,2) DEFAULT 15.00,
  system_maintenance BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default system settings
INSERT INTO SYSTEM_SETTINGS (
  setting_key,
  site_name,
  site_url,
  admin_email,
  enable_notifications,
  enable_registration,
  max_balance,
  min_recharge,
  fare_per_km,
  base_fare,
  system_maintenance
) 
SELECT 
  'system_config',
  'Smart Transit System',
  'http://localhost:3000',
  'admin@smarttransit.com',
  true,
  true,
  5000.00,
  10.00,
  2.50,
  15.00,
  false
WHERE NOT EXISTS (
  SELECT 1 FROM SYSTEM_SETTINGS WHERE setting_key = 'system_config'
);

-- Create trigger function to update updated_at timestamp
-- Note: This is PostgreSQL/Supabase compatible syntax
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
  RETURNS trigger
  LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON SYSTEM_SETTINGS
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON SYSTEM_SETTINGS(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_updated ON SYSTEM_SETTINGS(updated_at);

-- Comments for documentation
COMMENT ON TABLE SYSTEM_SETTINGS IS 'System configuration settings for the Smart Transit application';
COMMENT ON COLUMN SYSTEM_SETTINGS.setting_key IS 'Unique identifier for the settings configuration';
COMMENT ON COLUMN SYSTEM_SETTINGS.site_name IS 'Name of the transit system/organization';
COMMENT ON COLUMN SYSTEM_SETTINGS.site_url IS 'Base URL of the system';
COMMENT ON COLUMN SYSTEM_SETTINGS.admin_email IS 'Primary administrator email address';
COMMENT ON COLUMN SYSTEM_SETTINGS.enable_notifications IS 'Whether email notifications are enabled';
COMMENT ON COLUMN SYSTEM_SETTINGS.enable_registration IS 'Whether new user registration is allowed';
COMMENT ON COLUMN SYSTEM_SETTINGS.max_balance IS 'Maximum balance a user can have';
COMMENT ON COLUMN SYSTEM_SETTINGS.min_recharge IS 'Minimum recharge amount allowed';
COMMENT ON COLUMN SYSTEM_SETTINGS.fare_per_km IS 'Fare rate per kilometer';
COMMENT ON COLUMN SYSTEM_SETTINGS.base_fare IS 'Base fare for any journey';
COMMENT ON COLUMN SYSTEM_SETTINGS.system_maintenance IS 'Whether the system is in maintenance mode';