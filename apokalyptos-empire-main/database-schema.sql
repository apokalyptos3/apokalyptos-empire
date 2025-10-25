-- ═══════════════════════════════════════════════════════════════
-- APOKALYPTOS EMPIRE - DATABASE SCHEMA
-- PostgreSQL Database Structure
-- Version 1.0
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pg_crypto for encryption
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ═══════════════════════════════════════════════════════════════
-- USERS & AUTHENTICATION
-- ═══════════════════════════════════════════════════════════════

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  language VARCHAR(10) DEFAULT 'en' CHECK (language IN ('en', 'ar', 'no')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false
);

-- User API Keys (encrypted)
CREATE TABLE user_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  service VARCHAR(100) NOT NULL CHECK (service IN (
    'anthropic_claude',
    'openai',
    'google_gemini',
    'grok',
    'youtube',
    'tiktok',
    'twitter',
    'instagram',
    'elevenlabs',
    'runway',
    'midjourney',
    'other'
  )),
  encrypted_key TEXT NOT NULL,
  iv TEXT NOT NULL, -- Initialization vector for encryption
  auth_tag TEXT NOT NULL, -- Authentication tag for encryption
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, service)
);

-- User Settings
CREATE TABLE user_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  monthly_budget DECIMAL(10,2) DEFAULT 100.00 CHECK (monthly_budget >= 0),
  auto_publish BOOLEAN DEFAULT false,
  notification_preferences JSONB DEFAULT '{
    "email": true,
    "push": true,
    "agent_updates": true,
    "budget_alerts": true,
    "content_ready": true
  }'::jsonb,
  atopia_assistance_level VARCHAR(20) DEFAULT 'balanced' CHECK (atopia_assistance_level IN ('subtle', 'balanced', 'active')),
  atopia_suggestion_frequency VARCHAR(20) DEFAULT 'paragraphs' CHECK (atopia_suggestion_frequency IN ('ask', 'paragraphs', 'realtime')),
  default_ai_model VARCHAR(100) DEFAULT 'auto',
  timezone VARCHAR(50) DEFAULT 'UTC',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ═══════════════════════════════════════════════════════════════
-- CHANNELS & PLATFORMS
-- ═══════════════════════════════════════════════════════════════

-- Channels
CREATE TABLE channels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'twitter', 'instagram', 'reddit', 'linkedin')),
  channel_name VARCHAR(255) NOT NULL,
  channel_id VARCHAR(255) NOT NULL, -- Platform-specific channel ID
  channel_url TEXT,
  api_connected BOOLEAN DEFAULT false,
  api_token_encrypted TEXT,
  api_token_iv TEXT,
  api_token_auth_tag TEXT,
  strategy JSONB DEFAULT '{
    "content_type": "mixed",
    "posting_frequency": "daily",
    "target_audience": "general",
    "monetization_strategy": "standard"
  }'::jsonb,
  subscriber_count INTEGER DEFAULT 0,
  total_views BIGINT DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.00,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, platform, channel_id)
);

-- Create index for faster channel lookups
CREATE INDEX idx_channels_user_id ON channels(user_id);
CREATE INDEX idx_channels_platform ON channels(platform);
CREATE INDEX idx_channels_api_connected ON channels(api_connected);

-- ═══════════════════════════════════════════════════════════════
-- STORIES & CONTENT
-- ═══════════════════════════════════════════════════════════════

