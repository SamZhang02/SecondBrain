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


