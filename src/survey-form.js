// The problem-validation survey, built into Naiz (replaces the Google Form).
// Questions follow research/02-protocol.md section A. Answers go to the survey_responses
// table (Supabase) or data/survey.jsonl. Anonymous: no name, email, phone or exact time of day
// is asked for or stored. The one written answer is scrubbed of emails, phone numbers and links.

import { scrubPII } from './feedback.js';

const opt = (value, en, mn) => ({ value, en, mn });
const SCALE = [1, 2, 3, 4, 5].map((n) => opt(String(n), String(n), String(n)));

export const SURVEY_QUESTIONS = [
  { id: 'age', type: 'number', required: true, min: 18, max: 120, en: 'How old are you?', mn: 'Та хэдэн настай вэ?' },
  { id: 'location', type: 'single', en: 'Where do you live?', mn: 'Та хаана амьдардаг вэ?',
    options: [opt('ulaanbaatar', 'Ulaanbaatar', 'Улаанбаатар'), opt('aimag_center', 'Aimag centre', 'Аймгийн төв'), opt('soum', 'Soum centre', 'Сумын төв')] },
  { id: 'gyn_ever', type: 'single', en: 'Have you ever been to see a gynecologist?', mn: 'Эмэгтэйчүүдийн эмчид очиж үзүүлж байсан уу?',
    options: [opt('yes', 'Yes', 'Тийм'), opt('no', 'No', 'Үгүй')] },
  { id: 'last_gyn', type: 'single', showIf: { gyn_ever: 'yes' }, en: 'When was your last gynecology visit?', mn: 'Хамгийн сүүлд хэзээ эмэгтэйчүүдийн эмчид үзүүлсэн бэ?',
    options: [opt('within_1y', 'Within the last year', 'Сүүлийн 1 жилд'), opt('1_3y', '1–3 years ago', '1–3 жилийн өмнө'), opt('over_3y', 'More than 3 years ago', '3-аас дээш жилийн өмнө')] },
  { id: 'never_gyn_reasons', type: 'multi', showIf: { gyn_ever: 'no' }, en: "If you have never been to a gynecologist, why not? (tick all that apply)", mn: 'Хэрвээ эмэгтэйчүүдийн эмчид очиж үзүүлж байгаагүй бол шалтгаан нь юу вэ? (тохирох бүгдийг сонгоно уу)',
    options: [
      opt('never_been_worried', "I worry because I've never been before", 'Өмнө нь үзүүлж байгаагүй тул санаа зовдог'),
      opt('dont_know_what_happens', "I'm scared because I don't know what happens at the visit", 'Үзүүлэхээр юу болдгийг мэддэггүй тул үзүүлэхээс эмээдэг'),
      opt('afraid_scolded', "I'm afraid I'll be scolded", 'Загнах вий дээ гэж айдаг'),
      opt('afraid_truth', "I'm afraid to answer the doctor's questions honestly", 'Эмчийн асуултанд үнэнээ хэлэхээс айдаг'),
      opt('ashamed', 'I feel embarrassed', 'Ичдэг'),
      opt('afraid_found_out', 'Afraid my parents or people I know will find out', 'Эцэг эх, танилууддаа мэдэгдэхээс айдаг'),
      opt('male_doctor', 'Worried the doctor might be a man', 'Эрэгтэй эмч таарахаас эмээдэг'),
      opt('no_need', "I don't think I need to (no symptoms)", 'Шаардлагагүй гэж боддог (шинж тэмдэггүй)'),
      opt('dont_know_where', "I don't know where to go or how to book", 'Хаана, яаж цаг авахаа мэддэггүй'),
      opt('cost', 'Cost', 'Төлбөр, зардлаас болж'),
      opt('no_time', 'No time', 'Цаг завгүй'),
      opt('other', 'Other', 'Бусад'),
    ] },
  { id: 'gyn_worry_factors', type: 'text', en: 'Have you ever felt worried about going to a gynecologist? What made you feel that way?', mn: 'Эмэгтэйчүүдийн эмчид очиж үзүүлэхээс санаа зовниж байсан уу? Ямар хүчин зүйлс нөлөөлсөн бэ?' },
  { id: 'unchecked_worry', type: 'single', en: "Have you ever had a sexual health problem but didn't see a doctor about it?", mn: 'Бэлгийн эрүүл мэндтэй холбоотой ямар нэгэн асуудал гарсан ч эмчид үзүүлээгүй тохиолдол байсан уу?',
    options: [opt('yes', 'Yes', 'Тийм'), opt('no', 'No', 'Үгүй'), opt('prefer_not', 'Prefer not to say', 'Хэлэхийг хүсэхгүй байна')] },
  { id: 'barriers', type: 'multi', showIf: { unchecked_worry: 'yes' }, en: "If yes, why didn't you go? (tick all that apply)", mn: 'Тийм бол яагаад очоогүй вэ? (тохирох бүгдийг сонгоно уу)',
    options: [opt('ashamed', 'Embarrassed or ashamed', 'Ичсэн'), opt('afraid_found_out', 'Afraid someone would find out', 'Бусдад мэдэгдэхээс айсан'), opt('didnt_know_where', "Didn't know where to go", 'Хаашаа очихоо мэдээгүй'), opt('cost', 'Cost', 'Төлбөр'), opt('not_serious', "Didn't think it was serious", 'Ноцтой биш гэж бодсон'), opt('bad_experience', 'Bad past experience at a clinic', 'Өмнө нь эмнэлэгт муу туршлага тохиолдсон'), opt('other', 'Other', 'Бусад')] },
  { id: 'sti_known', type: 'multi', en: 'Which of these sexually transmitted infections (STIs) do you know of? (tick all that apply)', mn: 'Доорх бэлгийн замын халдварт өвчнүүдээс (БЗХӨ) мэддэгээ сонгоно уу.',
    options: [opt('chlamydia', 'Chlamydia', 'Хламиди'), opt('hpv', 'Human papillomavirus (HPV)', 'Хүний папилломавирус (ХПВ)'), opt('syphilis', 'Syphilis', 'Тэмбүү'), opt('hiv', 'HIV infection', 'ХДХВ-ийн халдвар'), opt('trichomoniasis', 'Trichomoniasis', 'Трихомониаз'), opt('gonorrhoea', 'Gonorrhoea', 'Заг хүйтэн')] },
  { id: 'heard_hpv', type: 'single', en: 'Have you heard of human papillomavirus (HPV)*?', mn: 'Та Хүний папиллома вирус (ХПВ)*-ийн талаар сонсож байсан уу?',
    hint_en: '*HPV: Human Papilloma Virus', hint_mn: '*HPV-Human Papilloma Virus буюу Хүний хөхөнцөр вирус',
    options: [opt('yes', 'Yes', 'Тийм'), opt('no', 'No', 'Үгүй'), opt('not_sure', 'Not sure', 'Мэдэхгүй')] },
  { id: 'feelings', type: 'multi', en: 'How do you feel about sexual health topics (sexually transmitted infections, sex and so on)? (tick all that apply)', mn: 'Бэлгийн эрүүл мэндийн сэдвийн (бэлгийн замын халдварт өвчин, бэлгийн хавьталт гэх мэт) талаар ямар сэтгэгдэл төрдөг вэ? (тохирох бүгдийг сонгоно уу)',
    options: [opt('worried', 'Worried', 'Санаа зовних'), opt('ashamed', 'Embarrassed', 'Ичих'), opt('afraid', 'Afraid', 'Айх'), opt('awkward', 'Uncomfortable', 'Эвгүй санагдах'), opt('guilty', 'Guilty', 'Гэм буруутай мэт санагдах'), opt('curious', 'Curious', 'Сонирхох'), opt('calm', 'Calm, it feels normal', 'Тайван, хэвийн'), opt('unsure', "Not sure", 'Мэдэхгүй')] },
  { id: 'info_sources', type: 'multi', en: 'Where do you usually get information about sexual health? (tick all that apply)', mn: 'Бэлгийн эрүүл мэндийн мэдээллийг ихэвчлэн хаанаас авдаг вэ? (тохирох бүгдийг сонгоно уу)',
    options: [opt('friends', 'Friends', 'Найз нөхөд'), opt('facebook', 'Facebook groups', 'Facebook групп'), opt('search', 'Internet search', 'Интернэт хайлт'), opt('tiktok_youtube', 'TikTok or YouTube', 'TikTok, YouTube'), opt('doctor', 'A doctor', 'Эмч'), opt('parents', 'Parents', 'Эцэг эх'), opt('school', 'School', 'Сургууль'), opt('nowhere', 'Nowhere', 'Хаанаас ч үгүй')] },
  { id: 'info_trust', type: 'scale', en: 'How much do you trust that information? (1 = not at all, 5 = completely)', mn: 'Тэр мэдээлэлд хэр итгэдэг вэ? (1 = огт үгүй, 5 = бүрэн)', options: SCALE },
  { id: 'repro_knowledge', type: 'scale', en: 'Do you know how sexual health affects reproductive health? (1 = I don\'t know, 5 = I know)', mn: 'Бэлгийн эрүүл мэнд хэрхэн нөхөн үржихүйн эрүүл мэндэд нөлөөлдгийг мэдэх үү? (1 = мэдэхгүй, 5 = мэднэ)', options: SCALE },
  { id: 'would_use_chat', type: 'scale', en: 'Would you like to get advice from a medical professional, through an anonymous chat, about sexual and reproductive health issues you are facing?', mn: 'Нэрээ нууцалсан чатаар мэргэжлийн эмчээс өөрт тулгараад буй бэлгийн болон нөхөн үржихүйн эрүүл мэндийн талаар зөвлөгөө авахыг хүсэж байна уу?',
    hint_en: '1 = not at all, 5 = definitely', hint_mn: '1 = огт үгүй, 5 = заавал', options: SCALE },
  { id: 'what_would_help', type: 'text', en: 'What would need to happen for you to go and see a gynecologist?', mn: 'Ямар арга хэмжээ авбал та эмэгтэйчүүдийн эмчид үзүүлэх вэ?' },
];