-- Stories (user uploads)
CREATE TABLE stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(500),
  content TEXT NOT NULL,
  word_count INTEGER GENERATED ALWAYS AS (
    array_length(regexp_split_to_array(content, '\s+'), 1)
  ) STORED,
  style_analysis JSONB DEFAULT '{}'::jsonb,
  atopia_confidence DECIMAL(5,2) DEFAULT 0.00 CHECK (atopia_confidence BETWEEN 0 AND 100),
  genre VARCHAR(100),
  themes TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Content Library
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  story_id UUID REFERENCES stories(id) ON DELETE SET NULL,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  
  -- Content details
  title VARCHAR(500) NOT NULL,
  description TEXT,
  platform VARCHAR(50) NOT NULL CHECK (platform IN ('youtube', 'tiktok', 'twitter', 'instagram', 'reddit', 'linkedin')),
  format VARCHAR(50) NOT NULL CHECK (format IN ('tiktok_short', 'youtube_short', 'youtube_long', 'twitter_video', 'instagram_reel', 'linkedin_video')),
  style VARCHAR(50) CHECK (style IN ('cinematic', 'documentary', 'anime', 'abstract', 'educational', 'entertainment')),
  
  -- Status tracking
  status VARCHAR(50) DEFAULT 'draft' CHECK (status IN ('draft', 'queued', 'processing', 'ready', 'published', 'failed', 'archived')),
  processing_stage VARCHAR(100), -- script, video, audio, assembly, publishing
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  error_message TEXT,
  
  -- File URLs
  video_url TEXT,
  thumbnail_url TEXT,
  audio_url TEXT,
  script_url TEXT,
  
  -- Content metadata
  duration INTEGER, -- in seconds
  file_size BIGINT, -- in bytes
  resolution VARCHAR(20), -- 1080p, 4K, etc.
  aspect_ratio VARCHAR(20), -- 16:9, 9:16, etc.
  
  -- Financial
  cost DECIMAL(10,2) DEFAULT 0.00,
  estimated_revenue DECIMAL(10,2) DEFAULT 0.00,
  actual_revenue DECIMAL(10,2) DEFAULT 0.00,
  roi DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE 
      WHEN cost > 0 THEN ((actual_revenue - cost) / cost * 100)
      ELSE 0
    END
  ) STORED,
  
  -- Performance metrics
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  engagement_rate DECIMAL(5,2) DEFAULT 0.00,
  watch_time_minutes INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  published_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_content_user_id ON content(user_id);
CREATE INDEX idx_content_status ON content(status);
CREATE INDEX idx_content_platform ON content(platform);
CREATE INDEX idx_content_published_at ON content(published_at DESC);
CREATE INDEX idx_content_created_at ON content(created_at DESC);
CREATE INDEX idx_content_story_id ON content(story_id);

-- ═══════════════════════════════════════════════════════════════
-- AI AGENTS
-- ═══════════════════════════════════════════════════════════════

-- Agent States
CREATE TABLE agent_states (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL CHECK (agent_id BETWEEN 1 AND 10),
  agent_name VARCHAR(100) NOT NULL CHECK (agent_name IN (
    'Oracle',
    'Harvester',
    'Visualizer',
    'Optimizer',
    'Guardian',
    'Creator',
    'Executor',
    'Tycoon',
    'Discovery',
    'ATOPIA'
  )),
  status VARCHAR(50) DEFAULT 'idle' CHECK (status IN ('idle', 'working', 'paused', 'error', 'sleeping')),
  current_task TEXT,
  progress INTEGER DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  performance_metrics JSONB DEFAULT '{
    "tasks_completed": 0,
    "tasks_failed": 0,
    "average_task_time": 0,
    "success_rate": 0
  }'::jsonb,
  UNIQUE(user_id, agent_id)
);

-- Agent Communications (log of agent discussions)
CREATE TABLE agent_communications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID, -- Group related communications
  agent_from INTEGER NOT NULL CHECK (agent_from BETWEEN 1 AND 10),
  agent_to INTEGER CHECK (agent_to BETWEEN 1 AND 10), -- NULL for broadcast
  message TEXT NOT NULL,
  message_type VARCHAR(50) DEFAULT 'info' CHECK (message_type IN ('info', 'question', 'decision', 'alert', 'error')),
  context JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_agent_comms_user_session ON agent_communications(user_id, session_id);
