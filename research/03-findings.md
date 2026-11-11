# Research findings (anonymised)

**Dates:** October–November 2026
**Methods:** semi-structured interviews with a prototype walkthrough, anonymous online survey, internal QA. Protocol: [`02-protocol.md`](02-protocol.md). Internal QA: [`04-internal-qa.md`](04-internal-qa.md).
**Participants:** adults only (interviewees aged 22–27). No names or identifying details are recorded here. Raw notes stay in the team's private drive, never in this repository.

## 1. Problem validation survey (n = 25)

**Who:** 25 anonymous responses collected with `/survey`, 3–10 November 2026. All 18+ (13 aged 18–20, 4 aged 21–24, 8 aged 25–29); 24 in Ulaanbaatar, 1 in an aimag centre. 17 answered the first version of the survey and 8 the updated one, so questions added later have n = 8. Counts are "X of those who answered". Small sample: read as an early signal, not as representative of young women in Mongolia.

| Finding | Result |
| --- | --- |
| Get sexual health information from informal sources (internet search, friends, social media) | **24 of 25** (search 17, friends 13, Facebook/TikTok/YouTube 9) |
| Get it from a doctor | 9 of 25 |
| Fully trust the information they get (5 of 5) | **0 of 25** (13 rated it 3 of 5) |
| Have never seen a gynecologist | 7 of 25 |
| Had a sexual health problem but didn't see a doctor | **5 of 25**, plus 3 who preferred not to say |
| Why not (of those 5; tick all) | afraid someone would find out 2, embarrassed 2, didn't think it was serious 2, didn't know where to go 1, cost 1, bad past experience 1 |
| Have heard of HPV | 18 of 25 (7 not sure or no) |
| Know of chlamydia (updated version) | 4 of 8, against 7 of 8 for HIV, syphilis and HPV |
| Feel worried about sexual health topics (updated version) | 5 of 8 |
| Want anonymous advice by chat (4–5 of 5) | **7 of 24**, average 2.8. First wording ("anonymous chat reviewed by doctors"): 3 of 16. Updated wording ("advice from a medical professional"): 4 of 8 |

**Written answers** about worries before a gynecology visit (updated version) included fear of having an infection, whether the doctor will be a woman or rough-handed, being afraid of the doctor, and that "people don't think of going to a gynecologist when a problem comes up; they try to treat it at home".

**What this tells us**
1. **Information comes from places women don't trust.** Almost everyone uses search, friends or social media; nobody fully trusts what they find. This supports doctor-approved answers.
2. **Problems go unchecked, for the reasons interviews gave:** fear of being found out, shame, and thinking it isn't serious.
3. **Chlamydia is the least known STI**, though it is common and usually silent. This supports a check that recommends testing without symptoms.
4. **A chat alone isn't enough.** Interest in an anonymous chat was moderate. It was higher when the question said a medical professional answers, but that sample is very small. Together with the interviews (women want to know *what to do* and *where to go*), this is consistent with making the 2-minute check and the clinic list the main path, with the chat as support.

**Data quality:** the export contained 84 additional generated test rows (IDs starting with `synth-`). They are excluded from every figure here and must be deleted from the database.

## 2. Interviews (n = 6)

**Who:** 6 in-depth interviews: 4 young women (aged 22–27) and 2 health workers (aged 25–26, who also spoke from their own experience as patients). 5 were online and 1 in person, run by 3 interviewers with a shared script. Each interview ended with the person trying the live prototype and giving feedback.
**Codes:** W01, W02, W05, W06, W07, W08. W03 and W04 are scheduled.

### Themes (and how many interviews raised each)

**1. Fear of being seen and losing confidentiality (4 of 6)**
Several had a bad first experience with no privacy: one was asked about her sex life by the doctor in front of her mother, at her first visit as a teenager (W01). In a small aimag, one avoided the hospital for fear of meeting people she knew, and got an injection from a nurse she knew instead (W05). Peers at public clinics and the feeling of being judged at the national communicable disease centre keep people away (W06, W08).
> "I feel very ashamed walking into the national communicable disease centre. The moment I walk in, I feel the discrimination in the way people look at me." (health worker, 20s)

