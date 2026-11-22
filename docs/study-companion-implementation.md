# Study Companion implementation ledger

Approved scope: green rounded UI inspired by the three local reference images; original illustrated human companion; online free pilot; exact account-owned study resume; profile and password settings without verification/recovery emails.

1. Add versioned profile/workspace/study-progress storage and migration safety; preserve existing rows.
2. Add resume, searchable history, profile/password endpoints with ownership and conflict checks.
3. Implement a green UI, original SVG companion, accurate upload stages, dashboard/profile, and persisted study navigation.
4. Add Postgres migration and Render/Neon pilot configuration without activating paid services.
5. Run backend and browser regressions, review visuals, and record deployment/publication boundaries.

Ruling: Work in the existing authorized workspace. Git metadata is read-only, so a worktree or commit cannot be created here. Do not bypass those permissions.
Ruling: Use additive, numbered SQLAlchemy schema migrations rather than replacing existing tables. SQLite backups precede upgrades; Postgres migration never deletes the source database.
Ruling: Use an original vector illustration, not copies of the Pinterest artwork. Upload progress remains real transfer progress; processing uses an indeterminate state.

Status: local implementation and verification complete; source publishing and free-pilot provisioning remain pending external access.

Completed implementation: additive schema versions 1/2; profile/password APIs; versioned workspace, card, and assessment position state; optimistic answer versions; account history; green UI, original vector character, real upload queue stages; data-transfer CLI; Render/Docker/Neon pilot preparation.

Review fixes: flush practice-answer drafts during navigation/logout/pagehide; block study interaction after failed progress loads; explicitly restore newer attempts after conflict recovery; use conflict-safe activity upserts so concurrent first saves do not create false progress conflicts. Regression tests were observed failing before these fixes and passing afterward.

Further regression pinned: background generation must not replace a newly selected study tab. Generation callbacks are scoped to their mounted study panel; completed work remains in server history.

Publication/deployment boundary: `.git` remains read-only in this session; source publishing uses the existing normal-Windows script. No Render/Neon/Gemini secrets were configured. Docker CLI is present, but its daemon is unavailable, so a container build and live cloud verification cannot be claimed.

Final verification: production build passed; 35 backend tests passed with one live Postgres test skipped; all 13 browser tests passed. Additional 375px/768px dashboard/profile checks exercised the saved-account flow. The running local app returned healthy responses, and existing local rows were checked unchanged against the automatic backup.