CREATE INDEX idx_agent_comms_created_at ON agent_communications(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- BUDGET & FINANCIAL TRACKING
-- ═══════════════════════════════════════════════════════════════

-- Budget Records
CREATE TABLE budget_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  
  -- What was purchased
  category VARCHAR(100) NOT NULL CHECK (category IN (
    'script_generation',
    'video_generation',
    'audio_synthesis',
    'image_generation',
    'music_generation',
    'ai_inference',
    'api_call',
    'storage',
    'bandwidth',
    'other'
  )),
  service VARCHAR(100) NOT NULL, -- OpenAI, ElevenLabs, Runway, etc.
  model VARCHAR(100), -- gpt-4, claude-3, etc.
  
  -- Cost details
  cost DECIMAL(10,2) NOT NULL CHECK (cost >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  tokens_used INTEGER,
  units_used DECIMAL(10,2), -- seconds of video, characters of text, etc.
  unit_type VARCHAR(50), -- 'seconds', 'characters', 'images', etc.
  
  -- Approval
  approved_by INTEGER, -- agent_id (usually Agent 8 - Tycoon)
  approval_reason TEXT,
  
  -- Cost optimization
  original_estimated_cost DECIMAL(10,2),
  savings DECIMAL(10,2) GENERATED ALWAYS AS (
    CASE 
      WHEN original_estimated_cost > 0 THEN (original_estimated_cost - cost)
      ELSE 0
    END
  ) STORED,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budget_user_date ON budget_records(user_id, created_at DESC);
CREATE INDEX idx_budget_content_id ON budget_records(content_id);
CREATE INDEX idx_budget_category ON budget_records(category);

-- Revenue Records
CREATE TABLE revenue_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  
  -- Revenue details
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency VARCHAR(3) DEFAULT 'USD',
  source VARCHAR(100) NOT NULL CHECK (source IN (
    'ad_revenue',
    'sponsorship',
    'affiliate',
    'merchandise',
    'subscription',
    'donation',
    'other'
  )),
  
  -- Platform-specific
  platform_payout_id VARCHAR(255),
  
  -- Date tracking
  revenue_date DATE NOT NULL,
  payout_date DATE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_revenue_user_date ON revenue_records(user_id, revenue_date DESC);
CREATE INDEX idx_revenue_channel ON revenue_records(channel_id);
CREATE INDEX idx_revenue_content ON revenue_records(content_id);

-- ═══════════════════════════════════════════════════════════════
-- TOOL DISCOVERY (Agent 9)
-- ═══════════════════════════════════════════════════════════════

-- Discovered Tools
CREATE TABLE discovered_tools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Tool identification
  tool_name VARCHAR(255) NOT NULL UNIQUE,
  tool_url TEXT,
  company VARCHAR(255),
  
  -- Categorization
  category VARCHAR(100) NOT NULL CHECK (category IN (
    'video_generation',
    'image_generation',
    'audio_synthesis',
    'music_generation',
    'text_generation',
    'video_editing',
    'image_editing',
    'voice_cloning',
    'translation',
    'other'
  )),
  subcategory VARCHAR(100),
  tags TEXT[],
  
  -- Availability
  free_tier_available BOOLEAN DEFAULT false,
  free_tier_details TEXT,
  free_tier_expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Pricing
  pricing JSONB DEFAULT '{
    "free": {},
    "paid_tiers": []
  }'::jsonb,
  
  -- Quality assessment
  tested BOOLEAN DEFAULT false,
  test_date TIMESTAMP WITH TIME ZONE,
  quality_score DECIMAL(3,1) CHECK (quality_score BETWEEN 0 AND 10),
  test_results JSONB,
  
  -- Recommendations
  recommendation VARCHAR(20) CHECK (recommendation IN ('high', 'medium', 'low', 'not_recommended')),
  recommendation_reason TEXT,
  integration_status VARCHAR(50) DEFAULT 'discovered' CHECK (integration_status IN (
    'discovered',
    'testing',
    'approved',
    'integrated',
    'rejected'
  )),
  
  -- Performance tracking
  times_used INTEGER DEFAULT 0,
  average_cost DECIMAL(10,2),
  average_quality DECIMAL(3,1),
  user_satisfaction DECIMAL(3,1),
  
  discovered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tools_category ON discovered_tools(category);
CREATE INDEX idx_tools_free_tier ON discovered_tools(free_tier_available);
CREATE INDEX idx_tools_recommendation ON discovered_tools(recommendation);
CREATE INDEX idx_tools_integration_status ON discovered_tools(integration_status);

-- Tool Usage Log
CREATE TABLE tool_usage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tool_id UUID REFERENCES discovered_tools(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID REFERENCES content(id) ON DELETE SET NULL,
  
  -- Usage details
  task_type VARCHAR(100),
  cost DECIMAL(10,2),
  quality_rating DECIMAL(3,1) CHECK (quality_rating BETWEEN 0 AND 10),
  execution_time INTEGER, -- seconds
  success BOOLEAN,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tool_usage_tool_id ON tool_usage_log(tool_id);
CREATE INDEX idx_tool_usage_user_id ON tool_usage_log(user_id);

-- ═══════════════════════════════════════════════════════════════
-- LEARNING SYSTEM
-- ═══════════════════════════════════════════════════════════════

-- Learning Data (for all agents)
CREATE TABLE learning_data (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER NOT NULL CHECK (agent_id BETWEEN 1 AND 10),
  
  learning_type VARCHAR(100) NOT NULL CHECK (learning_type IN (
    'style',
    'prompt',
    'strategy',
    'cost_optimization',
    'quality_preference',
    'trend_pattern',
    'engagement_factor',
    'other'
  )),
  
  data JSONB NOT NULL,
  confidence DECIMAL(5,2) DEFAULT 0.00 CHECK (confidence BETWEEN 0 AND 100),
  
  -- Validation
  validated BOOLEAN DEFAULT false,
  validation_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_learning_user_agent ON learning_data(user_id, agent_id);
CREATE INDEX idx_learning_type ON learning_data(learning_type);

-- ATOPIA Style Profiles
CREATE TABLE atopia_style_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Learning progress
  analyzed_stories INTEGER DEFAULT 0,
  confidence DECIMAL(5,2) DEFAULT 0.00 CHECK (confidence BETWEEN 0 AND 100),
  
  -- Style characteristics
  tone TEXT[] DEFAULT '{}',
  pace TEXT[] DEFAULT '{}',
  vocabulary TEXT[] DEFAULT '{}',
  themes TEXT[] DEFAULT '{}',
  
  -- Detailed analysis
  sentence_structure JSONB DEFAULT '{
    "average_length": 0,
    "complexity": "medium",
    "patterns": []
  }'::jsonb,
  
  dialogue_style VARCHAR(100),
  character_depth VARCHAR(100),
  world_building VARCHAR(100),
  
  -- Embeddings for similarity matching
  style_embedding VECTOR(1536), -- If using pgvector extension
  
  -- Example snippets
  example_sentences TEXT[],
  example_paragraphs TEXT[],
  
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Prompt Library (successful prompts for reuse)
CREATE TABLE prompt_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id INTEGER CHECK (agent_id BETWEEN 1 AND 10),
  
  -- Prompt details
  task_type VARCHAR(100) NOT NULL,
  prompt_text TEXT NOT NULL,
  model_used VARCHAR(100),
  
  -- Performance
  success_rate DECIMAL(5,2) CHECK (success_rate BETWEEN 0 AND 100),
  average_cost DECIMAL(10,2),
  average_quality DECIMAL(3,1) CHECK (average_quality BETWEEN 0 AND 10),
  times_used INTEGER DEFAULT 0,
  
  -- Context
  works_best_for TEXT[],
  parameters JSONB DEFAULT '{}'::jsonb,
  
  is_favorite BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_prompts_user_task ON prompt_library(user_id, task_type);
CREATE INDEX idx_prompts_success ON prompt_library(success_rate DESC);

-- ═══════════════════════════════════════════════════════════════
-- SCHEDULING & PUBLISHING
-- ═══════════════════════════════════════════════════════════════

-- Scheduled Content
CREATE TABLE scheduled_content (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  content_id UUID REFERENCES content(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
  
  scheduled_time TIMESTAMP WITH TIME ZONE NOT NULL,
  timezone VARCHAR(50) DEFAULT 'UTC',
  
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'failed', 'cancelled')),
  
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  last_attempt TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  
  -- Platform response
  platform_post_id VARCHAR(255),
  platform_url TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scheduled_time ON scheduled_content(scheduled_time);
CREATE INDEX idx_scheduled_status ON scheduled_content(status);

-- ═══════════════════════════════════════════════════════════════
-- ANALYTICS & CACHING
-- ═══════════════════════════════════════════════════════════════

-- Analytics Cache
CREATE TABLE analytics_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  metric_name VARCHAR(100) NOT NULL,
  metric_period VARCHAR(50), -- 'daily', 'weekly', 'monthly', 'all_time'
  metric_value JSONB NOT NULL,
  
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  
  UNIQUE(user_id, metric_name, metric_period)
);

CREATE INDEX idx_analytics_cache_valid ON analytics_cache(valid_until);

-- ═══════════════════════════════════════════════════════════════
-- NOTIFICATIONS
-- ═══════════════════════════════════════════════════════════════

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'content_ready',
    'content_published',
    'budget_alert',
    'revenue_milestone',
    'agent_error',
    'new_tool_discovered',
    'system_update',
    'other'
  )),
  
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  
  action_url TEXT,
  action_label VARCHAR(100),
  
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id) WHERE read = false;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- ═══════════════════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════════════════

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stories_updated_at BEFORE UPDATE ON stories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════════════
-- VIEWS FOR COMMON QUERIES
-- ═══════════════════════════════════════════════════════════════

