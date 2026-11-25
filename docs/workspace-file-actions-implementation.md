# Workspace file actions

Approved: add Rename, Remove from workspace, and confirmed Delete from account to the Workspace file list. Preserve Library controls, cobalt styling, the 2D student, accounts, study records and provider configuration.

Ruling: use the existing authorized checkout; Git metadata remains read-only. No commit or push is part of this implementation.
Ruling: reuse document PATCH/DELETE and saved workspace PUT APIs. Delete unrelated materials without resetting an unaffected workspace; affected workspaces retain the existing reset behavior. No schema migration.
Ruling: save study drafts before membership changes or permanent deletion; block removal/deletion during generation, streaming, active timed assessments, restoration and unresolved save failures/conflicts. Removing a selection uses the existing optimistic save flow; a failed write stays visible and blocks further file changes until Retry save or Load latest resolves it.

- [x] Regression coverage for targeted server reset and rename/delete contracts. The unrelated-workspace test failed before the backend fix; all 65 backend tests now pass with one live Postgres test skipped.
- [x] Accessible per-file menu and rename/delete dialogs. Explicit dialog focus follows native showModal; the selection label and menu trigger are separate.
- [x] Workspace integration, real operation guards and refresh/recovery. Root-owned operation tracking survives tool switches; accepted timed attempts remain guarded until submission. Failed post-delete refreshes retry resource loading without repeating deletion.
- [x] Browser, backend, production build and responsive verification. Build passed; backend 65 passed with one live PostgreSQL check skipped; full Edge browser suite 45 passed; final focused file-action suite 13 passed. Mobile menu capture reviewed. See docs/verification.md.

Review fixes: block pending assessment creation and saved-study restoration; ignore late onAttempt callbacks after unmount; retain background generation locks across tool switches; reconcile completed timed attempts; ignore stale resource-list responses after deletion. Added gated browser regressions for these sequences. Keep existing tab switching during background generation.
