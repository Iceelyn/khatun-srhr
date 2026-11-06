# Naiz (Найз): a private, doctor-backed sexual health companion for young women in Mongolia

> **Status: prototype.** The knowledge base is a draft awaiting review by our clinical team. Not for public use yet.

## The problem

Mongolia's cervical cancer death rate is among the highest in the region. About 16,000 STI infections are recorded each year, with syphilis rising among people in their 20s. The HPV vaccine and cervical screening are free, yet vaccine coverage for 11-year-olds is around 50–60% and only about 38% of eligible women are screened. Young women avoid gynecologists because of shame, fear of being seen and a lack of trustworthy information, so infections go unnoticed and cancer is found late.

The services exist. Naiz helps young women actually use them. Evidence and sources: [`research/01-desk-evidence.md`](research/01-desk-evidence.md).

**Project page (English / Монгол):** `docs/index.html`, published with GitHub Pages at https://iceelyn.github.io/khatun-srhr/ once Pages is turned on. Results shown there come from [`docs/evidence.json`](docs/evidence.json); empty values are hidden.

## What it does

1. **Anonymous chat** in Mongolian (Cyrillic or Latin letters) and English, on Facebook Messenger and the web. Answers come only from a knowledge base our doctors write and approve.
2. **"Should I get checked?"**: a 2-minute private check that suggests which test makes sense and how soon. It's not a diagnosis. Answers are not stored.
3. **Clinic finder** that always shows free public services first, then verified partner clinics.
4. **Safety layer**: messages about self-harm, sexual assault, violence or emergencies get a fixed, doctor-approved reply with emergency numbers, and never go to the AI model.
5. **Anonymous stats**: counts of questions, topics, check results and thumbs up/down, with no message text and no identities.
6. **Tester feedback** (`/feedback`): an anonymous usability-test form. Testers do 3 tasks, rate the experience and leave comments.
7. **Team results page** (`/results`, password-protected): shows tester ratings, task success, usage, interview themes and survey results; the team triages each comment (P0–P3, MoSCoW) and exports CSV.

## How it works

```
User (Messenger or web)
   │
   ▼
Safety check ──► red flag? ──► fixed reply with emergency numbers
   │ no
   ▼
AI model + doctor-approved knowledge base (kb.csv)
   │   answers only from approved entries; cites entry ids for audit
   ▼
Reply + "Check" and "Clinics" buttons ──► check page (rules set by doctors) ──► clinic list (free first)
```

- `src/server.js`: web server, Messenger webhook, web chat and check APIs
- `src/answer.js`: safety check → AI model → keyword fallback
- `src/safety.js`: red-flag patterns and fixed replies
- `src/llm.js`: AI model call, grounded in the knowledge base
- `src/triage.js`: rules for the private check (doctor-reviewed)
- `src/messenger.js`: Messenger signature check and sending
- `src/feedback.js`: tester feedback and interview validation, privacy scrubbing, summaries
- `src/store.js`: storage (local files, or Supabase when configured)
- `src/survey.js` + `scripts/summarize-survey.js`: survey export to anonymous counts
- `db/schema.sql`: database tables (Supabase / Postgres)
- `knowledge-base/kb.csv` and `kb.xlsx`: Q&As, one row per answer
- `public/`: welcome (onboarding), web chat, check and feedback pages (Mongolian and English); team results page
- `public/styles.css` + `public/nav.js`: shared design (soft lavender palette, rounded cards, flower bot avatar, bottom tab bar)
- `eval/`: test questions for doctors to grade the AI's answers
- `research/`: desk evidence, research protocol, internal QA and findings
- `docs/`: bilingual project page for GitHub Pages; `evidence.json` holds the results it shows
- `src/ratelimit.js`: per-endpoint rate limits (protects the AI budget)
- `eval/routing.csv`: the expected answer for each of the 30 test questions, checked by `npm test`

No external packages. Node.js 20+ only.

## Run it locally

```bash
cp .env.example .env    # add your keys (or leave the AI key empty)
npm test                # 24 tests: knowledge base, all 30 eval questions, safety, triage, rate limits, Messenger, feedback, survey
npm start               # http://localhost:3000 (chat; first visit shows /welcome), /check, /feedback, /results
```

Without `ANTHROPIC_API_KEY` the bot runs in keyword mode, matching the closest knowledge-base entry and answering in English. With a key, the AI model answers in the user's language using only knowledge-base content.

## Put it online for user testing

Any Node host works (Render, Railway, Fly.io or a VPS). Set the environment variables from `.env.example`, start command `npm run dev` (the host supplies the variables), and share `https://<your-host>/feedback` with testers (it links to the chat and check). Set `TEAM_TOKEN` and connect Supabase first (below).

