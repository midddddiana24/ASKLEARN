# Online pilot: Render + Neon

This is deployment preparation, not proof of a live deployment. No Render or Neon credentials were configured during implementation. No paid service is enabled by the application.

## Before you deploy

Run backend and browser tests and build the frontend using README commands. Publish the source with `Publish ASKLearn.cmd` from a normal Windows session if this coding session still has read-only Git metadata. The script includes the Dockerfile and Render blueprint.

The approved pilot uses a single FastAPI web service serving the built React frontend and a managed Neon Postgres database. Raw uploads are temporary; extracted text, accounts, chat, generated tools, progress, and attempts live in Postgres. Original illustrated companion assets are bundled in the frontend. No object-storage account is needed for the preset avatars.

## Create the database

1. In your own Neon account, create a project on its **Free** plan. Choose a region near your Render service.
2. Copy its pooled Postgres connection string privately. Keep the supplied TLS parameters (`sslmode=require`, and any additional parameters provided by Neon). Store it as Render's secret `DATABASE_URL`.
3. Do not put the URL in Git, screenshots, public issues, or frontend variables. The app accepts `postgres://`, `postgresql://`, or `postgresql+psycopg://` URLs using Psycopg 3.

## Create the web service

1. In your Render account, create a Blueprint from your ASKLEARN GitHub repository, using `render.yaml`. Verify that the service plan is **Free** before creating it.
2. Set secret variables in the service dashboard: `DATABASE_URL` and your own `GEMINI_API_KEY`. The application uses Render's automatic `RENDER_EXTERNAL_URL` as its trusted HTTPS origin. If you later use a custom domain, set `PUBLIC_ORIGIN` to that exact HTTPS URL with no path. See [Render's default variables](https://render.com/docs/environment-variables).
3. The blueprint sets `COOKIE_SECURE=true`, `CLOUD_PILOT=true`, and the configurable Gemini model. Cloud startup refuses SQLite, insecure cookies, or a missing trusted HTTPS origin.
4. Docker builds the React frontend in a Node 24 stage and runs FastAPI with Python 3.14 as a non-root user. `/api/health` is the health check. Serving frontend and API together avoids cross-site cookie configuration.
5. Test registration, logout/login, upload, a cited live answer, every study tool, exact resume in a second browser/device, and a password change. Restart/redeploy the service and verify the same records remain. Do not claim cloud readiness until these checks pass.

## Preserve existing local students and records

Do this before students begin writing to the new hosted database. Existing online records must not be overwritten.

1. Stop local writes and retain an independent copy of `backend/asklearn.db`. Startup migrations also create versioned SQLite backups in `backend/.backups/` before changing a pre-upgrade database.
2. Set `MIGRATION_TARGET_URL` privately in your normal terminal environment to the destination connection string. It is separate from `DATABASE_URL`, so testing the migration cannot silently point the local app at the cloud database.
3. Preview counts from the repository root:

   ```powershell
   .venv\Scripts\python.exe -m backend.migrate_data --source backend/asklearn.db --dry-run
   ```

4. Copy and verify:

   ```powershell
   .venv\Scripts\python.exe -m backend.migrate_data --source backend/asklearn.db
   ```

5. Confirm reported table counts. Identical repeat copies are recognized; different destination records cause a refusal. Inserts are transactional, ID sequences are reset on Postgres, password hashes are retained, and login tokens are deliberately excluded. Students sign in again using their existing passwords.
6. Remove `MIGRATION_TARGET_URL` from the terminal session after use. The migration never deletes source records and refuses a source/destination that resolve to the same database.

Schema upgrades are numbered and additive. Version 1 adds profiles, workspace state, study progress, and activity metadata; version 2 adds optimistic answer versions. Migration tests cover a legacy SQLite database, backup integrity, repeat copies, preservation of password hashes, and refusal to overwrite different records. A dedicated Postgres integration test is configured in CI; local runs skip it unless a disposable `TEST_POSTGRES_URL` pointing to `asklearn_test` is explicitly supplied.

## Pilot limits and operations

- Render free services sleep after inactivity and have ephemeral filesystems. Wake-up can delay the first visit; the service is suitable for a pilot, not an availability guarantee. See [Render's current limits](https://render.com/docs/free).
- Neon free storage/compute quotas apply. Review [current Neon limits](https://neon.com/docs/introduction/plans) and periodically export/back up the database privately. Application restart is not a backup strategy.
- Gemini quotas and model access are controlled by your Google project. Configure the key privately and measure live answer quality; deterministic tests do not prove it.
- In-memory request limiting targets this single-instance pilot. Do not scale to multiple app instances without shared rate-limit storage and additional concurrency testing.
- Email verification and forgotten-password recovery are intentionally excluded. Signed-in password changes require the current password and revoke all login sessions.
- Keep DB exports and SQLite backups outside Git and public containers. “Delete my learning data” retains the account/profile but removes the student's learning content and progress; document deletion also removes dependent study work.
- Roll back code only to a version compatible with the current schema. The application refuses a schema version newer than it knows. Restore a backup into an isolated destination and verify it before changing the live service's database URL.
