# Developer verification

## Workspace file management - 2026-11-25

- Final TypeScript and Vite production build: PASS. The existing lazy Three.js chunk-size advisory remains non-fatal. `git diff --check` reports no whitespace errors.
- Backend regression: **65 passed, 1 live PostgreSQL integration check skipped**, with two upstream dependency deprecation warnings. The new unselected-material deletion regression was observed failing before the targeted reset fix and passing afterward. Selected-source deletion still resets its workspace, while unrelated records and file type survive rename/deletion as appropriate. Existing ownership and CSRF protections remain in use.
- Full Edge browser suite: **45 passed** (4.4 minutes). After the final pending-action menu lock, the **13 Workspace file-management tests passed again** (1.1 minutes), including a gated check that Rename cannot open while removal is saving.
- New browser coverage: rename validation and persistence in Library, unchanged selected sources and chat history, reversible workspace removal and reselection, safe deletion cancellation/focus, related-history cleanup, preservation of an unrelated workspace, last-material deletion, rename/delete error recovery, duplicate submission prevention, streaming/generation/save/conflict/assessment guards, mobile keyboard menu navigation, and refresh retry without a repeated DELETE.
- Additional gated cases cover background generation after a tool switch, delayed assessment creation after switching away, pending saved-study restoration, and submission completion after the assessment panel unmounts. Separate read-only review identified these asynchronous cases; the fixes and regressions were rechecked with no remaining critical or important review findings.
- Responsive verification includes the existing 375/768/1440px light/dark application and login matrices. Inspected `artifacts/workspace-file-menu-mobile.png`, showing all three actions within the mobile viewport and a separate selected-file checkbox.
- Public API shapes and database schema are unchanged. Document DELETE now clears the saved workspace only when its document IDs include the deleted source. No live student records, AI keys, provider settings or deployment configuration were changed. Tests use isolated fixtures. A server restart is required to load the updated deletion handler.
- Boundaries: live PostgreSQL and hosted deployment were not exercised. Git metadata remains read-only here; no commit, push or deployment was performed. See [student instructions](student-guide.md) and [implementation ledger](workspace-file-actions-implementation.md).

## First-publish whitespace blocker - 2026-11-22

The user's subsequent run staged 102 source files but had not created a commit or uploaded refs. Read-only inspection reproduced `git diff --cached --check` exiting 2 with one diagnostic: `frontend/src/style.css:19: new blank line at EOF`. Removed only the extra final newline from the working stylesheet. A no-index check against an empty file then produced no whitespace diagnostics (exit 1 reports content differences), and `git diff --check` passed for the working changes.

The normal publisher re-stages this corrected file before checking it again. Added five explicit progress messages and a failed-step label so subsequent failures identify fetch, staging, whitespace check, commit, or push. The read-only publisher preflight still passes. Git metadata remains read-only in this session; staged content is refreshed only when the user reruns the normal publisher. No upload was claimed or performed here.

## Windows publishing guard - 2026-11-22

The previous publisher incorrectly rejected the correct GitHub URL and main branch. Reproduction with the exact original FINDSTR /x pipelines returned exit 1 for both guards despite Git returning the correct LF-terminated strings. The publisher now captures each Git output line with FOR /F and performs explicit string comparisons.

Read-only verification: `Publish ASKLearn.cmd --check` returned exit 0 for the real configured origin and main branch. A process-only Git URL rewrite to example.invalid returned exit 1, preserving rejection of another target. This mode exits before fetch, staging, commit or push and does not initialize a repository or add a remote. No repository metadata or global Git configuration was changed in these checks. Actual publication must still run from the user's normal PowerShell session.

## 2D student poses - 2026-11-22

