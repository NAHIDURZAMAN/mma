-- Fix the user_id sequence to avoid duplicate key errors
-- Execute this in your Supabase SQL Editor

-- First, check the current maximum user_id
SELECT MAX(user_id) FROM user_profile;

-- Reset the sequence to start from the next available number
-- Replace 'XX' with the number that's one more than the MAX(user_id) from above
SELECT setval('user_id_seq', (SELECT MAX(user_id) FROM user_profile));

-- Alternative: If the sequence doesn't exist, create it
-- CREATE SEQUENCE IF NOT EXISTS user_id_seq;

-- Check current sequence value
SELECT currval('user_id_seq');

-- Test the sequence
SELECT nextval('user_id_seq');