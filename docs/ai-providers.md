# Gemini and OpenRouter

ASKLearn supports both services for cited streaming chat and all five study generators. Keys stay on the server. No database migration or changes to existing saved records are required.

## Configuration

Keep your existing secret values in `backend/.env`. Add or edit these non-secret settings only if you want to change the defaults:

```dotenv
AI_PROVIDER=gemini
AI_FALLBACK_PROVIDER=auto
GEMINI_MODEL=gemini-3.1-flash-lite
OPENROUTER_MODEL=openrouter/free
```

The existing key names are `GEMINI_API_KEY` and `OPENROUTER_API_KEY`. They are not interchangeable. Do not put keys in frontend variables, Git, screenshots, or chat messages. Never replace an existing `.env` file just to add a setting.

- `AI_PROVIDER=gemini`: use Gemini first. Set it to `openrouter` to use OpenRouter first.
- `AI_FALLBACK_PROVIDER=auto`: use the other configured service when the primary hits a quota, timeout, or temporary server error. If only one key exists, that service can run alone. Set this to `none` to disable backup, or name a specific backup provider.
- A streamed answer only switches providers before any answer text is emitted. A partial answer is preserved and marked as an error if the stream fails; text from different models is never concatenated.
- Authentication failures, insufficient OpenRouter credits, unavailable models, and invalid local settings are reported for correction rather than silently retried through another provider.
- Structured results are validated locally for the requested count, question/answer validity, and source IDs. Invalid structured output has one repair attempt, then may use the configured backup. No incomplete result is saved as a valid study tool.

The default OpenRouter route is `openrouter/free`, which selects an available free model that supports the requested features. Availability and account rate limits still apply; it is not a guaranteed-capacity service. You can configure a specific compatible model with structured-output support. Its provider terms and pricing apply. [Free-router documentation](https://openrouter.ai/docs/guides/routing/routers/free-router), [structured outputs](https://openrouter.ai/docs/guides/features/structured-outputs).

## Verify your connection

From the project root in PowerShell:

```powershell
# Directly test each service using a synthetic lesson.
.venv\Scripts\python.exe -m backend.scripts.check_ai --provider all

# Also verify summaries, reviewers, flashcards, quizzes, and a 20-question practice test.
.venv\Scripts\python.exe -m backend.scripts.check_ai --provider all --full
```

These commands make real provider requests, subject to account quotas and any model charges. They never read student materials or print keys. Each provider produces its own JSON verdict. Explicit diagnostic selection disables fallback, so a working backup cannot conceal a broken primary.

`--provider gemini` and `--provider openrouter` test a single service. Without a flag, the command directly tests the configured primary. A basic check verifies streaming with a source citation and schema-validated summary generation. Full mode tests every generator. A `valid` result verifies these technical checks on synthetic content, not the factual correctness of every future AI answer.

Exit status is 0 for success, 1 for a failed check, and 2 for a missing key. Follow the printed remediation before trying again. Health metadata reports configuration presence, not live key validity; it never returns keys.

## Apply changes

After saving `.env` or updating backend code:

1. Press Ctrl+C in the ASKLearn server window.
2. Start `Start ASKLearn.cmd` again.
3. Open `http://127.0.0.1:8000` and refresh. Your existing account, lessons, and progress remain available.

On hosted deployments, store the same values as server environment secrets and restart/redeploy the service. Existing environment variables override `.env` values.

## Verification on 2026-11-22

Both configured services passed real streaming, source-reference validation, summary, reviewer, flashcard, quiz, and practice-test checks using synthetic photosynthesis content. OpenRouter was tested through its free router. No secret values were recorded.

The transport uses the fixed OpenRouter HTTPS endpoint, rejects redirects, bounds generated JSON size, ignores SSE keepalive comments, recognizes stream errors/truncation, and closes connections on cancellation. Local test fixtures explicitly disable real credentials and fallback so regression runs cannot spend account credits. [OpenRouter streaming reference](https://openrouter.ai/docs/api_reference/streaming).
