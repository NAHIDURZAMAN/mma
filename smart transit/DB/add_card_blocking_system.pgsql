-- Add card blocking system to user_profile table (PostgreSQL version)
-- This migration adds the necessary fields for card blocking functionality

-- Add blocking columns to user_profile table
ALTER TABLE user_profile 
ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS blocked_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS blocked_reason VARCHAR(500) NULL,
ADD COLUMN IF NOT EXISTS blocked_by VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS unblocked_at TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS unblocked_by VARCHAR(100) NULL,
ADD COLUMN IF NOT EXISTS unblock_reason VARCHAR(500) NULL;

-- Add comments for documentation
COMMENT ON COLUMN user_profile.is_blocked IS 'Card blocking status: false = Active, true = Blocked';
COMMENT ON COLUMN user_profile.blocked_at IS 'Timestamp when card was blocked';
COMMENT ON COLUMN user_profile.blocked_reason IS 'Reason for blocking the card';
COMMENT ON COLUMN user_profile.blocked_by IS 'User ID or system that blocked the card';
COMMENT ON COLUMN user_profile.unblocked_at IS 'Timestamp when card was unblocked';
COMMENT ON COLUMN user_profile.unblocked_by IS 'User ID or system that unblocked the card';
COMMENT ON COLUMN user_profile.unblock_reason IS 'Reason for unblocking the card';

-- Create index for performance on blocked status
CREATE INDEX IF NOT EXISTS idx_user_profile_blocked ON user_profile(is_blocked);

-- Create a view for active (non-blocked) users
CREATE OR REPLACE VIEW active_users AS
SELECT * FROM user_profile WHERE is_blocked = false OR is_blocked IS NULL;

-- Create a view for blocked users
CREATE OR REPLACE VIEW blocked_users AS
SELECT * FROM user_profile WHERE is_blocked = true;