**2. Doctors who don't explain, and low trust in clinics (4 of 6)**
Results are given without explanation and staff are cold (W02). One felt treated as "a money machine": told to take every test, with no clear answers to her questions (W06). Doubts about hygiene and reliability make women wary of choosing a clinic (W01). Women want a female doctor who is gentle and listens without judging (W02, W08).
> "I don't know whether a place is trustworthy and meets hygiene standards, so it's hard. It's a very important organ, so I'm careful." (young woman, 20s)

**3. "Only go if you're sick or pregnant": low sense of personal risk (4 of 6)**
Check-ups are linked to having symptoms or being sexually active; "no symptoms means I'm fine" is common (W01, W02, W06, W07). Women know the names of common STIs but not their symptoms (W02), and self-rated knowledge can be higher than actual knowledge (W01).
> "People generally think you only go to a gynecologist if you're either sick or pregnant." (young woman, 20s)

**4. Not knowing what, where or when (4 of 6)**
Which tests to ask for, how to prepare, which point of the cycle to go, which doctor, and where to book are all unclear (W02, W05, W08). Normal changes can be mistaken for an STI, causing needless distress (W06).

**5. Friends decide first (3 of 6)**
The first step is asking one or two close friends; their opinion decides whether she sees a doctor at all (W01, W05, W06).

**6. Cost and time (4 of 6)**
Private gynecologists are expensive and public clinics have long queues (W06); cost delays care (W01); prices aren't clear in advance (W08); a visit can take 2–3 days (W07).

**Common misconceptions heard (reported by interviewees):** you can't get pregnant the first time; you can catch an STI from a public toilet; no STI can ever be cured; pull-out prevents pregnancy; no symptoms means no infection.

**What this means for Naiz:** confidentiality must be visible (no login, nothing saved); answers must explain *why*, not just *what*; the check must make the case for testing without symptoms; clinic information must be practical (free first, what to ask for, call ahead); a trusted, friend-like tone matters.
> "Seeing a gynecologist should be understood as just as normal as seeing a dentist." (young woman, 20s)

## 3. Prototype feedback from interviews (n = 6)

All 6 interviewees tried the live prototype. What worked: easy to use, clear and well organised (W05, W08); the clinic list at the end was liked (W02); having AI made it easy (W07).

| Issue raised | Raised by | Category | Priority | MoSCoW | What we changed (v0.5) |
| --- | --- | --- | --- | --- | --- |
| No answer for "I have no symptoms" | W01 | Usability | P1 | Must | Added "None of these"; it can't be ticked together with a symptom |
| Condom question has no answer for people who haven't had sex | W05 | Usability | P1 | Must | Added "I haven't had sex"; questions about sex are hidden if she has never had sex |
| Result too short; doesn't say why to see a doctor | W02, W06 | Usability | P1 | Must | Every result now has a "Why?" section |
| The list of tests made her fear she had 4 diseases | W06 | Usability | P1 | Must | Added: "This list doesn't mean you have these infections. Doctors usually check for several at once." |
| The word "шалгалт" (exam/test) felt unclear or off-putting | W01, W08 | Usability | P2 | Should | Mongolian wording changed to "асуумж" (questionnaire); start button "Эхлүүлэх" as W08 suggested |
| Contraception information, including for teenagers | W05, W08 | Missing feature | P2 | Could | Backlog |
| FAQ section; colour-coded sections | W08 | Enhancement | P3 | Could | Backlog |
| Explain which test is for which infection and when symptoms appear | W06 | Enhancement | P2 | Should | Backlog, needs doctor-written content |
| Follow-up after a visit and a way to ask the doctor again | W08 | Missing feature | P3 | Could | Backlog, part of the clinic pilot |

## 4. AI answer quality

Not yet graded by doctors. Internal QA (keyword mode): 30 of 30 test questions handled as expected after fixes, 27 of 30 before. See [`04-internal-qa.md`](04-internal-qa.md).

## 5. Limitations

Small, mostly urban interview sample of women in their 20s; health workers spoke partly as patients. Prototype feedback is qualitative and came from people who knew they were testing. Intentions are self-reported; the pilot will measure tests booked and completed.