-- User Dashboard Stats View
CREATE OR REPLACE VIEW user_dashboard_stats AS
SELECT 
  u.id as user_id,
  u.email,
  u.name,
  COUNT(DISTINCT ch.id) as total_channels,
  COUNT(DISTINCT c.id) as total_content,
  COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'published') as published_content,
  COALESCE(SUM(c.views), 0) as total_views,
  COALESCE(SUM(c.actual_revenue), 0) as total_revenue,
  COALESCE(SUM(br.cost), 0) as total_spent,
  COALESCE(SUM(c.actual_revenue) - SUM(br.cost), 0) as net_profit,
  us.monthly_budget
FROM users u
LEFT JOIN channels ch ON ch.user_id = u.id
LEFT JOIN content c ON c.user_id = u.id
LEFT JOIN budget_records br ON br.user_id = u.id
LEFT JOIN user_settings us ON us.user_id = u.id
GROUP BY u.id, u.email, u.name, us.monthly_budget;

-- Agent Performance View
CREATE OR REPLACE VIEW agent_performance AS
SELECT 
  as_table.user_id,
  as_table.agent_id,
  as_table.agent_name,
  as_table.status,
  as_table.performance_metrics,
  COUNT(ac.id) as total_communications,
  as_table.last_active
FROM agent_states as_table
LEFT JOIN agent_communications ac ON ac.agent_from = as_table.agent_id AND ac.user_id = as_table.user_id
GROUP BY as_table.user_id, as_table.agent_id, as_table.agent_name, as_table.status, as_table.performance_metrics, as_table.last_active;

