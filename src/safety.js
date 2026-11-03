// Red-flag detection. Runs BEFORE the AI model: a match always gets a fixed,
// doctor-approved reply and never goes to the model.
// Mongolian wording and all phone numbers: verify with native speakers and
// official sources before launch.

const FLAGS = [
  {
    id: 'self_harm',
    patterns: [
      'kill myself', 'suicide', 'end my life', 'want to die', 'self harm', 'self-harm', 'hurt myself', 'cut myself',
      'амиа хорло', 'амьдармааргүй', 'үхмээр', 'өөрийгөө гэмтээ', 'өөрийгөө хорло',
      'amia horlo', 'uhmeer',
    ],
    reply:
      'Танд одоо их хэцүү байгаа бололтой. Та ганцаараа биш. Сэтгэцийн эрүүл мэндийн 24 цагийн үнэгүй утас: 1800-2000. Яаралтай аюултай бол 103 руу залгаарай.\n\n' +
      "It sounds like things are really hard right now. You're not alone. Free 24/7 mental health line: 1800-2000. If you're in immediate danger, call 103.",
  },
  {
    id: 'assault',
    patterns: [
      'raped', ' rape ', ' rape.', ' rape,', 'sexual assault', 'forced me', 'forced to have sex', 'made me have sex', 'molest',
      'хүчинд', 'бэлгийн хүчирхийлэл',
    ],
    reply:
      'Таны буруу биш. Аль болох хурдан эмнэлэгт эсвэл Нэг цэгийн үйлчилгээний төвд хандаарай. 72 цагийн дотор хандвал жирэмслэлт болон ХДХВ-ээс урьдчилан сэргийлэх эмчилгээ авах боломжтой. Аюулд байгаа бол 102, яаралтай тусламж 103.\n\n' +
      "This is not your fault. Please go to a hospital or a One-Stop Service Center as soon as you can. Within 72 hours, doctors can help prevent pregnancy and HIV. If you're in danger, call 102 (police) or 103 (ambulance).",
  },
  {
    id: 'violence',
    patterns: [
      'hits me', 'beats me', 'threatens me', 'afraid of my boyfriend', 'afraid of my husband',
      'зоддог', 'зодсон', 'цохидог', 'заналхий',
    ],
    reply:
      'Хэн ч таныг гэмтээх эрхгүй. Аюулд байгаа бол 102 руу залгаарай. Нэг цэгийн үйлчилгээний төв аюулгүй байр, сэтгэл зүйн болон эрх зүйн тусламж үзүүлдэг.\n\n' +
      "No one has the right to hurt you. If you're in danger, call 102. One-Stop Service Centers offer safe shelter, counselling and legal help.",
  },
  {
    id: 'emergency',
    patterns: [
      'heavy bleeding', 'bleeding a lot', 'soaking', 'fainted', 'passed out', 'severe pain', 'high fever', "can't stand",
      'их цус', 'цус их', 'ухаан алд', 'хүчтэй өвд', 'өндөр халуу',
    ],
    reply:
      'Эдгээр шинж тэмдгээр өнөөдөр эмчид үзүүлэх хэрэгтэй. Хүнд байвал 103 руу залгаарай.\n\n' +
      'These symptoms need a doctor today. If it feels serious, call 103.',
  },
];

export function checkRedFlags(text) {
  const t = ` ${String(text).toLowerCase()} `;
  for (const f of FLAGS) {
    if (f.patterns.some((p) => t.includes(p))) return { id: f.id, reply: f.reply };
  }
  return null;
}

export const FLAG_IDS = FLAGS.map((f) => f.id);