## User testing and the results page

| Page | Who | What |
| --- | --- | --- |
| `/survey` | Anyone 18+ | Anonymous 3-minute problem-validation survey (MN/EN). Answers go straight to Supabase and show live on /results > Survey. |
| `/feedback` | Testers | Anonymous form: 3 tasks, four 1–5 ratings, three comments, 18+ consent. Phone numbers, emails and links typed by mistake are removed before saving. Testers can add feedback but never read it. |
| `/results` | Team only (`TEAM_TOKEN`) | Overview (ratings, task success, usage, findings table to copy), tester feedback triage, interview tracker, survey summary, AI feedback analyzer, CSV export. |

How to run a test round, log interviews, summarise the survey and what may be published: [`research/README.md`](research/README.md).

### Database

By default data is saved to `data/*.jsonl` (ignored by Git). **Free hosting wipes these files on restart**, so for a hosted test:

1. Create a free project at supabase.com.
2. SQL Editor: paste and run [`db/schema.sql`](db/schema.sql). It creates `tester_feedback`, `interviews`, `events` and `survey_responses` with Row Level Security on and no public access. Safe to run again after updates.
3. Project Settings > API: set `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` (service_role key) on the server only. Restart.

The browser never talks to the database directly: testers can only insert through `/api/tester-feedback`, and reading or editing needs the team token. You can also browse the tables in Supabase's Table Editor.

### Check your setup

Open `https://<your-host>/health`. It shows whether things are set up, never the secret values:

- `"team_token_set": true`: the server has `TEAM_TOKEN`, so `/results` will open.
- `"storage": "supabase"`: tester feedback is kept in Supabase and survives restarts. `"file"` means it will be lost.

Environment variable **names** must be exactly `TEAM_TOKEN`, `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. Your password goes in the **value**. On Vercel, redeploy after changing variables.

### Team workflow (GitHub)

- `main` always works. Make a branch for each change (`fix/clinic-link`), open a pull request, merge when `npm test` passes.
- Every P0/P1 from triage becomes an issue (template: "User feedback issue"). Put the issue number in the team note on `/results`.
- Never commit `.env`, API keys or anything from `research/raw/`.

## Connect Facebook Messenger

1. Create a Facebook Page and a Meta for Developers app with the Messenger product.
2. Generate a Page access token (`FB_PAGE_TOKEN`); copy the App Secret (`FB_APP_SECRET`); choose any `FB_VERIFY_TOKEN`.
3. Set the webhook URL to `https://<your-host>/webhook` and subscribe to `messages` and `messaging_postbacks`.
4. Add a "Get Started" button to the Page.

While the app is in development mode, only people with a role on the app (admins, developers, testers) can usually chat with the bot. Opening it to the public requires Meta's App Review. Check Meta's current Messenger Platform documentation. Use the web chat for user testing until then.

Privacy note: Messenger is not anonymous to the Page owner or to Meta. That's why the sensitive symptom check runs on our own page with no login.

## Updating the knowledge base

1. Doctors edit `knowledge-base/kb.xlsx` (one row per question). See the "How to review" sheet.
2. When an entry is correct, set `status` to `approved` and add the reviewer's name.
3. Save as CSV (UTF-8) to `knowledge-base/kb.csv` and restart.
4. With `APPROVED_ONLY=true`, only approved entries are used. **This must be on before any real user sees the bot.**

## Grading answer quality

```bash
ANTHROPIC_API_KEY=... npm run eval
```

This writes `eval/results.csv`. Both doctors mark each answer accurate and safe (yes/no).

## Privacy and safety

- No names, phone numbers or Facebook IDs are stored or sent to the AI model.
- The check page doesn't store answers; only the result level is counted.
- Metrics store event type, knowledge-base entry ids, red-flag type and feedback, never message text.
- Red-flag messages bypass the AI. Mongolian wording and phone numbers must be verified before launch.
- Tester feedback is anonymous and limited to adults (18+ consent). Interview records use codes, never names. Raw research data is never committed (see `research/README.md`).
- The bot never diagnoses or names medicines or doses.

## Roadmap

- Doctor review and approval of all knowledge-base entries; Mongolian versions written by the team
- Mongolian voice input
- Clinic dashboard and booking with 2–3 pilot sites
- Reminders (Messenger and SMS), anonymous partner notification
- Parents' HPV vaccine module
- Data protection review; pilot with district health department partners

## Licences

- Code: [MIT](LICENSE)
- Knowledge base: [CC BY 4.0](knowledge-base/LICENSE.md)

## Team

[Names, roles and the two doctors' specialties]

## Disclaimer

Naiz gives general health information, not medical advice or diagnosis. In an emergency in Mongolia call 103.
