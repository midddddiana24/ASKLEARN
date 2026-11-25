# ASKLearn design decisions

## Workspace material actions - 2026-11-25

Each material in the Workspace sidebar has an always-visible ellipsis button outside its selection label. Its portal-based menu offers Rename, Remove from workspace, and Delete from account; the latter is a separately styled destructive action. Menu placement fits the viewport, touch controls meet the existing mobile sizing, arrow/Home/End keys move between enabled items, and Escape returns focus to the trigger. The dialogs share the existing native modal presentation, explicitly focus the name or safe cancellation action, and retain entered values on errors.

Rename updates only the display name through the existing owned document PATCH endpoint. Remove changes saved selection through the existing versioned workspace PUT endpoint, preserves the remaining materials and returns to Ask while retaining all saved historical study records. Confirmed DELETE retains the established related-record cascade but now resets a saved workspace only if it references the deleted source. There is no schema migration or API shape change.

Membership/deletion operations flush pending saved work, block duplicate submissions, and use actual request/restoration/assessment state. Root-owned operation tokens persist across tool switches without disabling the existing background-generation navigation. Timed-attempt status survives panel unmount and is cleared on completion. Resource read revisions prevent earlier history reads from restoring deleted items; post-delete refresh failures offer a dedicated retry and never repeat deletion.

## 2D student poses - 2026-11-22

The user replaced the 3D human character with a 2D illustrated student. This decision supersedes the 3D character details in the earlier implementation record. The original local SVG now has eight distinct poses: idle, wave, point, think, read, upload, success and error. Arm geometry, hand gestures, facial expression and props change by pose. The intro uses wave/point/success; tours use pointing, a raised document, thinking, reading and success; the companion follows actual task state. Avatar preferences and cobalt branding remain intact.

The student is always an SVG and never allocates a WebGL canvas. The 3D human geometry and its renderer options have been removed. The ten-second welcome retains its 3D book/cards, immediate skip and shared timeline. Book/folder task scenes remain 3D with the existing fallback and reduced-motion behavior. Student animations are short and disabled by reduced motion; each pose stays recognizable without movement.

Login, library and empty-state scenes also use the same 2D character through StudyArtwork. Earlier generated 3D student PNGs are retained as historical assets and are no longer referenced by the active interface. The generated book logo is unchanged. Account persistence, onboarding APIs and AI settings are unchanged.

## Cobalt student guide and onboarding - 2026-11-22

The selected Cobalt & Porcelain direction supersedes the earlier emerald branding. The final `cobalt.css` layer provides blue controls, navy text, porcelain surfaces, and corresponding dark-theme tokens. Green remains a success color. DM Sans body text, Manrope headings, responsive spacing and existing home scroll effects remain in use. Continue Learning receives the strongest dashboard accent.

The new logo and student/study illustration are generated local PNGs with transparency; original v1 assets are retained. See [assets and exact generation prompts](cobalt-generated-assets.md). The live student uses original articulated Three.js geometry with rounded features, sculpted hair, glasses, backpack, book and expressive poses. Static illustrations are distinct from this interactive model.

Successful manual sign-in or registration starts a ten-second welcome presentation with immediate Skip Intro and Escape support. Session restoration and normal navigation do not replay it. A shared start time keeps late-loading 3D graphics aligned with the logo/book/cards/dashboard timeline. Real account data loads behind the modal; reduced motion bypasses the cinematic sequence. Upload, processing, generation and saving indicators remain tied to actual task states.

Dashboard, Library and Workspace each have four spotlight steps with the student, Back/Next/Skip/Done and Help replay. An optional invitation appears until the section is skipped or completed. Tours explain existing controls without changing learning records or invoking AI. Empty materials remain teachable; a mobile sidebar is temporarily exposed and restored. Focus returns to Help after dismissal. Timed assessments suppress automatic invitations.

Additive schema version 3 stores account-owned onboarding progress independently from study data. GET /api/onboarding returns all sections; authenticated, CSRF-protected PATCH /api/onboarding updates one section, guide version 1, step 0-3 and in_progress/completed/skipped status. Atomic updates prevent delayed writes from reopening terminal sections. The frontend also preserves newer local changes when its initial GET arrives late.

