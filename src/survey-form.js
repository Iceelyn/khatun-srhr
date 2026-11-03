// The problem-validation survey, built into Naiz (replaces the Google Form).
// Questions follow research/02-protocol.md section A. Answers go to the survey_responses
// table (Supabase) or data/survey.jsonl. Anonymous: no name, email, phone or exact time of day
// is asked for or stored. The one written answer is scrubbed of emails, phone numbers and links.

import { scrubPII } from './feedback.js';

const opt = (value, en, mn) => ({ value, en, mn });
const SCALE = [1, 2, 3, 4, 5].map((n) => opt(String(n), String(n), String(n)));

export const SURVEY_QUESTIONS = [
  { id: 'age_group', type: 'single', required: true, en: 'How old are you?', mn: 'Та хэдэн настай вэ?',
    options: [opt('18-20', '18–20', '18–20'), opt('21-24', '21–24', '21–24'), opt('25-29', '25–29', '25–29')] },
  { id: 'location', type: 'single', en: 'Where do you live?', mn: 'Та хаана амьдардаг вэ?',
    options: [opt('ulaanbaatar', 'Ulaanbaatar', 'Улаанбаатар'), opt('aimag_center', 'Aimag centre', 'Аймгийн төв'), opt('soum', 'Soum', 'Сум'), opt('other', 'Other', 'Бусад')] },
  { id: 'gyn_visits', type: 'single', en: 'Have you ever visited a gynecologist?', mn: 'Та эмэгтэйчүүдийн эмчид үзүүлж байсан уу?',
    options: [opt('never', 'Never', 'Хэзээ ч үгүй'), opt('once', 'Once', 'Нэг удаа'), opt('more', 'More than once', 'Нэгээс олон удаа')] },
  { id: 'last_gyn', type: 'single', en: 'When was your last gynecology visit?', mn: 'Хамгийн сүүлд хэзээ эмэгтэйчүүдийн эмчид үзүүлсэн бэ?',
    options: [opt('within_1y', 'Within the last year', 'Сүүлийн 1 жилд'), opt('1_3y', '1–3 years ago', '1–3 жилийн өмнө'), opt('over_3y', 'More than 3 years ago', '3-аас дээш жилийн өмнө'), opt('never', 'Never', 'Хэзээ ч үгүй')] },
  { id: 'unchecked_worry', type: 'single', en: 'Have you ever had a health worry "down there" that you didn\'t get checked?', mn: 'Бэлэг эрхтний орчимд санаа зовоосон зүйл гарсан ч шалгуулаагүй тохиолдол байсан уу?',
    options: [opt('yes', 'Yes', 'Тийм'), opt('no', 'No', 'Үгүй'), opt('prefer_not', 'Prefer not to say', 'Хэлэхийг хүсэхгүй байна')] },
  { id: 'barriers', type: 'multi', showIf: { unchecked_worry: 'yes' }, en: 'If yes, why didn\'t you go? (tick all that apply)', mn: 'Тийм бол яагаад очоогүй вэ? (тохирох бүгдийг сонгоно уу)',
    options: [opt('ashamed', 'Embarrassed or ashamed', 'Ичсэн'), opt('afraid_found_out', 'Afraid someone would find out', 'Бусдад мэдэгдэхээс айсан'), opt('didnt_know_where', "Didn't know where to go", 'Хаашаа очихоо мэдээгүй'), opt('cost', 'Cost', 'Төлбөр'), opt('not_serious', "Didn't think it was serious", 'Ноцтой биш гэж бодсон'), opt('bad_experience', 'Bad past experience at a clinic', 'Өмнө нь эмнэлэгт муу туршлага тохиолдсон'), opt('other', 'Other', 'Бусад')] },
  { id: 'info_sources', type: 'multi', en: 'Where do you usually get information about sexual health? (tick all that apply)', mn: 'Бэлгийн эрүүл мэндийн мэдээллийг ихэвчлэн хаанаас авдаг вэ? (тохирох бүгдийг сонгоно уу)',
    options: [opt('friends', 'Friends', 'Найз нөхөд'), opt('facebook', 'Facebook groups', 'Facebook групп'), opt('search', 'Internet search', 'Интернэт хайлт'), opt('tiktok_youtube', 'TikTok or YouTube', 'TikTok, YouTube'), opt('doctor', 'A doctor', 'Эмч'), opt('parents', 'Parents', 'Эцэг эх'), opt('school', 'School', 'Сургууль'), opt('nowhere', 'Nowhere', 'Хаанаас ч үгүй')] },
  { id: 'info_trust', type: 'scale', en: 'How much do you trust that information? (1 = not at all, 5 = completely)', mn: 'Тэр мэдээлэлд хэр итгэдэг вэ? (1 = огт үгүй, 5 = бүрэн)', options: SCALE },
  { id: 'heard_hpv', type: 'single', en: 'Have you heard of HPV?', mn: 'Та ХПВ (хүний папиллома вирус)-ийн талаар сонсож байсан уу?',
    options: [opt('yes', 'Yes', 'Тийм'), opt('no', 'No', 'Үгүй'), opt('not_sure', 'Not sure', 'Мэдэхгүй')] },
  { id: 'would_use_chat', type: 'scale', en: 'Would you use an anonymous chat, reviewed by doctors, to ask sexual health questions? (1 = definitely not, 5 = definitely)', mn: 'Эмчийн хянасан нэргүй чатаар бэлгийн эрүүл мэндийн асуулт асуух уу? (1 = огт үгүй, 5 = заавал)', options: SCALE },
  { id: 'what_would_help', type: 'text', en: 'What would make you more likely to get a check-up?', mn: 'Юу байвал та үзлэгт орох магадлал нэмэгдэх вэ?' },
];

