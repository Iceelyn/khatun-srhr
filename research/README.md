# Research: what goes where

This folder holds the evidence for Naiz. Two rules:

1. **Raw data never goes on GitHub.** Survey exports, interview notes, recordings and consent records stay in `research/raw/` (ignored by Git) or in the team's private Google Drive.
2. **Only anonymised summaries are committed**, and every number in them must come from data we actually collected.

| File | What it is | Commit? |
| --- | --- | --- |
| `01-desk-evidence.md` | Published studies and official statistics, with links | Yes |
| `02-protocol.md` | How we ran the survey, interviews, prototype test and doctor grading | Yes |
| `04-internal-qa.md` | Team QA before user testing: answer routing, end-to-end flows, bugs found and fixed | Yes |
| `03-findings.md` | Our results: counts, themes, short anonymous quotes, what we changed | Yes, once filled in with real data |
| `survey-summary.md` / `.json` | Survey counts made by `npm run survey` (no written answers, no identity columns) | Yes, after checking |
| `raw/` | Survey export, interview notes, tester lists, consent records | **Never** |

## The research loop

```
Survey (/survey page) ──► Supabase ──► /results Survey tab ──┐
Interviews ──► log on /results (Interviews tab) ───────────────┤
Prototype test ──► testers fill /feedback ──► triage on /results ├──► 03-findings.md ──► application
Chat + check usage ──► anonymous counts on /results ───────────┘
```

## 1. Online survey

The survey is built into Naiz at **`/survey`** (questions from `02-protocol.md`, section A). Answers go straight into the `survey_responses` table in Supabase, so there's nothing to download or upload.

1. Run the latest `db/schema.sql` in the Supabase SQL Editor once (it creates `survey_responses`). It's safe to run again.
2. Share `https://<your-host>/survey` (Mongolian) or `https://<your-host>/survey?lang=en` in university groups and young women's Facebook groups. It's anonymous, asks no name, email or phone, and only accepts people who confirm they are 18+.
3. Watch results live on **/results > Survey**. "Export survey CSV" downloads every answer, including the written ones.
4. Theme the written answers ("What would make you more likely to get a check-up?") by hand. Phone numbers, emails and links are removed automatically. Pick 1–2 short quotes with no identifying details.
5. Copy the key numbers into `03-findings.md`, section 1.

Already ran a Google Form? `npm run survey -- research/raw/survey.csv` still works: it writes `research/survey-summary.json`, which the Survey tab shows until the first `/survey` answer arrives.

## 2. Interviews

1. Use the consent script and questions in `02-protocol.md` (section B). Take notes on paper or in `raw/`; record audio only if the person agrees, and delete it after writing notes.
2. Give each person a code: `W01, W02…` (young women), `H01…` (health workers), `P01…` (parents). Keep any link between codes and real people offline, or don't keep one at all.
3. Right after each interview, log it on **/results > Interviews**: code, group, month, key points, one optional quote, and themes (for example `shame, privacy, cost`). The tracker refuses names and needs the consent box ticked.
4. When all interviews are in, look at "Themes across interviews", group them into 3–4 themes and write them up in `03-findings.md`, section 2. Export the CSV as a backup to `raw/`.

Never write down whether anyone has or had an STI, their sexual history, or anything about a named third person.

## 3. Prototype user test (usability test)

1. Put the app online (see main README) and set `TEAM_TOKEN`. Connect Supabase (`db/schema.sql`) so feedback survives restarts, or export CSV after every session.
2. Recruit testers who match our early adopters: women aged 18–29, plus a few health workers and parents. Quality matters more than numbers; 10–20 good testers is enough.
3. Each tester opens `/feedback`, does the 3 tasks (ask the chat, do the check with made-up answers, find a free clinic), then rates and comments. If you're testing in person, watch quietly and note where they get stuck.
4. On **/results > Tester feedback**, triage every comment:
   - **Category:** bug, usability, missing feature, enhancement (or positive / not actionable)
   - **Priority:** P0 blocks the core journey (fix before anything else), P1 major pain with a workaround, P2 minor, P3 cosmetic
   - **MoSCoW:** must, should, could, won't (for this iteration)
5. Open a GitHub issue for every P0 and P1 (template: "User feedback issue"), fix it on a branch, merge with a pull request, then set the status to Fixed and put the issue number in the team note.
6. Optional: the **AI analysis** tab groups comments into themes and suggests priorities. Check every theme and count against the actual comments before using it; the team makes the final call.
7. Copy the numbers from **Overview > Copy into 03-findings.md** and list the changes you made in section 5.

## 4. Showing the data in the application

- **Repository:** link the README; reviewers can open `research/03-findings.md`, `survey-summary.md` and the code that collects the data (`public/feedback.html`, `public/results.html`, `db/schema.sql`).
- **Screenshots:** take screenshots of `/results` (Overview, Tester feedback with triage, Interviews themes) after real testing. Don't show raw comments that could identify someone.
- **Numbers:** quote them as "X of N" when N is small (for example "11 of 14 testers felt it was private"), give the dates and who took part, and say what the data can't show (self-reported intention, not clinic visits).
- **Quotes:** short, anonymous, with permission, labelled only by group and age range ("woman, 20s").
- **Never** invent, round up or "estimate" results, and never publish raw exports.
