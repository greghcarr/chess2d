-- Run this in your Supabase SQL editor (Dashboard > SQL Editor)

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  losses INTEGER DEFAULT 0 NOT NULL,
  draws INTEGER DEFAULT 0 NOT NULL,
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

-- Users can only insert their own profile
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

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
