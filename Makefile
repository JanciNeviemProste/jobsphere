.PHONY: help dev build test lint clean db-reset db-migrate db-seed compose-up compose-down compose-logs

help: ## Zobrazí túto help správu
	@echo "JobSphere - Dostupné príkazy:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

dev: ## Spustí development server
	pnpm dev

build: ## Build produkčnej verzie
	pnpm build

test: ## Spustí unit testy
	pnpm test

e2e: ## Spustí E2E testy
	pnpm test:e2e

lint: ## Spustí linter
	pnpm lint

typecheck: ## Type checking
	pnpm typecheck

clean: ## Vyčistí node_modules a build súbory
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	rm -rf apps/*/.next apps/*/dist packages/*/dist
	rm -rf .turbo apps/*/.turbo packages/*/.turbo

compose-up: ## Spustí Docker Compose stack
	docker-compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "✅ Services running:"
	@echo "  - PostgreSQL:   localhost:5432"
	@echo "  - Redis:        localhost:6379"
	@echo "  - MinIO:        localhost:9000 (console: 9001)"
	@echo "  - Meilisearch:  localhost:7700"
	@echo "  - ClamAV:       localhost:3310"
	@echo "  - MailHog UI:   http://localhost:8025"

compose-down: ## Zastaví Docker Compose stack
	docker-compose down

compose-logs: ## Zobrazí logy z Docker Compose
	docker-compose logs -f

compose-reset: ## Vyčistí všetko a spustí znova
	docker-compose down -v
	docker-compose up -d

db-reset: ## Resetuje databázu (DEV ONLY!)
	@echo "⚠️  Resetujem databázu..."
	cd apps/web && pnpm prisma migrate reset --force

db-migrate: ## Spustí Prisma migrácie
	cd apps/web && pnpm prisma migrate dev

db-seed: ## Seed databázy s demo dátami
	cd apps/web && pnpm prisma db seed

db-studio: ## Otvorí Prisma Studio
	cd apps/web && pnpm prisma studio

install: ## Nainštaluje závislosti
	pnpm install

setup: compose-up install db-migrate db-seed ## Kompletný setup (compose + install + migrate + seed)
	@echo ""
	@echo "✅ Setup dokončený!"
	@echo ""
	@echo "Spusti development server:"
	@echo "  make dev"
	@echo ""
	@echo "Alebo manuálne:"
	@echo "  cd apps/web && pnpm dev"
