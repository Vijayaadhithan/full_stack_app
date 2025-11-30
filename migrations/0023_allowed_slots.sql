-- Allow providers to configure which broad slots they offer
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS allowed_slots jsonb
  DEFAULT '["morning","afternoon","evening"]';
