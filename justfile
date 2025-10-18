default:
	@just --list

install:
	uv sync

fmt:
	uv run ruff check --fix .
	uv run black .

lint:
	uv run ruff check .

test:
	uv run pytest

dev:
	uv run fastapi dev main.py