- Final TypeScript and production build: PASS. The optional Three.js study-object chunk is approximately 536 kB minified / 133 kB gzip and retains the non-fatal size advisory.
- Replaced the 3D human with the original SVG student in the intro, companion, spotlight tours, profile/avatar views, login, library and empty-state artwork. Eight distinct poses use different arm paths, hand gestures, expressions and props. The Three.js scene now contains study objects only.
- Browser regression: **32 passed** (3.2 minutes). Pose checks cover wave/point/success during the intro, upload/thinking during Library help, reading in Workspace, and actual processing/success/error companion states. An unsupported file exercises the error pose. Guide dialogs allocate no WebGL canvas; the retained 3D book joins the current intro timeline after delayed loading.
- Login/registration and application layout matrices were recaptured at 375/768/1440px in both themes. Reviewed light/dark login, desktop 2D spotlight guide, mobile reading pose, and the combined 2D student / 3D book intro.
- Existing tests still cover immediate skipping, keyboard focus, reduced motion, fallback, tour persistence/replay, study generation, provider-error recovery, account history, exact study resume, conflicts, assessment scoring and deadline behavior. The tour persistence test now waits for the server's skip acknowledgement before refreshing rather than assuming an asynchronous save is immediate.
- Pose reference: `artifacts/student-2d-poses.svg`, rendered directly from the actual StudentArt component, with all eight original poses. Screenshots include `artifacts/cobalt-desktop-2d-guide.png`, `artifacts/cobalt-mobile-guide.png`, `artifacts/cobalt-intro-cards.png` and `artifacts/auth-*.png`.
- Backend, database schema, account records and provider credentials were not changed. Backend tests were not rerun for this frontend-only update; the preceding backend evidence remains below. Original generated 3D artwork is retained as historical assets and is no longer referenced by the active UI.

## Cobalt design, 3D student and onboarding - 2026-11-22

- Final TypeScript and Vite production build: PASS. The on-demand Three.js chunk remains approximately 542 kB minified / 135 kB gzip and produces a non-fatal size advisory; it is not part of the initial app chunk.
- Backend regression: **62 passed, 1 PostgreSQL integration check skipped**, with two upstream dependency deprecation warnings. New tests cover account isolation, valid guide sections/steps/statuses, CSRF and authentication, terminal-state protection, and a repeatable version-2-to-3 SQLite upgrade preserving existing users and creating a backup.
- Full Edge browser regression: **32 passed** (4.0 minutes). After the final desktop tour-placement adjustment, all **10 onboarding/intro checks passed again** (40.3 seconds), including an explicit no-overlap assertion for the highlighted Continue Learning card.
- New browser coverage includes first-frame pointer skipping, Escape and focus restoration, manual sign-in/registration versus refresh, ten-second completion, delayed 3D loading aligned to the shared clock, session expiry and failed login, delayed initial GET and older PATCH responses, failed save/retry, Back/Next/Skip/Done/replay, empty libraries, reduced motion, mobile sidebar restoration, graphics failure, and one active canvas during a real 3D guide.
- Responsive matrix: 12 login/registration captures and 24 Dashboard/Library/Workspace/Profile captures at 375/768/1440px in light/dark themes. Original tour gallery captures were refreshed using the actual interface with deterministic sample biology output. Reviewed light desktop login, dark desktop dashboard, intro cards, desktop 3D guide and mobile fallback guide images.
- Visual evidence: `artifacts/cobalt-intro-book.png`, `artifacts/cobalt-intro-cards.png`, `artifacts/cobalt-desktop-3d-guide.png`, `artifacts/cobalt-mobile-guide.png`, plus `artifacts/auth-*.png` and `artifacts/modern-*.png`.
- Separate read-only code review identified stale onboarding response races and separate intro clocks. Both were fixed and covered by gated browser tests. A splash CSS class collision was also corrected and covered by the first-frame Skip Intro check.
- New assets and exact built-in generation prompts: [Cobalt artwork](cobalt-generated-assets.md). User instructions: [Student guide](student-guide.md). Backend API keys and provider selection were not changed; the browser suite uses isolated synthetic fixtures and does not consume the configured real AI credentials.
- Boundaries: no physical-device GPU/performance certification or live PostgreSQL migration was performed. Windows test runs can emit an asyncio connection-reset callback during deliberate request cancellation; checks still passed. Existing server processes were not terminated. Restart `Start ASKLearn.cmd` to activate the new API routes and additive migration. Git remains read-only; no commit, push or deployment was performed.

## Gemini and OpenRouter integration - 2026-11-22

