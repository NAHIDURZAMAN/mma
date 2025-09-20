-- Fix USER_ID auto-generation for Supabase
-- Run this in your Supabase SQL Editor

-- First, let's check and fix the sequence
DROP SEQUENCE IF EXISTS user_id_seq CASCADE;
CREATE SEQUENCE user_id_seq START 1;

-- Create or replace the trigger function
CREATE OR REPLACE FUNCTION generate_user_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Only generate USER_ID if it's not provided
    IF NEW.USER_ID IS NULL OR NEW.USER_ID = '' THEN
        NEW.USER_ID := 'U' || LPAD(nextval('user_id_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate the trigger
DROP TRIGGER IF EXISTS user_id_trigger ON USER_PROFILE;
CREATE TRIGGER user_id_trigger
    BEFORE INSERT ON USER_PROFILE
    FOR EACH ROW
    EXECUTE FUNCTION generate_user_id();

-- Update the sequence to start from the current max + 1
SELECT setval('user_id_seq', 
    COALESCE(
        (SELECT MAX(CAST(SUBSTRING(USER_ID FROM 2) AS INTEGER)) FROM USER_PROFILE WHERE USER_ID ~ '^U[0-9]+$'), 
        0
    ) + 1, 
    false
);

-- Test the trigger (you can remove this after verification)
-- INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD, card_type)
-- VALUES ('Test User', 'test123@example.com', '+1234567890', 'TEST123', 100, NOW(), 'Test Address', 'test123', 'regular');