-- Monthly Revenue Summary View
CREATE OR REPLACE VIEW monthly_revenue_summary AS
SELECT 
  user_id,
  DATE_TRUNC('month', revenue_date) as month,
  SUM(amount) as total_revenue,
  COUNT(*) as transaction_count,
  AVG(amount) as average_transaction
FROM revenue_records
GROUP BY user_id, DATE_TRUNC('month', revenue_date);

-- ═══════════════════════════════════════════════════════════════
-- INITIAL DATA
-- ═══════════════════════════════════════════════════════════════

-- Insert default agent states for new users (handled by application)
-- This will be done in the backend when a user registers

-- ═══════════════════════════════════════════════════════════════
-- FUNCTIONS
-- ═══════════════════════════════════════════════════════════════

-- Function to calculate monthly budget usage
CREATE OR REPLACE FUNCTION get_monthly_budget_usage(p_user_id UUID, p_month DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total_spent DECIMAL,
  monthly_budget DECIMAL,
  usage_percentage DECIMAL,
  remaining_budget DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(br.cost), 0) as total_spent,
    us.monthly_budget,
    CASE 
      WHEN us.monthly_budget > 0 THEN (COALESCE(SUM(br.cost), 0) / us.monthly_budget * 100)
      ELSE 0
    END as usage_percentage,
    us.monthly_budget - COALESCE(SUM(br.cost), 0) as remaining_budget
  FROM user_settings us
  LEFT JOIN budget_records br ON br.user_id = us.user_id 
    AND DATE_TRUNC('month', br.created_at) = DATE_TRUNC('month', p_month)
  WHERE us.user_id = p_user_id
  GROUP BY us.user_id, us.monthly_budget;