const byId = new Map(SURVEY_QUESTIONS.map((q) => [q.id, q]));
export const SURVEY_COLUMNS = ['id', 'created_at', 'lang', ...SURVEY_QUESTIONS.map((q) => q.id)];

// Returns { row } to store, or { error }. Unknown values are dropped, never stored.
export function validateSurvey(body = {}) {
  if (body.consent !== true) return { error: 'Please confirm you are 18 or older and agree to take part.' };
  const row = { lang: body.lang === 'en' ? 'en' : 'mn' };
  for (const q of SURVEY_QUESTIONS) {
    const v = body[q.id];
    if (q.type === 'text') {
      row[q.id] = scrubPII(v).slice(0, 500);
    } else if (q.type === 'multi') {
      const allowed = new Set(q.options.map((o) => o.value));
      const show = !q.showIf || Object.entries(q.showIf).every(([k, want]) => body[k] === want);
      row[q.id] = show && Array.isArray(v) ? [...new Set(v.map(String))].filter((x) => allowed.has(x)) : [];
    } else {
      const s = v == null ? '' : String(v);
      row[q.id] = q.options.some((o) => o.value === s) ? s : '';
    }
    if (q.required && !row[q.id]) return { error: 'Please answer: ' + q.en };
  }
  return { row };
}

const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

// Counts for the team results page. Same shape as the Google Forms summary (src/survey.js).
export function summarizeSurveyResponses(rows) {
  const asList = (v) => (Array.isArray(v) ? v : typeof v === 'string' && v ? v.split(/\s*,\s*/) : []);
  const questions = SURVEY_QUESTIONS.map((q) => {
    const out = { id: q.id, question: q.en, type: q.type === 'text' ? 'open' : q.type };
    if (q.type === 'text') {
      out.answered = rows.filter((r) => String(r[q.id] || '').trim()).length;
      return out;
    }
    if (q.type === 'multi') {
      const who = rows.filter((r) => asList(r[q.id]).length);
      out.answered = who.length;
      out.options = q.options.map((o) => {
        const n = who.filter((r) => asList(r[q.id]).includes(o.value)).length;
        return { option: o.en, count: n, pct: pct(n, who.length) };
      }).sort((a, b) => b.count - a.count);
      return out;
    }
    const vals = rows.map((r) => String(r[q.id] ?? '')).filter(Boolean);
    out.answered = vals.length;
    out.options = q.options.map((o) => {
      const n = vals.filter((v) => v === o.value).length;
      return { option: o.en, count: n, pct: pct(n, vals.length) };
    });
    if (q.type === 'scale' && vals.length) {
      out.mean = Math.round((vals.reduce((a, v) => a + Number(v), 0) / vals.length) * 10) / 10;
      out.top2_pct = pct(vals.filter((v) => Number(v) >= 4).length, vals.length);
    }
    return out;
  });
  return { respondents: rows.length, questions, source: 'naiz_survey', dropped_columns: [] };
}

// For CSV export: multi answers as "a; b".
export function surveyRowForCSV(r) {
  const out = { ...r };
  for (const q of SURVEY_QUESTIONS) if (q.type === 'multi' && Array.isArray(out[q.id])) out[q.id] = out[q.id].join('; ');
  return out;
}

export function getQuestion(id) {
  return byId.get(id);
}