The shared renderer is lazy loaded, caps pixel density at 1.5, targets 30 FPS, pauses in hidden tabs, and disposes resources on exit. Intro, tour, task and companion scenes share a single active canvas; reduced motion and unavailable WebGL use original static SVG artwork.

## Login refinement and home motion - 2026-11-21

Login and registration now share a focused authentication component with a clear single-column form, an illustrated desktop panel, and visible branding on phones and tablets. Labels remain separate from placeholders; password managers and paste work normally. Show/hide password, Caps Lock feedback, disabled controls during submission, focusable error feedback, and cancellation when leaving the page improve the existing authentication flow without changing server endpoints.

The public home page uses bounded 24px lesson-card parallax, 550ms one-time reveals with short staggered delays, a reading-progress line, a sticky header shadow, and hover depth on the study-tool previews. Native scrolling and anchors are retained. Reduced motion immediately cancels entrance animations and disables parallax, the progress effect, hover transforms, and smooth scrolling. Content is never initially hidden in CSS, so it stays available if animation support is absent. Existing dashboard reveals remain quiet; study content and assessments do not acquire scroll effects.

Installed Frontend Design and UI UX Pro Max guidance informed the form hierarchy, touch targets, readable text, and motion restraint. The existing generated logo/artwork and modern font system are reused. Active styling for this refinement lives in `auth-home.css`, following the general modern presentation layer.


## Modern typography and spacing - 2026-11-21

The user requested a more modern presentation after the retro implementation. The active `modern.css` layer replaces hard offset shadows, striped chrome, and dense small text with a spacious green learning workspace. Body and controls use locally bundled DM Sans Variable; headings and activity totals use Manrope Variable. The earlier Inter dependency was removed.

Light tokens: ground #F4F7F6, surface #FFFFFF, text #1B302B, muted #586B63, accent #246B55, subtle accent #E5F1EA. Dark mode uses the same hierarchy with #14201C ground, #1E2D26 surface, #EFF5EF text, and #A5D9B9 accent. The spacing rhythm uses 8/12/16/24/32px increments, desktop page gutters of 40px, mobile gutters of 20px, and differentiated 10px controls, 16-20px panels, and 24px profile surfaces.

Reading text and form inputs use 16px, with 1.7-1.85 reading line height and approximately 70-character reading widths. Secondary labels use 12-14px. Headings have a consistent scale, balanced wrapping, and variable weights. Profile/continue panels, activity totals, history, upload area, study tools, forms, dialogs, welcome, and startup share the updated system. Frames are quieter so the existing student illustration and original 3D task objects carry the character.

The user also requested a generated logo, related icons, and imagery. The app now uses an original generated book/conversation mark, a matching transparent study illustration, and custom SVG study/navigation icons. See [assets and generation prompts](generated-brand-assets.md).

Installed Frontend Design and UI UX Pro Max guidance informed the type hierarchy, touch spacing, focus, and mobile readability. The account/storage/API behavior and task animation lifecycle are unchanged. The responsive browser matrix checks loaded font family, overflow, dock bounds, themes, and saved-state workflows; captures use `artifacts/modern-*.png`.


## Retro Study Studio motion - 2026-11-21

The approved neutral retro identity now includes local 3D book/folder scenes, compact saving bookmark feedback, a skippable startup that ends on readiness, short public/dashboard entrances, and a restrained green profile accent. See [implementation and Gemini setup](retro-study-studio.md). Existing account records, persistence requests, and assessment flows are retained. Three.js is loaded on demand; reduced motion and graphics failures use static original SVG artwork.

## Neutral retro desktop update - 2026-11-15

The approved neutral desktop direction supersedes the green companion treatment below. Shared window labels, dark outlines, hard offset shadows, paper reading surfaces, and a four-destination navigation dock carry the reference images into a responsive learning workspace. Window chrome labels panels; controls only perform real actions.