END;
$$ LANGUAGE plpgsql;

-- Function to get Agent 4's savings this month
CREATE OR REPLACE FUNCTION get_monthly_savings(p_user_id UUID, p_month DATE DEFAULT CURRENT_DATE)
RETURNS DECIMAL AS $$
DECLARE
  total_savings DECIMAL;
BEGIN
  SELECT COALESCE(SUM(savings), 0) INTO total_savings
  FROM budget_records
  WHERE user_id = p_user_id
    AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', p_month);
  
  RETURN total_savings;
END;
$$ LANGUAGE plpgsql;

-- Function to update ATOPIA confidence based on stories count
CREATE OR REPLACE FUNCTION update_atopia_confidence()
RETURNS TRIGGER AS $$
DECLARE
  story_count INTEGER;
  new_confidence DECIMAL;
BEGIN
  -- Count user's stories
  SELECT COUNT(*) INTO story_count
  FROM stories
  WHERE user_id = NEW.user_id;
  
  -- Calculate confidence (increases with more stories, caps at 100)
  new_confidence := LEAST(100, (story_count * 15.0));
  
  -- Update or insert ATOPIA style profile
  INSERT INTO atopia_style_profiles (user_id, analyzed_stories, confidence)
  VALUES (NEW.user_id, story_count, new_confidence)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    analyzed_stories = story_count,
    confidence = new_confidence,
    updated_at = CURRENT_TIMESTAMP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_atopia_confidence_trigger
AFTER INSERT ON stories
FOR EACH ROW
EXECUTE FUNCTION update_atopia_confidence();

-- ═══════════════════════════════════════════════════════════════
-- PERFORMANCE OPTIMIZATIONS
-- ═══════════════════════════════════════════════════════════════

-- Add composite indexes for common queries
CREATE INDEX idx_content_user_status_created ON content(user_id, status, created_at DESC);
CREATE INDEX idx_budget_user_month ON budget_records(user_id, (DATE_TRUNC('month', created_at)));
CREATE INDEX idx_revenue_user_month ON revenue_records(user_id, (DATE_TRUNC('month', revenue_date)));

-- ═══════════════════════════════════════════════════════════════
-- SECURITY & ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════

-- Enable RLS on all user-specific tables
ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies (users can only access their own data)
-- Note: In production, you'd use Supabase auth.uid() or similar

CREATE POLICY user_api_keys_policy ON user_api_keys
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY user_settings_policy ON user_settings
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY channels_policy ON channels
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY stories_policy ON stories
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY content_policy ON content
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY agent_states_policy ON agent_states
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY agent_communications_policy ON agent_communications
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY budget_records_policy ON budget_records
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY revenue_records_policy ON revenue_records
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY learning_data_policy ON learning_data
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

CREATE POLICY notifications_policy ON notifications
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- ═══════════════════════════════════════════════════════════════
-- COMPLETION MESSAGE
-- ═══════════════════════════════════════════════════════════════

-- Database schema creation complete!
-- Run this script in your Supabase SQL Editor
-- Or via psql: psql -U postgres -d apokalyptos -f database-schema.sql

COMMENT ON SCHEMA public IS 'APOKALYPTOS Empire - Complete Database Schema v1.0';
