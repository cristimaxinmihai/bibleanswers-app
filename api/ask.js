export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid messages' });
  }
const SUPABASE_URL = 'https://zacllsdldntmcgttudod.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const DAILY_LIMIT = 5;
  const TRIAL_DAYS = 7;

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'sign_in_required' });
  }

  let userId;
  try {
    const userRes = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + token }
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: 'sign_in_required' });
    }
    const user = await userRes.json();
    userId = user.id;
  } catch (e) {
    return res.status(401).json({ error: 'sign_in_required' });
  }

  const profRes = await fetch(
    SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId +
    '&select=subscription_status,created_at,questions_used_today,questions_day',
    { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
  );
  const rows = await profRes.json();
  const profile = Array.isArray(rows) ? rows[0] : null;
  if (!profile) {
    return res.status(403).json({ error: 'no_profile' });
  }

  const subscribed = profile.subscription_status === 'active' ||
                     profile.subscription_status === 'trialing';
  const today = new Date().toISOString().slice(0, 10);
  const used = profile.questions_day === today ? profile.questions_used_today : 0;

  if (!subscribed) {
    const ageDays = (Date.now() - new Date(profile.created_at).getTime()) / 86400000;
    if (ageDays >= TRIAL_DAYS) {
      return res.status(402).json({ error: 'trial_over' });
    }
    if (used >= DAILY_LIMIT) {
      return res.status(429).json({ error: 'daily_limit', limit: DAILY_LIMIT });
    }
  }
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        system:
          "You are BibleAnswers. Answer briefly (2-4 sentences) with compassion, referencing one specific Bible verse (book chapter:verse) that supports your answer.",
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const text = data.content?.map((b) => (b.type === 'text' ? b.text : '')).join('\n') || '';

    if (!subscribed) {
      await fetch(SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId, {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ questions_used_today: used + 1, questions_day: today })
      });
    }
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
