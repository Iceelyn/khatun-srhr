# Internal QA before user testing (v0.3)

**Date:** 3 November 2026
**Who:** the team, plus automated checks. No users took part. This is the "internal team QA" step that comes before testing with early adopters.
**Build tested:** branch `claude/intelligent-babbage-i7qiof`, keyword mode (no AI key), local server.

These are real results from running the prototype. User research results go in `03-findings.md` once collected.

## 1. Answer routing: 30 test questions

Every question in `eval/questions.csv` (Mongolian Cyrillic, Latin-script Mongolian, English) was sent to `/api/ask`. We checked whether each one reached the right knowledge-base entry, the fixed red-flag reply or the safe "no answer" reply.

| | Before fixes | After fixes |
| --- | --- | --- |
| Reached the expected entry | 24 of 27 | 27 of 27 |
| Crisis messages (self-harm, assault) given the fixed emergency reply, bypassing the AI | 2 of 2 | 2 of 2 |
| Off-topic question declined safely | 1 of 1 | 1 of 1 |
| **Total handled as expected** | **27 of 30** | **30 of 30** |
| Medicine or dose named (q17 asks for one) | 0 | 0 |

The three misroutes:

| Question | Went to | Should go to | Why | Fix |
| --- | --- | --- | --- | --- |
| q24 "My boyfriend checks my phone and gets angry. Is that normal?" | discharge-normal | healthy-relationship | "normal" tied with "boyfriend"; ties go to the first entry | Added relationship keywords (checks, angry, controlling, утас шалгадаг, уурладаг, хардадаг) |
| q07 "ХПВ вакцин үргүйдэл үүсгэдэг үү?" | hpv-vaccine-what | hpv-vaccine-fertility | Tie between the two vaccine entries | Added "hpv хпв" to the fertility entry |
| q10 "Хэдэн настайгаас Пап шинжилгээ өгөх вэ?" | cervical-screening-what | cervical-screening-when | "Пап шинжилгээ" only listed on the "what" entry | Added "пап шинжилгээ хэдэн настайгаас" to the "when" entry |

q24 matters most: a young woman describing controlling behaviour got an answer about vaginal discharge. The doctors' answers were not changed, only the keywords used to find them.

**Kept from regressing:** `eval/routing.csv` stores the expected route for all 30 questions, and `npm test` now fails if any of them changes. We confirmed the test fails on the old knowledge base.

**Not yet tested:** answers from the AI model (needs `ANTHROPIC_API_KEY`) and whether doctors rate them accurate and safe. That is the doctor grading step in `02-protocol.md`.

## 2. End-to-end flows: 3 screen sizes

Automated browser run (Chromium) at 360×740 and 390×844 (phones) and 1366×768 (laptop). Each step is something a tester does in the usability test.

| # | Flow | 360 | 390 | 1366 |
| --- | --- | --- | --- | --- |
| 1 | First visit shows the 3-step welcome and lands on the chat | Pass | Pass | Pass |
| 2 | Tap a suggested question, get an answer, tap "Helpful" | Pass | Pass | Pass |
| 3 | Type a Mongolian question, get an answer | Pass | Pass | Pass |
| 4 | Switch MN → EN; page and tab bar change language | Pass | Pass | Pass |
| 5 | Do the check; get a result with free clinics listed first | Pass | Pass | Pass |
| 6 | "Clinics" tab opens the clinic list | Pass | Pass | Pass |
| 7 | Feedback form refuses without consent, saves with consent | **Fail → Pass** | **Fail → Pass** | **Fail → Pass** |
| 8 | Team page: wrong token refused, right token opens | Pass | Pass | Pass |
| 9 | No sideways scrolling on public pages | Pass | Pass | Pass |
| 10 | No JavaScript errors | Pass | Pass | Pass |

**Final run: 30 of 30 checks pass.** Not covered: Safari/iOS, Firefox, real devices, slow networks. These need a manual check on team phones before the first test session.

## 3. Findings, triaged

Triaged with the same rules as tester feedback: P0 blocks the core journey, P1 is a major problem with a workaround, P2 minor, P3 cosmetic.

| Finding | Category | Priority | MoSCoW | Status |
| --- | --- | --- | --- | --- |
| Feedback form fails with "Something went wrong" after a tester has used the chat and check. All endpoints shared one rate-limit counter per IP (feedback limit 10 per 10 min), so a few chat questions used it up. Testers on the same Wi-Fi share an IP, so in a group session feedback stops for everyone within minutes. | Bug | **P0** | Must | **Fixed.** Separate counter per endpoint (`src/ratelimit.js`), limits raised and configurable (`RATE_LIMIT_ASK`, `RATE_LIMIT_FEEDBACK`), form shows the server's reason. Regression test added. |
| Controlling-relationship question answered with the discharge entry; 2 other misroutes | Bug | P1 | Must | **Fixed.** Keywords; routing test for all 30 questions. |
| Without an AI key, Mongolian questions get English answers, because knowledge-base answers are English only so far | Missing feature | P1 | Must | **Open.** Before testing in Mongolian: set `ANTHROPIC_API_KEY` on the server (answers in the user's language), and the team writes Mongolian answers in `kb.xlsx` (roadmap). |
| Clinic list shows placeholders ("[Your family health center]") | Missing feature | P1 | Must | **Partly fixed.** Real entries from official sources: ХӨСҮТ (NCCD) first, then family health centers and adolescent-friendly rooms (free), then 2 private clinics. Paid clinics were wrongly labelled "Verified partner clinic"; now "Private clinic (paid)". Still to do: the team phones each clinic to confirm details, then fills in `verified_on`. |
| Team page said "Set TEAM_TOKEN" without saying how; deployers named the variable wrongly | Usability | P2 | Should | **Fixed.** Clearer message; `/health` shows whether the token and database are set. |
| On the live server, the team page showed only "Could not load: server error" after a correct password, so the team couldn't see why | Usability | P1 | Must | **Fixed.** Database errors now explain the cause and the fix (e.g. "tables are missing: run db/schema.sql"); `/health` shows `storage_ok`. |
| Hidden test inputs can sit under the bottom tab bar while scrolling | Usability | P3 | Could | Checked: visible labels are never covered after scrolling. No change. |

## 4. Before the first user test session

- [ ] Set `ANTHROPIC_API_KEY`, `TEAM_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` on the host; `/health` shows `"ai": true, "team_token_set": true, "storage": "supabase"`
- [ ] Phone each clinic in `data/clinics.json` to confirm address, phone, hours and that STI tests are available; fill in `verified_on`
- [ ] Run the 3 tester tasks on an iPhone (Safari) and an Android phone (Chrome)
- [ ] For an in-person group test on one Wi-Fi: set `RATE_LIMIT_FEEDBACK=200` and `RATE_LIMIT_ASK=300` for the day