Tokens: desktop #D8D6D0, chrome #EEEAE2, reading #FFFDF8, ink #263039, accent #4E6B7F, success #32705D. Inter stays bundled. Dark mode retains the same hierarchy. Dashboard pairs the student profile with the saved workspace, followed by real activity totals, companion help, and searchable history.

The original vector student occupies task-window scenes. Transfer carries a paper, processing adds a magnifying glass, and existing saved-success/error reactions remain tied to real application events. Account-specific visibility, collapse controls, reduced motion, and practice-test suppression are preserved. No storage schema or AI provider changes were made.

Installed Frontend Design and UI UX Pro Max guidance informed composition, visible focus, dock spacing, responsive layouts, and motion restraint. The redesign skill guided reuse of existing components. The approved Inter and neutral palette override generic font/color suggestions.


## Study Companion update — 2026-11-07

The approved direction supersedes the original indigo palette below: light green/white surfaces, deep green actions, rounded account panels, and an original illustrated human companion. `inspiration1.jpg` informs the cover/avatar/profile composition; `inspiration2.png` and `inspiration3.png` inform the task-aware character idea. The originals are reference material only, not bundled third-party artwork. Their still frames do not establish exact motion choreography.

New components separate the illustration, account pages, assessment, and versioned-save hook from the existing workspace. Main light tokens: ground #f3f6f1, surface #ffffff, ink #23392f, muted #586d61, accent #23674d. Dark mode uses #131d18 ground, #1e2b23 surfaces, #eef6ef text, #b3c8b9 secondary text, and #9cd8b3 accents. Inter remains bundled locally.

Profile presets change wardrobe/hair palettes. The companion's brief pose reactions follow actual upload/processing/success/error events; no voice or synthetic human identity is claimed. It can be hidden per account, and motion respects device preferences. Practice tests suppress it to avoid distracting or revealing hints. Account counts always come from stored records, with loading placeholders until retrieval completes.

Validation includes cross-session/new-browser resume, stale-save recovery, failed-load retry, pending written-answer flush, background generation navigation, expired sessions, mobile/dark/reduced-motion behavior, and observed screenshots. Online service behavior remains subject to deployment testing.

## Original design record

Audience: students studying their own uploaded course materials. Main task: turn a difficult lesson into an explanation and then practice it.

Installed skills applied: UI UX Pro Max for interaction/accessibility and reusable tokens; Frontend Design for composition and plain interface copy; Design Taste Frontend for the public page only; ponytail for focused implementation.

The Taste draw offered “page-is-the-object”, “colour-chapters”, and “borrowed-category”. Chosen: page-is-the-object. On this page, a student's lesson sheet becomes the interactive Read / Ask / Recall object. Keep the supplied brand palette and Inter font; the actual app supplies four interface screenshots. The drawn photo-led dim-room hero needs assets that do not exist, so the product interface supplies the visual material. No testimonials or unmeasured statistics are added.

The supplied guide's indigo/violet identity takes precedence over conflicting skill defaults. Welcome uses flat tonal fields; app uses filled surfaces, practical tab navigation, and modest interaction feedback. No generated decorative imagery is needed.

Core light tokens: ground #f7f8fc, surface #ffffff, ink #202337, muted #62687c, accent #5145cd, success #18745b. Dark tokens use #161925 / #202432 surfaces, #f2f3fb ink, #b2b9cf secondary text, #b2a6ff accent. Inter 400/500/600/700 is bundled locally. Information is left-aligned; welcome has a two-column lesson-sheet composition, Library a responsive material grid, Workspace a narrow library rail plus a large task panel.

The UI UX Pro Max searches returned generic testimonial/marketing patterns without evidence suitable for this project. Those recommendations were rejected; functional spacing, accessibility, responsive behavior, and low-cost motion guidance were retained.

Quality checks: 375px mobile app, 390/768/1440px welcome; both themes; keyboard focus; native dialog focus containment and Escape; reduced motion; no forced entrance delay or fake progress counters. Progress indicators represent actual network upload or completed learning steps.
