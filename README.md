# Slowpitch Lineup Builder (Phase 1)

A mobile-first lineup builder for slowpitch softball: roster management, a
10–14 player batting order, and a tap-to-place fielding diamond. Data saves
automatically to your browser's `localStorage` — nothing leaves your device.

## Run it locally

1. Install [Node.js](https://nodejs.org/) 18 or newer if you don't have it.
2. In this folder, install dependencies:

   ```
   npm install
   ```

3. Start the local server:

   ```
   npm run dev
   ```

4. Open the URL it prints (usually `http://localhost:5173`) in your browser.

## Using it on your iPhone

The dev server is also reachable from other devices on the same wifi network.
After running `npm run dev`, look for a line like:

```
➜  Network: http://192.168.1.23:5173/
```

Open that address in Safari on your iPhone to test the real mobile layout.
(Your laptop and phone need to be on the same wifi network for this to work.)

## Deploying to GitHub Pages

1. Create a new repository on GitHub and push this project to it (if you haven't already):

   ```
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```

2. Open `vite.config.js` and change the `GITHUB_REPO_NAME` constant at the top
   to match your repository's name **exactly** (case-sensitive):

   ```js
   const GITHUB_REPO_NAME = "your-repo-name";
   ```

   Commit and push that change.

3. On GitHub, go to your repository's **Settings → Pages**, and under
   "Build and deployment," set **Source** to **GitHub Actions**.

4. That's it — the workflow in `.github/workflows/deploy.yml` will build and
   publish the site automatically on every push to `main`. Check the
   **Actions** tab on GitHub to watch the deploy run. Once it finishes, your
   site is live at:

   ```
   https://<your-username>.github.io/<your-repo-name>/
   ```

**Important — data doesn't carry over:** `localStorage` is tied to the exact
URL a page is loaded from. Any roster/lineup data you saved while testing on
`localhost` will **not** appear on the deployed `github.io` site — they're
separate storage buckets as far as the browser is concerned. This is
expected, not a bug.

## Responsive layout

Below 1024px wide (phones, and narrow browser windows), the app is a single
scrolling column. At 1024px and wider (most laptops), it switches to a
two-column layout — the fielding diamond on the left, roster and batting
order in a sticky sidebar on the right — using a CSS breakpoint, so resizing
a browser window switches the layout live with no reload needed.

## Notes

- No separate CSS/design system is needed — styling is built into the
  component with inline styles, plus `src/index.css` for basic page resets.
- Data lives in `localStorage`, scoped to whatever URL you load the app from.
  If you later deploy this to a real domain, that's a fresh, empty storage
  bucket — it won't carry over data saved while testing on `localhost`.
- This is Phase 1 of the full plan: roster CRUD, batting order, a
  single-inning fielding diamond, and auto-save. Multi-inning tracking,
  re-entry rules, stats, and printing come in later phases.
