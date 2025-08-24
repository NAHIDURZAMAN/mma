-- Run this SQL in your Supabase SQL Editor
-- Complete table setup for Smart Transit

-- Drop existing tables
DROP TABLE IF EXISTS current_travel CASCADE;
DROP TABLE IF EXISTS travel_history CASCADE;
DROP TABLE IF EXISTS recharge_history CASCADE;
DROP TABLE IF EXISTS bus_info CASCADE;
DROP TABLE IF EXISTS user_profile CASCADE;

-- Create USER_PROFILE table
CREATE TABLE user_profile (
    user_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    card_id VARCHAR(50) UNIQUE NOT NULL,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0,
    dob DATE NOT NULL,
    password VARCHAR(100) NOT NULL,
    address VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create BUS_INFO table
CREATE TABLE bus_info (
    bus_id VARCHAR(100) PRIMARY KEY,
    total_seats INTEGER DEFAULT 50,
    available_seats INTEGER DEFAULT 50,
    per_km_cost DECIMAL(10, 2) DEFAULT 5.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create CURRENT_TRAVEL table
CREATE TABLE current_travel (
    travel_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profile(user_id),
    pick_point TEXT NOT NULL,
    drop_point TEXT,
    per_km_cost DECIMAL(10, 2) DEFAULT 5.00,
    total_cost DECIMAL(10, 2),
    current_longitude VARCHAR(100),
    current_latitude VARCHAR(100),
    dropoff_longitude VARCHAR(100),
    dropoff_latitude VARCHAR(100),
    travel_date DATE DEFAULT CURRENT_DATE,
    travel_status VARCHAR(20) DEFAULT 'ONGOING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create TRAVEL_HISTORY table
CREATE TABLE travel_history (
    history_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profile(user_id),
    travel_date DATE DEFAULT CURRENT_DATE,
    travel_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pick_point TEXT,
    drop_point TEXT,
    total_cost DECIMAL(10, 2),
    remaining_balance DECIMAL(10, 2)
);

-- Create RECHARGE_HISTORY table
CREATE TABLE recharge_history (
    recharge_id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_profile(user_id),
    recharge_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    recharge_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50)
);

-- Insert sample data
INSERT INTO user_profile (name, email, phone, card_id, balance, dob, address, password)
VALUES 
    ('John Doe', 'john.doe@example.com', '+123456789', '520028A3A0', 500, '1996-04-12', '123 Street, City, Country', 'hashed_password'),
    ('Jane Smith', 'jane.smith@example.com', '+987654321', '520028B840', 1000, '1992-05-15', '456 Avenue, Town, Country', 'hashed_password'),
    ('Mike Johnson', 'mike.johnson@example.com', '+1122334450', '520026D872', 750, '1998-02-22', '789 Boulevard, City, Country', 'hashed_password');

-- Insert sample buses
INSERT INTO bus_info (bus_id) VALUES ('B1'), ('B2');

-- Verify the setup
SELECT 'Tables created successfully!' as status;
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;
