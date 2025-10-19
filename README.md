# Second Brain

Second Brain helps you explore the latent connections inside your reading list. Upload any mix of PDFs or text files and the app will extract shared concepts, build a relationship graph, and summarize each topic so you can jump between related ideas at a glance.

## Architecture
- **Frontend (client/)** – React + Vite + Tailwind dashboard for uploads, pipeline status, and graph visualisation. Documents render as red nodes and extracted concepts as green nodes; shared concepts link every document they appear in.
- **Backend (FastAPI)** – `main.py` exposes REST endpoints for health checks, uploads, pipeline status, and concept summaries. Uploads are written to `src/data/`, then a background pipeline compresses large PDFs, extracts keywords with the LLM, populates Redis-backed concept summaries, and emits a graph payload.
- **LLM + Storage** – Concept extraction and summaries run through Amazon Bedrock via `dubhack/llm/bedrock.py`. Redis (run via `docker-compose.yml`) stores generated summaries and pipeline state is stored in memory for quick lookups.

## Quick Start
1. Install prerequisites: [uv](https://github.com/astral-sh/uv) for Python deps, [just](https://github.com/casey/just) for task running, Docker for Redis, and pnpm for the client.
2. Sync dependencies:
   ```bash
   just install
   ```
3. Launch Redis (once per session):
   ```bash
   just db-up
   ```
4. Run the dev servers in separate terminals:
   ```bash
   just dev-server   # FastAPI backend on http://127.0.0.1:8000
   just dev-client   # Vite dev server on http://127.0.0.1:5173
   ```

## Development Notes
- Backend configuration lives in `dubhack/config.py`. Set `FRONTEND_ORIGIN` if the client runs on a non-default host, and export AWS credentials with permissions to invoke Bedrock.
- Concept summaries live in Redis; wipe them with `just db-wipe` or stop the container with `just db-down`.

