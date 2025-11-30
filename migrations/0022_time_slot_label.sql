-- Broader day-part booking support
-- Track the labeled slot customers pick (morning/afternoon/evening)
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS time_slot_label text;

-- Helpful for quickly checking conflicts by day + slot
CREATE INDEX IF NOT EXISTS idx_bookings_service_date_slot
  ON bookings (service_id, booking_date, time_slot_label);
