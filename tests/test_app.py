import pytest
from httpx import AsyncClient

from dubhack.app import app


@pytest.mark.asyncio
async def test_healthcheck_root() -> None:
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.get("/")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
