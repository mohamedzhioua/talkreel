# Contributing

## Setup

Requirements are in the [README](README.md). Then:

```bash
npm install && npm run build && uv sync --project py
node dist/cli.js doctor
```

## Tests

- `npm run typecheck` and `npm test`: TypeScript checks and unit tests (vitest). They use recorded fixtures and need no models.
- `uv run --project py pytest`: Python helper tests. They skip when the models are missing.
- `npm run smoke`: builds, then runs a 2-chapter talk through voice, align, draft render and frames. It needs FFmpeg, uv and the models, renders video, and is slow. Run it locally only. `npm run smoke -- --clean` starts from an empty talk.

## CI

CI runs `npm ci`, `npm run typecheck` and `npm test` on pull requests and on pushes to `main`. It does no rendering and loads no models, so run the smoke test yourself before changing the pipeline.

## Commits and pull requests

Short imperative subject line, one logical change per commit. Explain the why in the body when it is not obvious. Update the docs that your change makes wrong.

## Dependencies

No new dependencies without discussion: open an issue first. HyperFrames stays pinned at 0.8.185. Never add GPL code to the repo; see [THIRD_PARTY.md](THIRD_PARTY.md).
