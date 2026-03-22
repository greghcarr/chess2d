-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)

-- Profiles table (extends auth.users — id is nullable for dev/test accounts)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT PRIMARY KEY,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  draws INTEGER DEFAULT 0 NOT NULL,
  pos_x REAL DEFAULT 500 NOT NULL,
  pos_y REAL DEFAULT 500 NOT NULL,
  hue INTEGER DEFAULT 200 NOT NULL,
  shape TEXT DEFAULT 'circle' NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Game results table
CREATE TABLE IF NOT EXISTS game_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  white_username TEXT NOT NULL,
  black_username TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('white_win', 'black_win', 'draw')),
  pgn TEXT DEFAULT '' NOT NULL,
  end_reason TEXT NOT NULL CHECK (end_reason IN (
    'checkmate', 'resignation', 'stalemate', 'timeout',
    'draw_agreement', 'threefold', 'fifty_move', 'insufficient'
  )),
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- RLS policies for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Anyone can read profiles (for leaderboards, viewing opponents)
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

-- Users can only insert their own profile (or dev accounts with null id)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR id IS NULL);

-- Users can only update their own profile (or dev accounts with null id)
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id OR id IS NULL);

-- RLS policies for game_results
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Anyone can read game results
CREATE POLICY "Game results are viewable by everyone"
  ON game_results FOR SELECT
  USING (true);

-- Server inserts game results via service role key (bypasses RLS)
-- No INSERT policy needed for regular users

-- Helper functions for incrementing stats (called by server via service role)
CREATE OR REPLACE FUNCTION increment_wins(player_username TEXT)
RETURNS void AS $$
  UPDATE profiles SET wins = wins + 1 WHERE username = player_username;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_losses(player_username TEXT)
RETURNS void AS $$
  UPDATE profiles SET losses = losses + 1 WHERE username = player_username;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_draws(player_username TEXT)
RETURNS void AS $$
  UPDATE profiles SET draws = draws + 1 WHERE username = player_username;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── NPC Stats ─────────────────────────────────────────────

-- Separate NPC win/loss/draw tracking on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS npc_wins INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS npc_losses INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS npc_draws INTEGER DEFAULT 0 NOT NULL;

-- Flag NPC games in results
ALTER TABLE game_results ADD COLUMN IF NOT EXISTS is_npc BOOLEAN DEFAULT false NOT NULL;

-- NPC stat increment functions
CREATE OR REPLACE FUNCTION increment_npc_wins(player_username TEXT)
RETURNS void AS $$
  UPDATE profiles SET npc_wins = npc_wins + 1 WHERE username = player_username;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_npc_losses(player_username TEXT)
RETURNS void AS $$
  UPDATE profiles SET npc_losses = npc_losses + 1 WHERE username = player_username;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_npc_draws(player_username TEXT)
RETURNS void AS $$
  UPDATE profiles SET npc_draws = npc_draws + 1 WHERE username = player_username;
$$ LANGUAGE sql SECURITY DEFINER;

-- ── Scenario Completions & Unlocks ────────────────────────

CREATE TABLE IF NOT EXISTS scenario_completions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT NOT NULL,
  scenario_id TEXT NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(username, scenario_id)
);

ALTER TABLE scenario_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Scenario completions are viewable by everyone"
  ON scenario_completions FOR SELECT
  USING (true);

-- Unlock storage on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlocked_shapes TEXT[] DEFAULT '{}' NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS unlocked_effects TEXT[] DEFAULT '{}' NOT NULL;

-- Player shape
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS shape TEXT DEFAULT 'circle' NOT NULL;