- Live synthetic verification: Gemini VALID and OpenRouter VALID. Each independently passed streaming chat with a citation, summary, reviewer, flashcards, quiz, and a 20-question mixed-type practice test. The diagnostic explicitly selects each provider with fallback disabled, so one provider cannot conceal failure of the other.
- Live OpenRouter used `openrouter/free`; no paid model was selected. These checks establish technical operation and source-reference validation on the synthetic lesson, not guaranteed future model factual accuracy or availability.
- Backend regression: 59 passed, 1 PostgreSQL integration test skipped, 2 upstream deprecation warnings. New coverage includes all OpenRouter generators, strict schemas, SSE comments/errors/truncation, retry bounds, no fallback after partial output or authentication failure, connection cleanup, OpenRouter-only chat/health, configuration isolation, and secret redaction.
- Browser regression: 22 passed. Existing authenticated learning, persistence, recovery, UI/motion, and exact-resume flows remain intact. Browser outputs use isolated fixtures and cannot consume the real configured keys.
- TypeScript and production build: PASS. The existing optional Three.js chunk-size advisory is non-fatal.
- Server configuration confirmed in a fresh process: Gemini primary, OpenRouter backup, both keys present. No secrets were printed or rewritten. Defaults activate the existing keys without requiring edits to `.env`.
- The already-running service at port 8000 returned HTTP 200 but lacked the new provider metadata, confirming that it still needs a restart. Process ownership inspection was denied by the host, so that process was not terminated. The operator should use Ctrl+C in its server console and reopen `Start ASKLearn.cmd` to activate the updated backend.
- Provider setup and switching: [Gemini and OpenRouter guide](ai-providers.md). Database schemas, student records, and assessment scoring are unchanged. No deployment, Git commit, or push was performed.


## Login UI and home scroll effects - 2026-11-21

- Final TypeScript and production build: PASS. The existing optional Three.js chunk-size advisory remains non-fatal.
- Final browser suite: 22 passed in Edge (3.2 minutes). All existing account, saved-progress, study-tool, recovery, and 3D-loading checks passed alongside the new authentication and home-motion cases.
- New authentication checks: password reveal/hide, busy controls, preserved entered values after failure, error focus, clearing stale errors on registration, and cancelling a pending sign-in when navigating away.
- New motion checks: native scrolling triggers section reveals, sticky-header state, reading progress and bounded lesson-card depth; switching to reduced motion stops animations and leaves content accessible.
- Captured login and registration at 375/768/1440px in light and dark themes (12 images, `artifacts/auth-*.png`), plus updated home captures `artifacts/home-refined.png` and `artifacts/home-scroll-effects.png`. Inspected desktop and mobile sign-in, dark tablet registration, and settled home screenshots.
- Frontend authentication requests retain the existing server endpoints and payloads. Database/schema/provider settings are unchanged. Backend tests were not rerun for this frontend update; prior backend and live-provider limitations remain documented below.


## Modern UI and generated brand assets - 2026-11-21

- Final TypeScript and production build: PASS. DM Sans and Manrope variable fonts are bundled locally; Inter was removed. The pre-existing advisory about the optional Three.js chunk remains non-fatal.
- Final browser regression: 18 passed in Edge (2.3 minutes). Includes all study tools, account resume, profile preferences, persistence recovery, keyboard navigation, upload stages, and 3D/fallback behavior.
- Responsive coverage: 24 refreshed `artifacts/modern-*.png` captures at 375/768/1440px in both themes. Checks cover font loading/families, logo loading, visible illustration loading, document overflow, active navigation and dock bounds. Inspected desktop/mobile dashboard, tablet library, dark profile, mobile workspace, public welcome, generated originals, and the startup scene.
- Keyboard check now waits for ready study tabs and asserts a concrete Tab transition from Ask your lesson to Summary, replacing a timing-sensitive check immediately after navigation.
- Generated artwork: original book/conversation logo and matching 3D study illustration saved under `frontend/public/brand`; both retain alpha. Custom study/navigation icons use original SVG geometry. [Source paths and generation prompts](generated-brand-assets.md).
- Public tour PNGs were regenerated from the modern interface with deterministic sample lesson content and included in the final build. The public welcome/image test passed after the rebuild.
- Backend behavior, database records, and API configuration were unchanged by this presentation update. Backend tests were not rerun for this CSS/assets-only update; prior backend evidence remains below. Live Gemini and remote publication status are unchanged.


## Retro Study Studio verification - 2026-11-21