const AGE_BANDS = [['18-20', 18, 20], ['21-24', 21, 24], ['25-29', 25, 29], ['30-39', 30, 39], ['40+', 40, 200]];
export function ageBand(age) {
  const n = Number(age);
  const band = AGE_BANDS.find(([, lo, hi]) => n >= lo && n <= hi);
  return band ? band[0] : '';
}

const byId = new Map(SURVEY_QUESTIONS.map((q) => [q.id, q]));
export const SURVEY_COLUMNS = ['id', 'created_at', 'lang', ...SURVEY_QUESTIONS.map((q) => q.id), 'age_group'];

// Returns { row } to store, or { error }. Unknown values are dropped, never stored.
export function validateSurvey(body = {}) {
  if (body.consent !== true) return { error: 'Please confirm you are 18 or older and agree to take part.' };
  const row = { lang: body.lang === 'en' ? 'en' : 'mn' };
  for (const q of SURVEY_QUESTIONS) {
    const v = body[q.id];
    if (q.type === 'text') {
      row[q.id] = scrubPII(v).slice(0, 500);
    } else if (q.type === 'number') {
      const n = Number(String(v ?? '').trim());
      if (!Number.isInteger(n) || n < 1 || n > q.max) return { error: 'Please enter your age as a number. · Насаа тоогоор бичнэ үү.' };
      if (n < q.min) return { error: 'This survey is only for people aged 18 or older. · Энэ судалгаанд зөвхөн 18 ба түүнээс дээш насныхан оролцоно.' };
      row[q.id] = n;
    } else if (q.type === 'multi') {
      const allowed = new Set(q.options.map((o) => o.value));
      const show = !q.showIf || Object.entries(q.showIf).every(([k, want]) => body[k] === want);
      row[q.id] = show && Array.isArray(v) ? [...new Set(v.map(String))].filter((x) => allowed.has(x)) : [];
    } else {
      const s = v == null ? '' : String(v);
      row[q.id] = q.options.some((o) => o.value === s) ? s : '';
    }
    if (q.type === 'single' && q.showIf && !Object.entries(q.showIf).every(([k, want]) => body[k] === want)) row[q.id] = '';
    if (q.required && !row[q.id]) return { error: 'Please answer: ' + q.en };
  }
  row.age_group = ageBand(row.age); // kept for summaries and older reports
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
    if (q.type === 'number') {
      const ages = rows.map((r) => Number(r.age)).filter((n) => Number.isFinite(n) && n > 0);
      out.type = 'single';
      out.answered = ages.length;
      out.options = AGE_BANDS.map(([band]) => {
        const n = ages.filter((a) => ageBand(a) === band).length;
        return { option: band.replace('-', '–'), count: n, pct: pct(n, ages.length) };
      });
      if (ages.length) out.mean = Math.round((ages.reduce((a, b) => a + b, 0) / ages.length) * 10) / 10;
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
