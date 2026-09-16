import crypto from 'crypto';

const SUPABASE_URL = 'https://zacllsdldntmcgttudod.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;

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

      const q = String(question).slice(0, 120).replace(/[<>]/g, '');
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
          subject: 'More on "' + q + '"',
                    text: 'You asked about "' + q + '" yesterday.\n\nScripture has more to say on it.\n\nAsk another question: https://askbibleanswers.com\n\nUnsubscribe: ' + unsubUrl,

          html: '<p>You asked about <strong>' + q + '</strong> yesterday.</p>' +
                               '<p>Scripture has more to say on it.</p>' +
                '<p><a href="https://askbibleanswers.com">Ask another question</a></p>' +
               '<p style="font-size:12px;color:#888">AskBibleAnswers, Wheeling IL</p>' +
               '<p style="font-size:12px;color:#888"><a href="' + unsubUrl + '" style="color:#888">Unsubscribe</a></p>',
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
