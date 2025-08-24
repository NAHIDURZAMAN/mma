-- USER_PROFILE table for PostgreSQL/Supabase
-- Drop existing table and sequences if they exist
DROP TABLE IF EXISTS CURRENT_TRAVEL CASCADE;
DROP TABLE IF EXISTS TRAVEL_HISTORY CASCADE;
DROP TABLE IF EXISTS RECHARGE_HISTORY CASCADE;
DROP TABLE IF EXISTS USER_PROFILE CASCADE;

-- Create sequence for user_id generation
CREATE SEQUENCE IF NOT EXISTS user_id_seq START 1;

-- Create USER_PROFILE table
CREATE TABLE USER_PROFILE (
    USER_ID VARCHAR(20) PRIMARY KEY DEFAULT ('U' || LPAD(nextval('user_id_seq')::TEXT, 6, '0')),
    NAME VARCHAR(100) NOT NULL,
    EMAIL VARCHAR(100) UNIQUE NOT NULL,
    PHONE VARCHAR(20),
    CARD_ID VARCHAR(50) UNIQUE NOT NULL,
    BALANCE DECIMAL(10, 2) NOT NULL DEFAULT 0,
    DOB TIMESTAMP NOT NULL,
    PASSWORD VARCHAR(100) NOT NULL,
    AGE INTEGER GENERATED ALWAYS AS (
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, DOB::DATE))
    ) STORED,
    ADDRESS VARCHAR(200) NOT NULL,
    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create function to update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.UPDATED_AT = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to update updated_at on USER_PROFILE
CREATE TRIGGER update_user_profile_updated_at 
    BEFORE UPDATE ON USER_PROFILE
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert sample users
INSERT INTO USER_PROFILE (NAME, EMAIL, PHONE, CARD_ID, BALANCE, DOB, ADDRESS, PASSWORD)
VALUES 
    ('John Doe', 'john.doe@example.com', '+123456789', '520028A3A0', 500, '1996-04-12 10:00:00', '123 Street, City, Country', 'hashed_password'),
    ('Jane Smith', 'jane.smith@example.com', '+987654321', '520028B840', 1000, '1992-05-15 09:30:00', '456 Avenue, Town, Country', 'hashed_password'),
    ('Mike Johnson', 'mike.johnson@example.com', '+1122334450', '520026D872', 750, '1998-02-22 08:15:00', '789 Boulevard, City, Country', 'hashed_password'),
    ('Chris Johnson', 'chris.johnson@example.com', '+1122334460', '520028E289', 750, '1995-01-10 08:30:00', '789 Boulevard, City, Country', 'hashed_password'),
    ('Alex Johnson', 'alex.johnson@example.com', '+1122334470', '4400309616', 750, '1997-03-05 10:15:00', '789 Boulevard, City, Country', 'hashed_password');

-- Update a specific user's balance (example)
-- UPDATE USER_PROFILE SET BALANCE = 30 WHERE USER_ID = 'U000001';
