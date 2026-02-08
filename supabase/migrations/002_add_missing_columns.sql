-- Add columns that may be missing from the original deployment
ALTER TABLE props ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE props ADD COLUMN IF NOT EXISTS resolution_criteria text;
ALTER TABLE props ADD COLUMN IF NOT EXISTS live_stats jsonb;
ALTER TABLE props ADD COLUMN IF NOT EXISTS player_name text;

-- Update category constraint to include 'degen'
ALTER TABLE props DROP CONSTRAINT IF EXISTS props_category_check;
ALTER TABLE props ADD CONSTRAINT props_category_check CHECK (category IN ('game', 'player', 'fun', 'degen'));
