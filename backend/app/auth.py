import hashlib
import secrets
import time
from collections import defaultdict, deque
from threading import Lock
from argon2 import PasswordHasher
from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session
from .db import LoginSession, User, get_db
from .config import COOKIE_SECURE

hasher = PasswordHasher()
_requests: dict[str, deque] = defaultdict(deque)
_lock = Lock()


def rate_limit(key: str, count: int, window: int = 60):
    now = time.monotonic()
    with _lock:
        # Bound inactive buckets for this single-process local application.
        if len(_requests) > 10000:
            for old in list(_requests):
                if not _requests[old] or now - _requests[old][-1] > 3600:
                    del _requests[old]
        bucket = _requests[key]
        while bucket and bucket[0] <= now - window:
            bucket.popleft()
        if len(bucket) >= count:
            raise HTTPException(429, 'Too many requests. Please wait before trying again.', headers={'Retry-After': str(window)})
        bucket.append(now)


def sign_in(db: Session, user: User, response: Response):
    token, csrf = secrets.token_urlsafe(32), secrets.token_hex(32)
    db.add(LoginSession(token_hash=hashlib.sha256(token.encode()).hexdigest(), user_id=user.id,
                        csrf=csrf, expires=time.time() + 604800))
    db.commit()
    response.set_cookie('asklearn_session', token, httponly=True, secure=COOKIE_SECURE,
                        samesite='strict', max_age=604800, path='/')
    return {'id': user.id, 'name': user.name, 'email': user.email, 'csrf': csrf}


def current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get('asklearn_session', '')
    session = db.get(LoginSession, hashlib.sha256(token.encode()).hexdigest())
    if not session or session.expires <= time.time():
        raise HTTPException(401, 'Please sign in to continue.')
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        if not secrets.compare_digest(request.headers.get('X-CSRF-Token', ''), session.csrf):
            raise HTTPException(403, 'Your session changed. Refresh and try again.')
    request.state.login_session = session
    user = db.scalar(select(User).where(User.id == session.user_id))
    if not user:
        raise HTTPException(401, 'Please sign in to continue.')
    return user
