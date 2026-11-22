"""Own the test server lifetime without Windows process-tree termination tools."""
import os
import subprocess
import sys
import threading
import time
from pathlib import Path
import uvicorn
from .support import app


def main():
    root = Path(__file__).resolve().parents[2]
    server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=8001, log_level='warning'))
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        for _ in range(100):
            if server.started:
                break
            if not thread.is_alive():
                raise RuntimeError('Test server could not start. Check port 8001.')
            time.sleep(.1)
        if not server.started:
            raise RuntimeError('Test server startup timed out.')
        env = {**os.environ, 'ASKLEARN_EXTERNAL_TEST_SERVER': '1'}
        return subprocess.call(['node', str(root / 'frontend/node_modules/@playwright/test/cli.js'), 'test', *sys.argv[1:]],
                               cwd=root / 'frontend', env=env)
    finally:
        server.should_exit = True
        thread.join(timeout=10)


if __name__ == '__main__':
    sys.exit(main())
