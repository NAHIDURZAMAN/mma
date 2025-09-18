-- Enhanced RECHARGE_HISTORY table for PostgreSQL/Supabase
-- Run this SQL in your Supabase SQL editor to update the recharge_history table

-- First, check if the table exists and add missing columns
DO $$
BEGIN
    -- Add transaction_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'recharge_history' 
                   AND column_name = 'transaction_id') THEN
        ALTER TABLE recharge_history ADD COLUMN transaction_id VARCHAR(255);
    END IF;
    
    -- Add status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'recharge_history' 
                   AND column_name = 'status') THEN
        ALTER TABLE recharge_history ADD COLUMN status VARCHAR(50) DEFAULT 'completed';
    END IF;
    
    -- Update payment_method constraint to include stripe
    BEGIN
        ALTER TABLE recharge_history DROP CONSTRAINT IF EXISTS recharge_history_payment_method_check;
        ALTER TABLE recharge_history ADD CONSTRAINT recharge_history_payment_method_check 
            CHECK (payment_method IN ('CARD', 'BKASH', 'NAGAD', 'ROCKET', 'UPAY', 'stripe'));
    EXCEPTION WHEN OTHERS THEN
        -- Constraint might not exist, continue
        NULL;
    END;
END $$;

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_recharge_history_transaction_id ON recharge_history(transaction_id);
CREATE INDEX IF NOT EXISTS idx_recharge_history_status ON recharge_history(status);

-- Insert some sample data for testing (optional)
INSERT INTO recharge_history (user_id, recharge_amount, payment_method, transaction_id, status)
VALUES 
    ('U000001', 500.00, 'stripe', 'pi_test_123456', 'completed'),
    ('U000002', 1000.00, 'BKASH', 'bkash_789012', 'completed'),
    ('U000003', 750.00, 'stripe', 'pi_test_345678', 'completed')
ON CONFLICT DO NOTHING;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'recharge_history' 
ORDER BY ordinal_position;