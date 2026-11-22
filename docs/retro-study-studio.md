# Retro Study Studio implementation

The approved direction combines the green profile accent in `inspiration1.jpg` with the window frames, dock, and task companion in `inspiration2.png` and `inspiration3.png`. The reference images are still frames; the new choreography and geometry are original.

## Behavior

- Startup uses a local 3D book/folder scene once per tab. Skip removes the animation, and API readiness immediately removes the opening screen. There is no artificial minimum duration. On fast connections the opening may be brief or never visibly appear.
- Upload percentage comes from XHR. Processing is indeterminate. Library confirmation follows the successful server response. Generators use the same book scene while awaiting a real response.
- Saving indicators use matching compact SVG book/bookmark artwork, with restrained motion while saving and a settling confirmation after acknowledgement. They never start a separate graphics canvas. Existing retry, conflict, exact-resume, and draft-flush behavior is retained.
- Only one visible noncompact indicator owns a Three.js canvas. Reduced motion, initialization failure, and context loss use static SVG. Rendering stops while the document is hidden; offscreen and unmounted scenes release their resources. Device pixel ratio is capped at 1.5 and rendering at approximately 30 frames per second.
- The Three.js code is a lazy chunk, approximately 133 kB gzip in the initial build. It does not block the application bundle. The bundler's size advisory for this optional graphics chunk is non-fatal.
- Public introduction and dashboard section entrances use native scrolling and short, one-time reveals. Reading, chat, and tests do not receive scroll-linked transformations. Pointer hover effects have reduced-motion overrides; companion controls have 44px targets.

## Gemini connection

The application already implements streaming chat and schema-validated generation through Gemini. No API keys are shipped or invented. Account and library features remain usable without AI configuration.

1. Obtain a Gemini key from your own [Google AI Studio account](https://aistudio.google.com/apikey).
2. If `backend/.env` does not exist, copy `backend/.env.example` to that location. If it exists, edit only the relevant settings without replacing database or other configuration.
3. Set `GEMINI_API_KEY` privately in that file or the server's environment. Keep `GEMINI_MODEL=gemini-3.1-flash-lite`, or set a model available to your project. Environment variables take precedence over the file. Never use frontend `VITE_` variables for credentials.
4. From the repository root, run:

```powershell
.venv\Scripts\python.exe -m backend.scripts.check_ai
```

This explicit diagnostic makes live streaming and structured-generation requests using a tiny synthetic lesson, subject to the provider's usage/quota rules. It does not read the database or student materials. It prints a sanitized JSON verdict and exits with 0 for valid, 2 for unconfigured, or 1 for failure. It never prints the credential or raw provider errors. Fix the reported configuration/access/quota issue before trying again.

5. Restart ASKLearn after changing the environment. The health endpoint reports configuration presence, not credential validity. Do not interpret it as a successful live test.

No key was available during this implementation. Local provider tests use fixtures; live Gemini verification remains pending. Cloud deployment and GitHub publication are separate from this local upgrade.

## Implementation ledger

- Approved plan: Retro Study Studio, original local 3D scene, existing Gemini provider, unchanged persistence protocols.
- Ruling: work remains in the existing authorized workspace because Git metadata is read-only; no worktree, commit, or push is attempted.
- Task 1 complete: original task artwork, lazy Three.js scene, startup and task integration, hover/reveal CSS.
- Task 2 complete: semantic save phases, compact bookmark feedback, unchanged save/recovery requests.
- Task 3 complete: explicit Gemini diagnostic, missing-key and sanitized-error tests, operator setup instructions.
- Review: fixed context-loss cleanup, compact saving motion, and fallback-test synchronization. Browser fallback checks wait for an actual graphics initialization attempt; WebGL screenshots wait for a painted frame.
- Verification results are recorded in `docs/verification.md`.

Installed skills applied: Frontend Design, UI UX Pro Max, Writing Plans, and Executing Plans. User-approved visual choices take precedence over generic style suggestions. Resource cleanup follows the [Three.js manual](https://threejs.org/manual/en/cleanup.html); motion follows [Motion's reduced-motion guidance](https://motion.dev/docs/react-use-reduced-motion).
