# Cricket Platform Development Makefile

.PHONY: help docker-check install dev server db-start db-stop db-migrate db-reset db-studio build test test-watch coverage check lint format clean setup stop restart types

help: ## Show this help message
	@echo "Cricket Platform Development Commands"
	@echo "====================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# Main Development Commands (most commonly used)
# =============================================================================

docker-check: ## Verify Docker daemon is reachable (Supabase runs in Docker)
	@if ! docker info >/dev/null 2>&1; then \
		echo ""; \
		echo "❌  Docker daemon is not reachable from WSL."; \
		echo ""; \
		echo "   Docker Desktop is running on Windows but WSL integration is off."; \
		echo "   Fix (one-time):"; \
		echo "     1. Docker Desktop → Settings → Resources → WSL Integration"; \
		echo "     2. Enable 'default WSL distro' + this distro, Apply & Restart"; \
		echo "     3. In PowerShell: wsl --shutdown, then reopen this terminal"; \
		echo ""; \
		echo "   Verify with: docker info"; \
		exit 1; \
	fi; \
	echo "✅  Docker is running"

dev: docker-check ## Start full development environment (database + server)
	@echo "🚀 Starting full development environment..."
	@echo "🗄️  Starting Supabase..."
	@npx supabase start
	@echo "✅ Supabase started!"
	@echo "📦 Applying pending database migrations (if any)..."
	@-npx supabase migration up
	@echo "🚀 Starting Next.js development server (hot reload enabled)..."
	@npm run dev

server: ## Start only the Next.js development server
	@echo "🚀 Starting Next.js development server..."
	@npm run dev

stop: ## Stop all development services
	@echo "🛑 Stopping all services..."
	@npx supabase stop
	@echo "✅ All services stopped."

restart: ## Restart the full development environment
	@echo "🔄 Restarting development environment..."
	@$(MAKE) stop
	@$(MAKE) dev

# =============================================================================
# Database Commands
# =============================================================================

db-start: docker-check ## Start only the database (Supabase)
	@echo "🗄️  Starting Supabase..."
	@npx supabase start
	@echo "📦 Applying pending database migrations (if any)..."
	@-npx supabase migration up
	@echo "✅ Supabase started! Check 'npx supabase status' for details."

db-migrate: ## Apply pending database migrations to a running Supabase
	@echo "📦 Applying pending database migrations..."
	@npx supabase migration up
	@echo "✅ Migrations applied. Run 'make types' if the schema changed."

db-stop: ## Stop only the database
	@echo "🛑 Stopping Supabase..."
	@npx supabase stop
	@echo "✅ Supabase stopped."

db-reset: docker-check ## Reset database to initial state
	@echo "🔄 Resetting database..."
	@npx supabase db reset
	@echo "✅ Database reset complete."

db-studio: ## Open Supabase Studio in browser
	@echo "🎨 Opening Supabase Studio..."
	@echo "Visit http://localhost:54323 to access Supabase Studio"
	@open http://localhost:54323 2>/dev/null || echo "Please visit http://localhost:54323 manually"

types: ## Regenerate Supabase database types (requires local Supabase running)
	@echo "🔧 Regenerating database types..."
	@npm run db:types
	@echo "✅ Types written to src/lib/supabase/types.ts"

# =============================================================================
# Project Setup & Dependencies
# =============================================================================

install: ## Install project dependencies
	@echo "📦 Installing dependencies..."
	@npm install

setup: ## Initial project setup (install deps + start database)
	@echo "🚀 Setting up development environment..."
	@$(MAKE) install
	@$(MAKE) db-start
	@echo "✅ Setup complete! Run 'make dev' to start development."

# =============================================================================
# Build & Quality
# =============================================================================

build: ## Build the application for production
	@echo "🏗️  Building application..."
	@npm run build

test: ## Run automated tests
	@echo "🧪 Running tests..."
	@npm run test

test-watch: ## Run tests in watch mode
	@echo "🧪 Running tests in watch mode..."
	@npm run test:watch

coverage: ## Generate test coverage report
	@echo "📊 Generating coverage..."
	@npm run test:coverage

check: ## Run lint + typecheck + tests (quality gate)
	@echo "🔍 Running quality checks..."
	@npm run check

lint: ## Run code linter
	@echo "🔍 Running linter..."
	@npm run lint

format: ## Format code with prettier
	@echo "✨ Formatting code..."
	@npm run format

# =============================================================================
# Maintenance & Cleanup
# =============================================================================

clean: ## Clean up everything (stop services, remove deps, build artifacts)
	@echo "🧹 Cleaning up..."
	@$(MAKE) stop
	@rm -rf node_modules .next
	@echo "✅ Cleanup complete."

# =============================================================================
# Quick Start Commands
# =============================================================================

start: ## Alias for 'dev' - start full development environment
	@$(MAKE) dev

first-time: ## Complete first-time setup and start development
	@echo "🎯 First time setup..."
	@$(MAKE) setup
	@echo ""
	@echo "🎉 Ready to develop!"
	@echo "Next steps:"
	@echo "  1. Run 'make dev' to start full development environment"
	@echo "  2. Visit http://localhost:3001 for your app"
	@echo "  3. Visit http://localhost:54323 for Supabase Studio"