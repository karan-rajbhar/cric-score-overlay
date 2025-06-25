.PHONY: help setup dev dev-db dev-stop clean install build test lint format db-migrate db-seed db-reset db-studio

# Default target
help: ## Show this help message
	@echo "🏏 Cricket Platform Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

setup: ## Initial setup - create .env.local and install dependencies
	@echo "🏏 Setting up Cricket Platform Development Environment..."
	@if [ ! -f .env.local ]; then \
		echo "📝 Creating .env.local file..."; \
		echo "# Development Environment Variables" > .env.local; \
		echo "DATABASE_URL=\"postgresql://cricket_user:cricket_password@localhost:5432/cricket_platform\"" >> .env.local; \
		echo "REDIS_URL=\"redis://localhost:6379\"" >> .env.local; \
		echo "NODE_ENV=\"development\"" >> .env.local; \
		echo "NEXTAUTH_SECRET=\"dev-secret-change-in-production\"" >> .env.local; \
		echo "NEXTAUTH_URL=\"http://localhost:3000\"" >> .env.local; \
		echo "NEXT_PUBLIC_SUPABASE_URL=\"\"" >> .env.local; \
		echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=\"\"" >> .env.local; \
		echo "SUPABASE_SERVICE_ROLE_KEY=\"\"" >> .env.local; \
		echo "SKIP_ENV_VALIDATION=\"true\"" >> .env.local; \
	fi
	@echo "📦 Installing dependencies..."
	@pnpm install
	@echo "✅ Setup complete!"

dev-db: ## Start database services with Docker
	@echo "🐘 Starting PostgreSQL and Redis with Docker..."
	@docker-compose up -d
	@echo "⏳ Waiting for services to be ready..."
	@sleep 5
	@echo "✅ Database services are running!"

dev-stop: ## Stop database services
	@echo "🛑 Stopping Docker services..."
	@docker-compose down
	@echo "✅ Services stopped!"

dev: dev-db ## Start full development environment
	@echo "🔧 Generating Prisma client..."
	@pnpm prisma generate
	@echo "🗃️ Running database migrations..."
	@pnpm prisma migrate dev --name init
	@echo "🌱 Seeding database..."
	@pnpm prisma db seed 2>/dev/null || echo "ℹ️ No seed script found, skipping..."
	@echo ""
	@echo "✅ Development environment ready!"
	@echo ""
	@echo "🚀 To start the application run:"
	@echo "   make start"
	@echo ""
	@echo "📊 Database: postgresql://cricket_user:cricket_password@localhost:5432/cricket_platform"
	@echo "🔴 Redis: redis://localhost:6379"
	@echo "🌐 App will run at: http://localhost:3000"

start: ## Start the Next.js development server
	@echo "🚀 Starting Next.js development server..."
	@pnpm dev

install: ## Install dependencies
	@echo "📦 Installing dependencies..."
	@pnpm install

build: ## Build the application for production
	@echo "🏗️ Building application..."
	@pnpm build

test: ## Run tests
	@echo "🧪 Running tests..."
	@pnpm test

lint: ## Run linter
	@echo "🔍 Running linter..."
	@pnpm lint

format: ## Format code
	@echo "✨ Formatting code..."
	@pnpm format 2>/dev/null || echo "ℹ️ No format script found"

db-migrate: ## Run database migrations
	@echo "🗃️ Running database migrations..."
	@pnpm prisma migrate dev

db-seed: ## Seed the database
	@echo "🌱 Seeding database..."
	@pnpm prisma db seed

db-reset: ## Reset database (drop and recreate)
	@echo "🔄 Resetting database..."
	@pnpm prisma migrate reset --force

db-studio: ## Open Prisma Studio
	@echo "🎨 Opening Prisma Studio..."
	@pnpm prisma studio

clean: ## Clean up Docker containers and volumes
	@echo "🧹 Cleaning up..."
	@docker-compose down -v
	@docker system prune -f
	@echo "✅ Cleanup complete!"

# Development workflow targets
first-time: setup dev ## Complete first-time setup and start development environment

restart: dev-stop dev ## Restart the development environment 