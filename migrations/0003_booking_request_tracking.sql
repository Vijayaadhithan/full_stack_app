-- Migration to add booking request tracking and notification features

-- 1. Add expiration date to bookings table
ALTER TABLE bookings ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE bookings ADD COLUMN expires_at TIMESTAMP;

-- 2. Create booking history table to track status changes
CREATE TABLE booking_history (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER REFERENCES bookings(id),
  status TEXT NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  changed_by INTEGER REFERENCES users(id),
  comments TEXT
);

-- 3. Add index on notifications for faster retrieval by type
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- 4. Add index on bookings for faster expiration checks
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_expires_at ON bookings(expires_at);

-- 5. Create function to set expiration date on booking creation
CREATE OR REPLACE FUNCTION set_booking_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'pending' THEN
    NEW.expires_at = NOW() + INTERVAL '7 days';
  ELSE
    NEW.expires_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger to set expiration date on booking creation and update
CREATE TRIGGER set_booking_expiration_trigger
BEFORE INSERT OR UPDATE ON bookings
FOR EACH ROW
EXECUTE FUNCTION set_booking_expiration();

-- 7. Create function to automatically delete expired pending bookings
CREATE OR REPLACE FUNCTION delete_expired_bookings()
RETURNS void AS $$
DECLARE
  expired_booking RECORD;
BEGIN
  FOR expired_booking IN 
    SELECT * FROM bookings 
    WHERE status = 'pending' AND expires_at < NOW()
  LOOP
    -- Create notification for customer
    INSERT INTO notifications (user_id, type, title, message, is_read, created_at)
    VALUES (
      expired_booking.customer_id,
      'booking_expired',
      'Booking Request Expired',
      'Your booking request has expired as the service provider did not respond within 7 days.',
      false,
      NOW()
    );
    
    -- Update booking status to 'expired'
    UPDATE bookings SET status = 'expired' WHERE id = expired_booking.id;
    
    -- Add to booking history
    INSERT INTO booking_history (booking_id, status, changed_at, comments)
    VALUES (expired_booking.id, 'expired', NOW(), 'Automatically expired after 7 days');
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 8. Create a scheduled job to run the expired bookings cleanup
-- Note: This requires pg_cron extension to be enabled
-- If pg_cron is not available, this can be handled by a server-side scheduled task
-- Uncomment if pg_cron is available:
-- SELECT cron.schedule('0 0 * * *', 'SELECT delete_expired_bookings()');