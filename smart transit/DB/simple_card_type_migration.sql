-- Simple migration to add card_type column to USER_PROFILE table
-- Execute this step by step in your Supabase SQL Editor

-- Step 1: Add the card_type column
ALTER TABLE USER_PROFILE ADD COLUMN card_type VARCHAR(20) DEFAULT 'regular';

-- Step 2: Add constraint
ALTER TABLE USER_PROFILE ADD CONSTRAINT card_type_check CHECK (card_type IN ('regular', 'student', 'senior'));

-- Step 3: Update existing users to have regular card type
UPDATE USER_PROFILE SET card_type = 'regular' WHERE card_type IS NULL;

-- Step 4: Add sample users with different card types for testing
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD, card_type)
VALUES 
    ('Student User', 'student@example.com', '+1111111111', 'STU001', 200, '2000-06-15 00:00:00', 'University Campus', 'student123', 'student'),
    ('Senior User', 'senior@example.com', '+2222222222', 'SEN001', 500, '1960-03-20 00:00:00', 'Senior Community', 'senior123', 'senior');