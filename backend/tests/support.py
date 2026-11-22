"""Deterministic test server. Never used by the normal launcher or production app."""
import os
from pathlib import Path
TEST_ARTIFACTS = Path(__file__).resolve().parents[2] / 'artifacts'
TEST_ARTIFACTS.mkdir(exist_ok=True)
os.environ['OPENROUTER_API_KEY'] = ''
os.environ['AI_PROVIDER'] = 'gemini'
os.environ['AI_FALLBACK_PROVIDER'] = 'none'
os.environ['DATABASE_URL'] = f'sqlite:///{TEST_ARTIFACTS / "e2e.db"}'
os.environ['GEMINI_API_KEY'] = 'test-only-not-a-real-key'
from backend.app import llm
from backend.app.main import app
from .conftest import content
os.environ['GEMINI_API_KEY'] = 'test-only-not-a-real-key'


async def generate(req, material, source_ids):
    if 'GENERATION_DELAY_TEST' in material:
        import asyncio
        await asyncio.sleep(.8)
    return content(req.kind, max(20, req.n) if req.kind == 'test' else req.n)


async def stream(system, history, question):
    import asyncio
    for token in ['Plants convert ', 'light energy into ', 'chemical energy stored in glucose. ', '[S1]']:
        yield token
        await asyncio.sleep(.02)


llm.generate = generate
llm.stream_chat = stream

# Expose a visible processing interval only for the browser test's named text fixture.
from backend.app import main
_extract = main.extract_pages
def extract_with_test_delay(path):
    if path.suffix == '.txt' and path.read_text(encoding='utf-8').startswith('UPLOAD_DELAY_TEST'):
        import time
        time.sleep(1)
    return _extract(path)
main.extract_pages = extract_with_test_delay

# Each browser case registers an independent student; keep that fixture setup
# from exhausting the shared process's production registration bucket.
_rate_limit = main.rate_limit
def browser_rate_limit(key, count, window=60):
    return _rate_limit(key, 100 if key.startswith('register:') else count, window)
main.rate_limit = browser_rate_limit
