CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  age INTEGER,
  gender VARCHAR(50),
  height_cm FLOAT,
  weight_kg FLOAT,
  experience_level VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'in_progress'
);

CREATE TABLE IF NOT EXISTS pose_practices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  pose_name VARCHAR(255),
  pose_sanskrit VARCHAR(255),
  pose_category VARCHAR(100),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds FLOAT,
  stopped_by VARCHAR(50),
  status VARCHAR(50) DEFAULT 'completed'
);

CREATE TABLE IF NOT EXISTS app_config (
  key VARCHAR(255) PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO app_config (key, value) VALUES
('homepage_disclaimer', 'This app is designed for individuals
who already have a foundational understanding of yoga and are
participating under professional guidance. Please consult your
instructor before beginning.')
ON CONFLICT (key) DO NOTHING;
