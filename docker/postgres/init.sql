-- Initialize Cricket Platform Database
-- This script runs when the PostgreSQL container starts for the first time

-- Create additional extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Grant all privileges to the cricket_user
GRANT ALL PRIVILEGES ON DATABASE cricket_platform TO cricket_user;

-- Create schemas if needed
-- CREATE SCHEMA IF NOT EXISTS cricket AUTHORIZATION cricket_user;

-- Set default search path
-- ALTER DATABASE cricket_platform SET search_path TO cricket, public; 