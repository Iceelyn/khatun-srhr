// "Should I get checked?" triage rules.
// DRAFT: every rule here must be reviewed and signed off by the team's doctors.
// This is decision support, not a diagnosis.

const ORDER = { none: 0, routine: 1, soon: 2, today: 3 };
const INFECTION_SYMPTOMS = ['discharge_change', 'itching', 'pain_urination', 'pain_sex', 'pelvic_pain'];

/**
 * @param {object} a answers from the check form
 * @param {number} a.age
 * @param {boolean} a.sexuallyActive
 * @param {string[]} a.symptoms e.g. ['discharge_change','genital_sore']
 * @param {boolean} a.fever
 * @param {boolean} a.severePain
 * @param {boolean} a.heavyBleeding
 * @param {boolean} a.maybePregnant
 * @param {boolean} a.newPartnerNoCondom  last 3 months
 * @param {boolean} a.partnerHasSTI
 * @param {'never'|'over1y'|'within1y'} a.lastSTITest
 * @param {'never'|'over3y'|'within3y'|'unknown'} a.lastScreening
 * @param {boolean} a.assault  forced sex in the last 5 days
 */
export function triage(a = {}) {
  const sym = new Set(a.symptoms || []);
  const tests = new Set();
  const reasons = [];
  let level = 'none';
  const raise = (l) => {
    if (ORDER[l] > ORDER[level]) level = l;
  };

  if (a.assault) {
    return {
      level: 'today',
      special: 'assault',
      tests: ['exam', 'emergency_care'],
      reasons: ['assault'],
      youth: a.age < 18,
      screening: false,
    };
  }

  // Same-day warning signs
  if (a.heavyBleeding) {
    raise('today');
    reasons.push('heavy_bleeding');
  }
  if (a.severePain) {
    raise('today');
    reasons.push('severe_pain');
  }
  if (a.fever && (sym.has('pelvic_pain') || sym.has('pain_urination'))) {
    raise('today');
    reasons.push('fever_with_pain');
  }
  if (a.maybePregnant && (sym.has('pelvic_pain') || sym.has('bleeding_between'))) {
    raise('today');
    reasons.push('pregnancy_with_pain_or_bleeding');
  }

  // Symptoms: test within a few days
  if (INFECTION_SYMPTOMS.some((s) => sym.has(s))) {
    raise('soon');
    tests.add('swab');
    reasons.push('infection_symptoms');
  }
  if (sym.has('genital_sore')) {
    raise('soon');
    tests.add('exam');
    tests.add('blood');
    reasons.push('genital_sore');
  }
  if (sym.has('bleeding_between') || sym.has('bleeding_after_sex')) {
    raise('soon');
    tests.add('exam');
    reasons.push('abnormal_bleeding');
  }
  if (a.partnerHasSTI) {
    raise('soon');
    tests.add('swab');
    tests.add('blood');
    reasons.push('partner_sti');
  }

  // No symptoms but at risk: plan a routine check
  if (a.newPartnerNoCondom) {
    raise('routine');
    tests.add('swab');
    tests.add('blood');
    reasons.push('new_partner_no_condom');
  }
  if (a.sexuallyActive && a.lastSTITest === 'never') {
    raise('routine');
    tests.add('swab');
    tests.add('blood');
    reasons.push('never_tested');
  }

  // National programme: free cervical screening for women aged 30-60
  let screening = false;
  if (a.age >= 30 && a.age <= 60 && ['never', 'over3y', 'unknown'].includes(a.lastScreening)) {
    screening = true;
    raise('routine');
    tests.add('cervical_screening');
    reasons.push('screening_due');
  }

  if (a.maybePregnant) tests.add('pregnancy_test');

  return { level, tests: [...tests], reasons, youth: a.age < 18, screening };
}
