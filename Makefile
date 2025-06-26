# Cricket Platform Development Makefile

.PHONY: help install dev server db-start db-stop db-reset db-studio build test lint format clean setup stop restart

help: ## Show this help message
	@echo "Cricket Platform Development Commands"
	@echo "====================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# =============================================================================
# Main Development Commands (most commonly used)
# =============================================================================

dev: ## Start full development environment (database + server)
	@echo "🚀 Starting full development environment..."
	@echo "🗄️  Starting Supabase..."
	@npx supabase start
	@echo "✅ Supabase started!"
	@echo "🚀 Starting Next.js development server..."
	@pnpm dev

server: ## Start only the Next.js development server
	@echo "🚀 Starting Next.js development server..."
	@pnpm dev

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

db-start: ## Start only the database (Supabase)
	@echo "🗄️  Starting Supabase..."
	@npx supabase start
	@echo "✅ Supabase started! Check 'npx supabase status' for details."

db-stop: ## Stop only the database
	@echo "🛑 Stopping Supabase..."
	@npx supabase stop
	@echo "✅ Supabase stopped."

db-reset: ## Reset database to initial state
	@echo "🔄 Resetting database..."
	@npx supabase db reset
	@echo "✅ Database reset complete."

db-studio: ## Open Supabase Studio in browser
	@echo "🎨 Opening Supabase Studio..."
	@echo "Visit http://localhost:54323 to access Supabase Studio"
	@open http://localhost:54323 2>/dev/null || echo "Please visit http://localhost:54323 manually"

# =============================================================================
# Project Setup & Dependencies
# =============================================================================

install: ## Install project dependencies
	@echo "📦 Installing dependencies..."
	@pnpm install

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
	@pnpm build

test: ## Run all tests
	@echo "🧪 Running tests..."
	@pnpm test

lint: ## Run code linter
	@echo "🔍 Running linter..."
	@pnpm lint

format: ## Format code with prettier
	@echo "✨ Formatting code..."
	@pnpm format

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