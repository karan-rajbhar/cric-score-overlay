# Cricket Platform Development Makefile

.PHONY: help setup dev-db dev-stop clean install build dev test lint format db-migrate db-seed db-reset db-studio restart first-time

help: ## Show this help message
	@echo "Cricket Platform Development Commands"
	@echo "====================================="
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Main development workflow
setup: ## Initial setup - install deps and start database
	@echo "🚀 Setting up development environment..."
	@$(MAKE) install
	@$(MAKE) dev-db
	@echo "✅ Setup complete! Database is running."

dev-db: ## Start development database with Supabase
	@echo "🗄️  Starting Supabase local development..."
	@npx supabase start
	@echo "✅ Supabase started! Check 'npx supabase status' for details."

dev-stop: ## Stop development database
	@echo "🛑 Stopping Supabase..."
	@npx supabase stop
	@echo "✅ Supabase stopped."

clean: ## Clean up everything (stop containers, remove deps)
	@echo "🧹 Cleaning up..."
	@$(MAKE) dev-stop
	@rm -rf node_modules
	@rm -rf .next
	@echo "✅ Cleanup complete."

# Package management
install: ## Install dependencies
	@echo "📦 Installing dependencies..."
	@pnpm install

# Build and development
build: ## Build the application
	@echo "🏗️  Building application..."
	@pnpm build

dev: ## Start development server
	@echo "🚀 Starting development server..."
	@pnpm dev

# Testing and quality
test: ## Run tests
	@echo "🧪 Running tests..."
	@pnpm test

lint: ## Run linter
	@echo "🔍 Running linter..."
	@pnpm lint

format: ## Format code
	@echo "✨ Formatting code..."
	@pnpm format

# Database operations
db-migrate: ## Run database migrations
	@echo "🔄 Running database migrations..."
	@npx supabase db reset

db-seed: ## Seed the database
	@echo "🌱 Seeding database..."
	@npx supabase db reset --linked

db-reset: ## Reset database
	@echo "🔄 Resetting database..."
	@npx supabase db reset

db-studio: ## Open Supabase Studio
	@echo "🎨 Opening Supabase Studio..."
	@echo "Visit http://localhost:54323 to access Supabase Studio"

# Convenience workflows
restart: ## Restart everything
	@echo "🔄 Restarting development environment..."
	@$(MAKE) dev-stop
	@$(MAKE) dev-db
	@echo "✅ Restart complete!"

first-time: ## First time setup (run this once)
	@echo "🎯 First time setup..."
	@$(MAKE) setup
	@echo ""
	@echo "🎉 Ready to develop!"
	@echo "Next steps:"
	@echo "  1. Run 'make dev' to start the development server"
	@echo "  2. Visit http://localhost:3000"
	@echo "  3. Visit http://localhost:54323 for Supabase Studio"