default:
	@just --list

install:
	uv sync
	just client/install


fmt:
	uv run ruff check --fix .
	uv run black .
	just client/fmt

lint:
	uv run ruff check .
	just client/lint

test:
	uv run pytest

dev-server:
	uv run fastapi dev main.py


dev-client:
	just client/dev

db-up:
	echo "🧹 Starting Redis container..."
	docker compose up -d
	echo "✅ Redis started."

db-down:
	echo "🧹 Stopping Redis container..."
	docker compose down
	echo "✅ Redis stopped."

db-wipe:
	echo "🧹 Wiping Redis container..."
	docker exec -it secondbrain-redis redis-cli FLUSHALL
	echo "✅ Redis Wiped"
