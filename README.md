# olamdev_bch201 - OlamDev BCH201 Quiz

**Biochemistry 201 - Amino Acids & GI Digestion.**
A free, installable quiz app (PWA) with 444 multiple-choice questions taken only from the two BCH201 lecture notes.
Plain HTML + CSS + JavaScript. No npm, no build step, no backend, no login, no API keys.

## Files

```
olamdev_bch201/
  index.html     the page
  style.css      themes, layout, animations
  app.js         quiz logic, scores, settings, PWA install
  questions.js   all 444 questions
  manifest.json  PWA manifest (icons are inline SVG data URIs)
  sw.js          service worker (offline support)
  README.md      this file
```

## Try it on your computer

Double-click `index.html`. The quiz works straight away.
(Installing as an app and offline caching only work from an `https://` link, which Vercel gives you below.)

---

## Step 1 - Create a GitHub repository

1. Go to https://github.com and sign in (create a free account if needed).
2. Click the **+** at the top right, then **New repository**.
3. Repository name: `olamdev_bch201`.
4. Choose **Public** (Private also works with Vercel).
5. Leave "Add a README" **unticked** (you already have one).
6. Click **Create repository**.

## Step 2 - Upload the files (no Git needed)

1. On the new empty repository page, click **uploading an existing file**.
2. Open the `olamdev_bch201` folder on your phone or PC and select **all 7 files**
   (`index.html`, `style.css`, `app.js`, `questions.js`, `manifest.json`, `sw.js`, `README.md`).
   Drag them in or use **choose your files**.
   Make sure the files sit at the top level, not inside another folder.
3. Wait for the uploads to finish, then click **Commit changes**.

<details>
<summary>Prefer the command line?</summary>

```bash
cd olamdev_bch201
git init
git add .
git commit -m "OlamDev BCH201 Quiz"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/olamdev_bch201.git
git push -u origin main
```
</details>

## Step 3 - Connect the repository to Vercel

1. Go to https://vercel.com and click **Sign Up**, then **Continue with GitHub**.
2. Click **Add New...** then **Project**.
3. Find `olamdev_bch201` in the list and click **Import**.
   (If you do not see it, click **Adjust GitHub App Permissions** and allow access to the repository.)
4. Settings screen - leave everything as it is:
   - Framework Preset: **Other**
   - Build Command: leave empty
   - Output Directory: leave empty
   - Install Command: leave empty
5. Click **Deploy**.

## Step 4 - Make it live

1. After about 30 seconds Vercel shows "Congratulations". Click the preview image or **Visit**.
2. Your app is live at a link like `https://olamdev-bch201.vercel.app`.
3. Share that link on WhatsApp. Open it once with internet and the app is cached for offline use.

### Install it like a real app

- **Android (Chrome):** tap **Install** in the top bar (or menu ⋮, then **Install app**).
- **iPhone (Safari):** Share button, then **Add to Home Screen**.
- **Laptop (Chrome/Edge):** click the install icon in the address bar.

If you open the link inside WhatsApp's built-in browser, tap ⋮ then **Open in Chrome** before installing.

### Update the app later

Edit a file on GitHub (pencil icon) and commit. Vercel redeploys automatically.
After changing any file, open `sw.js` and change `olamdev-bch201-v1` to `olamdev-bch201-v2` (then `v3`, ...)
so phones download the new version instead of the cached one.

---

## Features

- **Topics:** 19 topics with checkboxes and question counts; Select All / Clear All; toggle a whole note at once.
- **Quiz length:** 10, 20, 30, 50, 100 or All.
- **Modes:**
  - *Practice* - answer and explanation shown immediately, no timer.
  - *Exam* - no answers until the end, countdown timer (45 s per question overall), auto-submit at zero.
  - *Timed / Track* - 60 s per question, auto-next when time ends, no going back.
  - Timer is visible; Exam and Timed have a Pause button.
- **Fair shuffling:** questions and answer options are reshuffled every quiz. Questions do not repeat within a session until the whole selected pool has been used or you restart.
- **Results:** score ring, percentage, grade (A 70+, B 60-69, C 50-59, D 40-49, F below 40), Pass/Fail (pass = 50%), correct / wrong / skipped, full review with explanations, Retake / New Quiz / Go Home.
- **My Scores:** total quizzes, average, best, last, progress and accuracy per topic (strong / weak), history (date, topics, mode, score, time used) and **Clear History**. Saved in `localStorage`, so it survives refreshes.
- **Settings:** 8 themes (Light, Dark, Green, Blue, Purple, Pink, Orange, Black/AMOLED), 4 backgrounds (Plain, Gradient, Pattern, Image - all pure CSS), 3 font sizes. Saved and applied instantly.
- Keyboard shortcuts on desktop: `1-4` or `A-D` to answer, arrow keys to move.

## Question bank notes

Source: `BCH201_Amino_Acids_Notes` and `GI_Digestion_Explanatory_Notes`.

- 100 + 130 questions are the unique objective questions that appear in the notes (the notes repeat their questions with reworded stems or "Review item" labels; each is included once).
- 214 more questions were written directly from the explanatory text (Part I) of the notes, so every question traces back to the lecturers' material. Each question's `source` field says where.
- A few items rely on facts that appear only in the notes' own question bank (for example Ebner's glands for lingual lipase); their explanations say so.
- No question uses "All of the above".

To add questions, append objects to `questions.js` in the same format:

```js
{"topic":"Amino Acids - Classification","question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","difficulty":"Easy","source":"...","id":445}
```

`correctAnswer` is the index (0-3) of the right option; the app reshuffles options on every quiz.

## Troubleshooting

- **Install button does nothing / no install prompt:** use the https Vercel link (not a local file) and open it in Chrome (Android/desktop) or Safari (iPhone). The icons are inline SVG as requested; if a very old browser refuses SVG icons, use "Add to Home Screen" from the browser menu.
- **Old version still showing after an update:** bump the version in `sw.js` (see above), then close and reopen the app twice.
- **Scores missing:** scores live in the browser on that device. Clearing site data or using private mode removes them.
