# Wheelhouse LivePro Training

Staff enter their name to watch three lessons, with pause and resume and no seek bar. Open Management from the training page or at `/dashboard` to see each person's watch progress and remove entries with the × button.

## Upload to GitHub

Extract both ZIPs. Upload the contents of Part 1 to the repository root and commit. Then upload the `components` folder from Part 2 to the same repository root and commit. On macOS, press Command + Shift + . in Finder to show hidden files before selecting the Part 1 contents.

## Hosting

Use Node.js 22.13 or newer. Run `npm ci` and `npm run build`. Use a Cloudflare D1 binding named `DB` and apply the migration in `drizzle/`. Set the runtime secret `TRAINING_ADMIN` to your chosen Management password. Staff sign in with a name only. The videos stream from LivePro.

The ZIPs contain source code. Deploy the combined project to run the app.