- TypeScript and production build: PASS. The optional lazy Three.js chunk is about 133 kB gzip; Vite emits a non-fatal advisory for its size before gzip.
- Backend: 38 passed, 1 skipped, 2 upstream deprecation warnings. The skipped test requires PostgreSQL. New diagnostics tests cover missing credentials, successful streaming/structured generation, sanitized authentication errors, and no blind provider retries.
- Browser: 18 passed in Edge in the final run. Includes all prior student/account flows plus startup skip/readiness, real graphics initialization, fallback after attempted initialization, simulated context loss, canvas cleanup, real processing/saving acknowledgement, reduced motion, and failure/retry feedback.
- Responsive matrix: 24 refreshed captures covering Dashboard, Library, Workspace, and Profile at 375/768/1440px in light/dark themes. Inspected the 3D opening, SVG fallback, upload processing, desktop dashboard, and mobile dark dashboard screenshots. Native GPU speed across other devices was not benchmarked.
- Original 3D scene rendered in the local Edge browser. Captures: `artifacts/studio-opening-3d.png` and `artifacts/studio-opening-fallback.png`. No test-only WebGL flags are added to production.
- Final review: important lifecycle/fallback findings fixed and verified in a follow-up review. No further important findings were reported.
- Gemini diagnostic returned `unconfigured`: no credential was available, and no live provider request was made. Setup and the explicit live diagnostic are documented in [Retro Study Studio](retro-study-studio.md). AI browser outputs remain deterministic fixtures, not live-answer accuracy evidence.
- No database migration or account-data replacement was performed. No deployment, Git commit, or push occurred; Git metadata remains read-only in this session.

Earlier verification records follow.


## Neutral retro desktop verification - 2026-11-15

- Production build and TypeScript check passed.
- Backend regression: 35 passed, 1 PostgreSQL integration test skipped, 2 dependency deprecation warnings.
- Browser regression: 14 passed in Microsoft Edge (13 existing student/account tests plus the new retro layout test).
- Layout matrix: Dashboard, Library, Workspace, Profile at 375, 768, and 1440px in light and dark themes, with reduced motion. Screenshots are under `artifacts/retro-*.png` (24 captures). The check covers page overflow, a single current dock destination, and dock bounds/height. Screenshot review identified an inherited full-height navigation rule; the dock now explicitly resets that height.
- Phone ordering puts Continue learning before activity totals. The final layout matrix passed again after that presentation adjustment (1 test, 24 screenshots).
- Account isolation, saved history, exact resume, retry/conflict recovery, real upload stages, practice draft flush, and background-generation navigation remain covered by the existing suite.
- Browser AI responses use deterministic fixtures. Live Gemini correctness, managed PostgreSQL, Docker hosting, and deployment remain outside this local verification.
- GitHub publication remains unavailable in this session because `.git` is read-only. No commit or push was made. `Publish ASKLearn.cmd` remains the normal-session publication helper.

The older evidence below records the previous green companion build; it is retained as history.


Study Companion update verified locally on Windows on 2026-11-07 using Python 3.14, Node 24.18, Vite 8.3.6, and Microsoft Edge via Playwright.

## Results

| Check | Result | Evidence |
|---|---|---|
| Backend regression | PASS: 35 tests; 1 skipped | Includes profile/password, owner-isolated resume, stale writes, concurrent activity updates, migration/backup/idempotency, and the original learning flows. The skipped test requires an isolated Postgres instance. |
| Frontend type check and production build | PASS | `npm run build`, TypeScript and Vite |
| Student journey | PASS | Registration, upload, selected materials, streamed chat, source modal, follow-up, all five generators, Markdown downloads, flashcard completion, quiz grading, practice-test resume and timer submission, logout |
| Mobile / theme / keyboard | PASS within automated coverage | 375px, dark theme, reduced motion, keyboard focus, sidebar, rename, deletion |
| Public welcome | PASS within automated coverage | 390/768/1440px, sample interaction, four loaded interface images, no horizontal overflow |
| Provider outage | PASS with simulated failure | Error appears and Retry generates the requested result after recovery |
| Exact resume in a fresh browser | PASS | Sign out, sign in with a new browser context, restore flashcard position, preset avatar and hidden-companion preference |
| Save/recovery behavior | PASS | Workspace 409 recovery, failed PUT retry, blocked interactions after failed progress GET, latest-attempt restoration, written-answer flush on navigation |
| Interrupted tasks / sessions | PASS | Expired login returns to sign-in without deleting records; completed background generation does not replace the newly selected tool |
| Original companion / upload states | PASS within browser coverage | Original vector artwork, actual transfer feedback, separate processing stage, confirmation after server persistence |
| Data migration | PASS with SQLite fixtures | Legacy schema upgraded with backup, password hashes retained, repeat transfer recognized, nonidentical target refused |
| Postgres / Docker / live hosting | UNTESTED locally | No managed database credentials are set; Docker CLI exists but daemon is unavailable. CI includes a dedicated Postgres 17 integration service. Render/Neon manifests are prepared, not deployed. |
| Vite development server | PASS | React renders; modules load; same-origin API proxy reaches expected authentication response |
| Normal local API / built frontend | PASS | `/api/health` and `/` return 200; no Gemini key required to start |
| Dependency audit | PASS for npm at installation | npm reported zero known vulnerabilities; this is not a complete security audit |
| Original Taste static scan | BASELINE ONLY | The earlier scan passed before the Study Companion update. It is not presented as a full scan of the new authenticated-app styles, which follow the approved green reference. |
| Taste standalone browser inspector | NOT COMPLETED | Its CDP client timed out at `Page.enable` using both Chrome and Edge. Playwright layout checks and screenshot inspection were used instead; no claim that the standalone inspector passed. |
| Live Gemini integration / answer correctness | UNTESTED | No Gemini API key was configured; all AI regression tests use deterministic fixtures |
| Research accuracy / SUS / response-time findings | NOT MEASURED | Evaluation instruments remain blank |
| GitHub commit / push | BLOCKED | This session denies writes under `.git`; staging fails creating `index.lock`. No remote commit was published. `Publish ASKLearn.cmd` provides the exact normal-session publishing steps. |

