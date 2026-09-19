import crypto from 'crypto';

const SUPABASE_URL = 'https://zacllsdldntmcgttudod.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;

// --- Verse picker -----------------------------------------------------------
// All verses are King James Version (public domain), matching the app.
// First matching entry wins, so put narrower keywords higher up.
const VERSES = [
  { keys: ['worry', 'worried', 'worrying', 'anxious', 'anxiety', 'stress', 'overwhelm'],
    ref: 'Philippians 4:6',
    text: 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.' },

  { keys: ['fear', 'afraid', 'scared', 'courage'],
    ref: 'Isaiah 41:10',
    text: 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee.' },

  { keys: ['forgive', 'forgiveness', 'forgiving'],
    ref: 'Ephesians 4:32',
    text: 'And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ\u2019s sake hath forgiven you.' },

  { keys: ['guilt', 'guilty', 'shame', 'ashamed', 'condemn'],
    ref: 'Romans 8:1',
    text: 'There is therefore now no condemnation to them which are in Christ Jesus, who walk not after the flesh, but after the Spirit.' },

  { keys: ['marriage', 'married', 'husband', 'wife', 'divorce', 'spouse'],
    ref: 'Mark 10:9',
    text: 'What therefore God hath joined together, let not man put asunder.' },

  { keys: ['child', 'children', 'son', 'daughter', 'parent', 'father', 'mother', 'family'],
    ref: 'Proverbs 22:6',
    text: 'Train up a child in the way he should go: and when he is old, he will not depart from it.' },

  { keys: ['money', 'rich', 'wealth', 'debt', 'poor', 'tithe', 'giving', 'finance'],
    ref: '1 Timothy 6:10',
    text: 'For the love of money is the root of all evil: which while some coveted after, they have erred from the faith.' },

  { keys: ['work', 'job', 'career', 'business', 'employer'],
    ref: 'Colossians 3:23',
    text: 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.' },

  { keys: ['death', 'died', 'dying', 'grief', 'grieving', 'mourn', 'funeral', 'loss'],
    ref: 'Revelation 21:4',
    text: 'And God shall wipe away all tears from their eyes; and there shall be no more death, neither sorrow, nor crying.' },

  { keys: ['heaven', 'eternal life', 'afterlife', 'paradise'],
    ref: 'John 14:2',
    text: 'In my Father\u2019s house are many mansions: if it were not so, I would have told you. I go to prepare a place for you.' },

  { keys: ['hell', 'judgment', 'judgement'],
    ref: 'Hebrews 9:27',
    text: 'And as it is appointed unto men once to die, but after this the judgment.' },

  { keys: ['pray', 'prayer', 'praying'],
    ref: 'Matthew 7:7',
    text: 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.' },

  { keys: ['faith', 'believe', 'belief'],
    ref: 'Hebrews 11:1',
    text: 'Now faith is the substance of things hoped for, the evidence of things not seen.' },

  { keys: ['doubt', 'doubting', 'unbelief'],
    ref: 'Mark 9:24',
    text: 'Lord, I believe; help thou mine unbelief.' },

  { keys: ['salvation', 'saved', 'born again', 'gospel', 'grace'],
    ref: 'Ephesians 2:8',
    text: 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God.' },

  { keys: ['sin', 'sinful', 'repent', 'repentance'],
    ref: '1 John 1:9',
    text: 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.' },

  { keys: ['temptation', 'tempted', 'addiction', 'addicted', 'habit'],
    ref: '1 Corinthians 10:13',
    text: 'God is faithful, who will not suffer you to be tempted above that ye are able; but will with the temptation also make a way to escape.' },

  { keys: ['heal', 'healing', 'sick', 'sickness', 'illness', 'disease', 'pain'],
    ref: 'Psalm 147:3',
    text: 'He healeth the broken in heart, and bindeth up their wounds.' },

  { keys: ['sad', 'sadness', 'depress', 'despair', 'hopeless', 'broken heart'],
    ref: 'Psalm 34:18',
    text: 'The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit.' },

  { keys: ['lonely', 'loneliness', 'alone', 'abandoned'],
    ref: 'Deuteronomy 31:6',
    text: 'Be strong and of a good courage; he it is that doth go with thee; he will not fail thee, nor forsake thee.' },

  { keys: ['suffer', 'suffering', 'trial', 'trials', 'hardship', 'why do bad things'],
    ref: 'Romans 8:28',
    text: 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.' },

  { keys: ['patience', 'patient', 'wait', 'waiting'],
    ref: 'Psalm 27:14',
    text: 'Wait on the LORD: be of good courage, and he shall strengthen thine heart: wait, I say, on the LORD.' },

  { keys: ['anger', 'angry', 'wrath', 'bitter'],
    ref: 'James 1:19',
    text: 'Wherefore, my beloved brethren, let every man be swift to hear, slow to speak, slow to wrath.' },

  { keys: ['pride', 'proud', 'humble', 'humility'],
    ref: 'James 4:10',
    text: 'Humble yourselves in the sight of the Lord, and he shall lift you up.' },

  { keys: ['wisdom', 'wise', 'decision', 'decide', 'choice', 'guidance'],
    ref: 'James 1:5',
    text: 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.' },

  { keys: ['purpose', 'plan', 'will of god', 'calling', 'future'],
    ref: 'Jeremiah 29:11',
    text: 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.' },

  { keys: ['trust', 'trusting'],
    ref: 'Proverbs 3:5',
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.' },

  { keys: ['hope'],
    ref: 'Romans 15:13',
    text: 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.' },

  { keys: ['peace', 'rest', 'calm'],
    ref: 'John 14:27',
    text: 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you.' },

  { keys: ['thank', 'thankful', 'grateful', 'gratitude', 'praise'],
    ref: '1 Thessalonians 5:18',
    text: 'In every thing give thanks: for this is the will of God in Christ Jesus concerning you.' },

  { keys: ['love', 'loving'],
    ref: '1 John 4:19',
    text: 'We love him, because he first loved us.' },

  { keys: ['friend', 'friendship', 'neighbor'],
    ref: 'Proverbs 17:17',
    text: 'A friend loveth at all times, and a brother is born for adversity.' },

  { keys: ['jesus', 'christ', 'cross', 'resurrection'],
    ref: 'John 14:6',
    text: 'I am the way, the truth, and the life: no man cometh unto the Father, but by me.' },

  { keys: ['holy spirit', 'spirit'],
    ref: 'Galatians 5:22',
    text: 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith.' },

  { keys: ['church', 'worship', 'fellowship'],
    ref: 'Hebrews 10:25',
    text: 'Not forsaking the assembling of ourselves together, as the manner of some is; but exhorting one another.' },

  { keys: ['bible', 'scripture', 'word of god', 'read'],
    ref: '2 Timothy 3:16',
    text: 'All scripture is given by inspiration of God, and is profitable for doctrine, for reproof, for correction, for instruction in righteousness.' }
];

const FALLBACK_VERSE = {
  ref: 'Psalm 119:105',
  text: 'Thy word is a lamp unto my feet, and a light unto my path.'
};

function pickVerse(question) {
  const q = String(question || '').toLowerCase();
  for (const v of VERSES) {
    if (v.keys.some((k) => q.includes(k))) return v;
  }
  return FALLBACK_VERSE;
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
// ---------------------------------------------------------------------------

async function sb(path, options = {}) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...options,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: 'Bearer ' + SERVICE_KEY,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) throw new Error(path + ' -> ' + res.status + ' ' + (await res.text()));
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

export default async function handler(req, res) {
  if (req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const until = new Date(Date.now() - 0 * 3600 * 1000).toISOString();

    const msgs = await sb(
      'chat_messages?select=user_id,content,created_at&role=eq.user' +
      '&created_at=gte.' + since + '&created_at=lte.' + until +
      '&order=created_at.desc&limit=200'
    );

    const firstByUser = new Map();
    for (const m of msgs) if (!firstByUser.has(m.user_id)) firstByUser.set(m.user_id, m.content);
    if (firstByUser.size === 0) return res.status(200).json({ sent: 0, reason: 'no candidates' });

    const ids = [...firstByUser.keys()];
    const sent = await sb('reminder_log?select=user_id&user_id=in.(' + ids.join(',') + ')');
    for (const r of sent) firstByUser.delete(r.user_id);
    if (firstByUser.size === 0) return res.status(200).json({ sent: 0, reason: 'all already sent' });

    let count = 0;
    for (const [userId, question] of firstByUser) {
      const users = await sb('profiles?select=email,daily_email,unsubscribe_token&id=eq.' + userId);
      if (!users?.[0]?.daily_email) continue;

      const email = users?.[0]?.email;
      const unsubUrl = 'https://askbibleanswers.com/api/unsubscribe?token=' + users[0].unsubscribe_token;

      if (!email) continue;

      const raw = String(question).replace(/\s+/g, ' ').trim();
      const q = raw.length > 120 ? raw.slice(0, 120).trim() + '\u2026' : raw;
      const verse = pickVerse(raw);

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + RESEND_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Cristian from AskBibleAnswers <hello@askbibleanswers.com>',
          reply_to: 'cristimaxinmihai@yahoo.com',
          to: email,
          subject: 'More on "' + q.replace(/"/g, '\u201d') + '"',

          text:
            'Yesterday you asked: "' + q + '"\n\n' +
            'Scripture has more to say on it:\n\n' +
            '"' + verse.text + '"\n' +
            '\u2014 ' + verse.ref + ' (KJV)\n\n' +
            'Ask a follow-up question: https://askbibleanswers.com\n\n' +
            'AskBibleAnswers, Wheeling IL\n' +
            'Unsubscribe: ' + unsubUrl,

          html:
            '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.55;color:#222;max-width:540px">' +
              '<p style="margin:0 0 16px">Yesterday you asked:<br><strong>&ldquo;' + esc(q) + '&rdquo;</strong></p>' +
              '<p style="margin:0 0 12px">Scripture has more to say on it:</p>' +
              '<blockquote style="margin:0 0 20px;padding:14px 18px;border-left:3px solid #c9b896;background:#faf7f1">' +
                esc(verse.text) +
                '<br><span style="font-size:13px;color:#777">&mdash; ' + esc(verse.ref) + ' (KJV)</span>' +
              '</blockquote>' +
              '<p style="margin:0 0 28px">' +
                '<a href="https://askbibleanswers.com" style="display:inline-block;padding:12px 22px;background:#1a1a1a;color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Ask a follow-up question</a>' +
              '</p>' +
              '<p style="margin:0;font-size:12px;color:#888">AskBibleAnswers, Wheeling IL</p>' +
              '<p style="margin:4px 0 0;font-size:12px;color:#888"><a href="' + unsubUrl + '" style="color:#888">Unsubscribe</a></p>' +
            '</div>',

          headers: { 'List-Unsubscribe': '<' + unsubUrl + '>' }
        })
      });
      if (!r.ok) continue;

      await sb('reminder_log', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ user_id: userId })
      });
      count++;
    }

    return res.status(200).json({ sent: count });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
