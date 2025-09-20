-- Add card_type column to USER_PROFILE table
-- Execute this in your Supabase SQL Editor

-- Step 1: Add the card_type column
ALTER TABLE USER_PROFILE ADD COLUMN card_type VARCHAR(20);

-- Step 2: Set default value for existing records
UPDATE USER_PROFILE SET card_type = 'regular' WHERE card_type IS NULL;

-- Step 3: Set default for new records and add constraint
ALTER TABLE USER_PROFILE ALTER card_type SET DEFAULT 'regular';
ALTER TABLE USER_PROFILE ADD CONSTRAINT card_type_check CHECK (card_type IN ('regular', 'student', 'senior'));

-- Update existing users to have regular card type
UPDATE USER_PROFILE SET card_type = 'regular' WHERE card_type IS NULL;

-- Add a few sample users with different card types for testing
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD, card_type)
VALUES 
    ('Student User', 'student@example.com', '+1111111111', 'STU001', 200, '2000-06-15 00:00:00', 'University Campus', 'student123', 'student'),
    ('Senior User', 'senior@example.com', '+2222222222', 'SEN001', 500, '1960-03-20 00:00:00', 'Senior Community', 'senior123', 'senior');

-- Create trigger to auto-generate USER_ID for PostgreSQL
CREATE OR REPLACE FUNCTION generate_user_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.USER_ID IS NULL THEN
        NEW.USER_ID := 'U' || LPAD(nextval('user_id_seq')::text, 6, '0');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_id_trigger ON USER_PROFILE;
CREATE TRIGGER user_id_trigger
    BEFORE INSERT ON USER_PROFILE
    FOR EACH ROW
    EXECUTE FUNCTION generate_user_id();

-- Create trigger to auto-calculate age
CREATE OR REPLACE FUNCTION calculate_age()
RETURNS TRIGGER AS $$
BEGIN
    NEW.AGE := EXTRACT(YEAR FROM AGE(NEW.DOB));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_age_trigger ON USER_PROFILE;
CREATE TRIGGER user_age_trigger
    BEFORE INSERT OR UPDATE ON USER_PROFILE
    FOR EACH ROW
    EXECUTE FUNCTION calculate_age();