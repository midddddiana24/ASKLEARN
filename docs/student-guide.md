# Your ASKLearn student guide

Your student guide is a 2D illustration with distinct welcoming, pointing, thinking, reading, upload, success and error poses. The study books and task indicators keep their 3D animations.

After signing in or creating an account, a ten-second welcome introduces your study space. **Skip Intro** works immediately, and Escape skips it too. Refreshing an authenticated session does not replay the intro. Your device's reduced-motion setting bypasses the cinematic welcome.

New to a page? Choose **Show me around** in the optional invitation. The student highlights four useful areas on Dashboard, My library or Workspace. Use **Back**, **Next**, **Skip tour**, and **Done**. **Help**, above the navigation dock, restarts the current page's guide.

Each page remembers your guide progress in your account. An interrupted tour can be resumed; a completed or skipped tour does not automatically reopen. You can replay it through Help whenever needed. Profile's companion preference controls automatic guide invitations; manual Help remains available.

The guide only explains controls. You choose when to upload, generate a study tool or begin an assessment. An empty library is expected: upload a material before selecting it or opening a study workspace.

Upload percentage describes actual file transfer. Processing, generation and saving have separate indicators. **Saved** appears only after server acknowledgement. The welcome animation does not represent data-loading progress.

If guide progress cannot sync, studying remains available and the notification offers **Retry**. The student guide works without 3D graphics; study-object animations use static artwork when WebGL is unavailable. Timed assessments suppress automatic invitations and keep their normal server deadlines.

To activate an update, stop the existing server with Ctrl+C in its console, then reopen **Start ASKLearn.cmd** and visit **http://127.0.0.1:8000**. Startup applies the additive onboarding migration and backs up an existing SQLite database before upgrading it.
