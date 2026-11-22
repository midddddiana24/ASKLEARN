# Cobalt guide implementation ledger

Approved plan: Cobalt & Porcelain across ASKLearn; original stylized 3D student; ten-second post-login intro with immediate Skip Intro; account-persisted dashboard, library and workspace tours.

Ruling: Execute in the existing authorized workspace. Git metadata is read-only; do not create a worktree, commit or push.
Ruling: Keep existing accounts, records, provider configuration, CSRF, saved-state conflict handling and assessment clocks unchanged.
Ruling: Help tours explain controls without triggering uploads, generation or assessment actions. Reduced motion bypasses the cinematic intro.

Tasks:
- [x] Add and test additive onboarding storage and APIs. Focused tests first failed for missing endpoints; 62 backend checks then passed with one live Postgres check skipped.
- [x] Build shared rounded 3D book/student scenes and static fallbacks.
- [x] Implement sign-in intro and accessible contextual tours. Browser scenarios cover immediate first-frame skipping, manual-login-only playback, completion timing, delayed graphics, focus, reduced motion, fallback, replay, save retry and stale requests.
- [x] Apply cobalt design and generated local artwork.
- [x] Verify build, API, browser and responsive behavior; document evidence. Final production build passed; backend 62 passed / 1 live Postgres check skipped; full browser suite 32 passed; final tour-placement recheck 10 passed. See docs/verification.md.

Review rulings: Preserve newer local section state when initial GET or earlier PATCH responses arrive late. Guard queued writes with per-section revisions. Use one shared intro start time for late-loading or remounted graphics. Distinguish the logo-overlay CSS class from the splash-phase class so Skip Intro accepts pointer input immediately. Place desktop tour panels beside highlighted targets when space permits; keep a bottom sheet on phones.

Later user revision: replace the 3D human with a 2D SVG student in eight distinct poses throughout the interface. Retain the 3D study objects, ten-second intro, skipping and account-owned tours. Implemented and verified with 32 browser tests; see the latest verification record and artifacts/student-2d-poses.svg.
