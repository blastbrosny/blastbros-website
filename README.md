# Blast Bros Website

## What's in this folder
- `index.html` — the website itself
- `netlify/functions/reviews.js` — a small serverless function that stores and
  retrieves customer reviews using Netlify Blobs (built-in storage, free, no
  external signup needed)
- `netlify.toml` — tells Netlify where the function lives, and adds a friendly
  `/api/reviews` shortcut so the website doesn't need to know the long
  `.netlify/functions/...` path
- `package.json` — lists the one dependency (`@netlify/blobs`) the function
  needs; Netlify installs this automatically when it builds your site

## IMPORTANT: this requires a different deploy method than before

Drag-and-drop deploy (the way you deployed before) does **not** support
serverless functions. To make reviews actually persist for every visitor,
you need to switch to a **Git-based deploy** — connecting Netlify to a GitHub
repository instead of dragging a file in.

### How to switch, step by step:

1. **Create a free GitHub account** at github.com, if you don't have one.
2. **Create a new repository** (e.g. `blastbros-website`) — keep it private
   or public, either works.
3. **Upload these files** to that repository. The easiest way: on the
   repository's GitHub page, use "Add file → Upload files" and drag in this
   entire folder (keeping the `netlify` subfolder structure intact).
4. In your **Netlify dashboard**, go to your existing Blast Bros site.
5. Go to **Site configuration → Build & deploy → Continuous deployment**,
   or create a **new site** and choose **"Import an existing project"** →
   connect to GitHub → select your new repository.
6. Netlify will detect `netlify.toml` automatically and build the function.
7. Once deployed, your booking form (still using Netlify Forms) and your new
   review system (using this function + Blobs) will both work — and reviews
   will now show up for every visitor, not just in the browser that submitted
   them.

### Where do reviews get stored?

In a Netlify Blobs store called `blastbros-reviews`. You don't need to set
this up manually — Netlify creates it automatically the first time the
function runs. You won't see it in the regular dashboard the way Forms
submissions show up, but the data is safely persisted and tied to your site.

### What changed about the review form?

Before, review submissions went to **Netlify Forms** (so you'd get an email,
but the review never actually appeared on the live site for other visitors).

Now, review submissions go to **this function**, which saves them permanently
and serves them back to the page every time someone visits. You will no
longer get an email notification for new reviews specifically — if you want
that back, let me know and I can add it as a notification step inside the
function.

The booking form is untouched and still uses Netlify Forms, so you'll keep
getting emailed for new appointment requests exactly as before.
