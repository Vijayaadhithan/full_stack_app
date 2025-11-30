-- Migration: Simplify booking system with broad time slots
-- Add time slot labels and provider availability toggle

-- 1. Add time_slot_label column to bookings table
ALTER TABLE bookings 
ADD COLUMN time_slot_label TEXT 
CHECK (time_slot_label IN ('morning', 'afternoon', 'evening'));

-- 2. Add index on time_slot_label for performance
CREATE INDEX IF NOT EXISTS idx_bookings_time_slot_label 
ON bookings(time_slot_label);

-- 3. Auto-categorize existing bookings based on their time
-- Morning: 6:00 - 12:00
-- Afternoon: 12:00 - 17:00  
-- Evening: 17:00 - 23:59
UPDATE bookings
SET time_slot_label = CASE
  WHEN EXTRACT(HOUR FROM booking_date) >= 6 AND EXTRACT(HOUR FROM booking_date) < 12 THEN 'morning'
  WHEN EXTRACT(HOUR FROM booking_date) >= 12 AND EXTRACT(HOUR FROM booking_date) < 17 THEN 'afternoon'
  ELSE 'evening'
END
WHERE time_slot_label IS NULL;

-- 4. Add availability toggle fields to services table
ALTER TABLE services 
ADD COLUMN is_available_now BOOLEAN DEFAULT true NOT NULL;

ALTER TABLE services 
ADD COLUMN availability_note TEXT;

-- 5. Add index on is_available_now for filtering
CREATE INDEX IF NOT EXISTS idx_services_is_available_now 
ON services(is_available_now);

-- 6. Make working_hours, break_time, buffer_time optional (already JSONB, so nullable by default)
-- No changes needed - these fields are already nullable

-- 7. Add comment for documentation
COMMENT ON COLUMN bookings.time_slot_label IS 'Broad time slot: morning (6-12), afternoon (12-17), evening (17-24)';
COMMENT ON COLUMN services.is_available_now IS 'Uber-style availability toggle - provider is currently accepting bookings';
COMMENT ON COLUMN services.availability_note IS 'Optional note explaining unavailability (e.g., "Back at 3 PM")';
