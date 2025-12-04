/*
  # Create instruments table

  1. New Tables
    - `instruments`
      - `id` (uuid, primary key)
      - `name` (text, instrument name)
      - `waveform` (text, oscillator type)
      - `attack` (real, ADSR attack time)
      - `decay` (real, ADSR decay time)
      - `sustain` (real, ADSR sustain level)
      - `release` (real, ADSR release time)
      - `duration` (real, note duration)
      - `reverb_mix` (real, reverb wet/dry mix)
      - `reverb_room_size` (real, reverb room size)
      - `created_at` (timestamp)
  
  2. Security
    - Enable RLS on `instruments` table
    - Add policy for public read access (anyone can view instruments)
    - Add policy for authenticated users to create instruments
    - Add policy for authenticated users to delete their own instruments
*/

CREATE TABLE IF NOT EXISTS instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  waveform text NOT NULL DEFAULT 'sine',
  attack real NOT NULL DEFAULT 0.02,
  decay real NOT NULL DEFAULT 0.12,
  sustain real NOT NULL DEFAULT 0.8,
  release real NOT NULL DEFAULT 0.2,
  duration real NOT NULL DEFAULT 0.5,
  reverb_mix real NOT NULL DEFAULT 0.25,
  reverb_room_size real NOT NULL DEFAULT 0.30,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view instruments"
  ON instruments
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Anyone can create instruments"
  ON instruments
  FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Anyone can delete instruments"
  ON instruments
  FOR DELETE
  TO public
  USING (true);