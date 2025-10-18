"""Application entrypoint and route definitions for the dubhack service."""

from fastapi import FastAPI


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    app = FastAPI(title="dubhack")

    @app.get("/", tags=["health"])
    async def read_root() -> dict[str, str]:
        """Basic liveness probe endpoint."""
        return {"status": "ok"}

    return app


app = create_app()