The browser suite has 13 tests. AI fixture code is isolated under `backend/tests`; `Start ASKLearn.cmd` runs `backend.app.main:app`, which uses the real Gemini integration and never enables fixtures. Test-only delays exercise slow processing/generation, and the browser fixture raises its registration cap so independent test students do not exhaust one shared IP bucket; production limits are unchanged.

## Objective audit

| Requirement | Status | Implementation |
|---|---|---|
| Material-grounded chat with citations | PASS for application flow; live semantic accuracy unverified | `retrieval.py`, `prompts.py`, `llm.py`, chat route and source chips |
| Five automatic study tools | PASS with deterministic provider fixtures | Validated generators, saved sets, summary/reviewer export, flashcards, quiz, timed practice test |
| Unified learning environment | PASS | Library, document selection, Workspace tabs, conversation/study history |
| Follow-up discussion | PASS with deterministic provider fixtures | Server-owned conversation history, last eight complete messages |
| Student accounts and isolation | PASS within tests | Argon2, cookie sessions, CSRF, owner-filtered routes |
| Upload limits / deletion | PASS within tests | Streaming file-size check, extraction bounds, cleanup in finally, cascading learning-data deletion |
| Malformed AI output | PASS within tests | Pydantic models, invalid-question filtering, one retry, exact question counts and source-ID checks |
| Practice-test privacy | PASS within tests | Questions exclude answers/explanations until submitted; server grades and enforces persisted deadlines |
| Loading / error / empty states | PASS within exercised flows | Actual upload progress, skeletons, offline banner, configuration notice, retry toasts |
| Light/dark and reduced motion | PASS within exercised viewports | Semantic CSS tokens and reduced-motion handling |

## Boundaries

These checks do not prove live Gemini quality, resistance to every prompt injection, public-hosting readiness, accessibility certification, all browser/device support, or behavior under real concurrent classroom load. Rate limits are in-process and intended for the local single-process deployment. The Google account's actual free quota and model permissions must be verified when configuring a key.

The original Python 3.13 installation could not launch on this PC; the working Python 3.14 environment was used instead. Vite 7's native dependency optimizer hit restricted filesystem traversal here; upgrading to Vite 8's Rolldown toolchain resolved the development-server failure. See the [official Vite 8 announcement](https://vite.dev/blog/announcing-vite8) for that toolchain change.

Future work, outside this delivery: OCR, embeddings retrieval comparisons, email verification/recovery, spaced repetition, teacher tools, and public hosting.

The Study Companion delivery prepares free-pilot public hosting using Postgres and a non-root Docker image; live account provisioning/deployment remains pending. It does not enable a paid service, send emails, or claim cloud uptime. See `docs/online-pilot.md` for the exact setup and migration procedure.

The actual local pre-upgrade database was also checked against its automatic backup after startup: the existing account, login-session row, material, and 19 extracted chunks retained their original column values. No test students or example lessons were inserted into that local user database by verification; browser fixtures use their separate `artifacts/e2e.db`.
