# Primary research protocol (rapid validation)

Goal: in 24–48 hours, check whether young women in Mongolia experience the problem we think they do, and whether the prototype helps.

**Who:** adults aged 18–29 only. No minors in this round.
**Privacy:** no names, phone numbers or Facebook profiles recorded. Raw notes stay in `research/raw/` on a team laptop and are never committed to GitHub (it's in `.gitignore`).
**Ethics:** never ask anyone whether they have, or had, an STI. Ask about experiences, opinions and barriers.

---

## A. Online survey (target 50–100 responses)

> **The live survey is at `/survey`.** Its current questions (updated November 2026: typed age, gynecologist visits and reasons for not going, known STIs, feelings about sexual health topics, reproductive-health knowledge) are defined in `src/survey-form.js`, in Mongolian and English. The list below is the first version.

Google Form, anonymous (don't collect emails). Share in university groups and young women's Facebook groups. Translate into Mongolian.

**Consent line at the top:** "This anonymous survey takes 3 minutes. It's for a student health project. You can stop at any time. Please only take part if you are 18 or older."

1. How old are you? (18–20 / 21–24 / 25–29)
2. Where do you live? (Ulaanbaatar / aimag centre / soum / other)
3. Have you ever visited a gynecologist? (Never / once / more than once)
4. When was your last gynecology visit? (Within 1 year / 1–3 years ago / more than 3 years ago / never)
5. Have you ever had a health worry "down there" that you didn't get checked? (Yes / No / Prefer not to say)
6. If yes, why didn't you go? Tick all: embarrassed or ashamed / afraid someone would find out / didn't know where to go / cost / didn't think it was serious / bad past experience at a clinic / other
7. Where do you usually get information about sexual health? Tick all: friends / Facebook groups / internet search / TikTok or YouTube / doctor / parents / school / nowhere
8. How much do you trust that information? (1–5)
9. Have you heard of HPV? (Yes / No / Not sure)
10. Would you use an anonymous chat, reviewed by doctors, to ask sexual health questions? (1 = definitely not, 5 = definitely)
11. What would make you more likely to get a check-up? (open answer)

## B. Interviews (target 8–10 young women, 3–5 health workers)

20 minutes, by phone or in person, female interviewer, no recording unless the person agrees.

**Consent script:** "Thank you for talking with us. We're designing a private health service for young women. There are no right answers. You can skip any question or stop at any time. We won't write down your name. Is it OK to take notes?"

**Young women**
1. When you have a question about your sexual health, what do you usually do?
2. Tell me about the last time you thought about seeing a gynecologist. What happened?
3. What makes going to a clinic hard? What makes it easier?
4. Who would you never want to find out? Why?
5. (Show the prototype.) What's your first reaction? What would stop you using it?
6. Would you trust the answers? What would make you trust them more?
7. If this told you to get a test, would you go? What would you need?

**Health workers** (family doctor, gynecologist, STI clinic doctor, nurse)
1. When young women come to you, why do they come, and how late?
2. What do they say stopped them coming earlier?
3. What myths or wrong information do you hear most often?
4. (Show the clinic dashboard.) Would this help you? What's missing?
5. What would worry you about a tool like this?

**Parents of 9–12-year-olds** (5–10, for the HPV module)
1. Has your child been offered the HPV vaccine? What did you decide, and why?
2. What worries you about it?
3. (Show the parents screen.) Does this answer your worry? Would you be more or less willing to vaccinate? (1–5 before and after)

## C. Prototype test (target 15–25 people)

Each person uses the web chat and check page on their own phone for 10 minutes. Three tasks:

1. Ask the chat a question you'd normally be too shy to ask.
2. Complete the "Should I get checked?" check (they can make up answers; they don't need to use their own situation).
3. Find where you could get tested for free.

Then each tester fills in the feedback page at `/feedback` (Mongolian and English): how each task went, four 1–5 ratings (easy, private, trusted, more likely to get tested) and three short comments. It's anonymous and needs the 18+ consent box.

The team sees everything on `/results` (needs `TEAM_TOKEN`): ratings, task success, usage counts and each comment to triage. Usage counts (questions, topics, check results) are logged automatically with no message text.

## D. Doctor grading

Run `npm run eval`. Both doctors independently grade every answer in `eval/results.csv` as accurate (yes/no) and safe (yes/no). Report the percentage of answers both doctors rated accurate and safe, and list what you fixed.

## E. Analysis (2 hours)

1. Count the survey results and the test scores.
2. Write each interview's key points on sticky notes, group them into 3–4 themes, and pick one short anonymous quote per theme.
3. Write down 2–3 changes you made because of what you heard.
4. Fill in `03-findings.md`. Report only what you actually collected; if a number is small, say so.

Step-by-step for each method, and what may be committed to GitHub: [`README.md`](README.md).
