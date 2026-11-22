import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / 'backend' / '.env')
DATABASE_URL = os.getenv('DATABASE_URL') or f'sqlite:///{ROOT / "backend" / "asklearn.db"}'
MAX_UPLOAD_BYTES = int(os.getenv('MAX_UPLOAD_MB', '15')) * 1024 * 1024
MAX_TEXT_CHARS = int(os.getenv('MAX_TEXT_CHARS', '500000'))
CHUNK_SIZE = 900
CHUNK_OVERLAP = 150
RETRIEVAL_K = 6
CONTEXT_CHARS = 60000
COOKIE_SECURE = os.getenv('COOKIE_SECURE', 'false').lower() == 'true'
UPLOAD_DIR = ROOT / 'backend' / 'uploads'
