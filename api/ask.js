import crypto from 'crypto';

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
  const ANON_DAILY_LIMIT = 1;

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const isAnon = !token;

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ipHash = crypto.createHash('sha256').update('bibleanswers|' + ip).digest('hex');
  const anonToday = new Date().toISOString().slice(0, 10);

  if (isAnon && !ip) {
    return res.status(401).json({ error: 'sign_in_required' });
  }

  let userId = null;
  if (!isAnon) {
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
  }

  let profile = null;

  if (isAnon) {
    const anonRes = await fetch(
      SUPABASE_URL + '/rest/v1/anon_usage?ip_hash=eq.' + ipHash + '&select=day,count',
      { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
    );
    const anonRows = await anonRes.json();
    const anonRow = Array.isArray(anonRows) ? anonRows[0] : null;
    const anonUsed = anonRow && anonRow.day === anonToday ? anonRow.count : 0;
    if (anonUsed >= ANON_DAILY_LIMIT) {
      return res.status(401).json({ error: 'sign_in_required' });
    }
    profile = {
      subscription_status: 'none',
      created_at: new Date().toISOString(),
      questions_used_today: 0,
      questions_day: null
    };
  } else {
    const profRes = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId +
      '&select=subscription_status,created_at,questions_used_today,questions_day',
      { headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY } }
    );
    const rows = await profRes.json();
    profile = Array.isArray(rows) ? rows[0] : null;
    if (!profile) {
      return res.status(403).json({ error: 'no_profile' });
    }
  }

  const subscribed = profile.subscription_status === 'active' ||
                     profile.subscription_status === 'trialing';
  const today = new Date().toISOString().slice(0, 10);
  const used = profile.questions_day === today ? profile.questions_used_today : 0;

  if (!subscribed && !isAnon) {
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
          "You are BibleAnswers. Reply in the same language the user wrote in. Always quote the Bible verse itself in English, King James Version, then explain it in the user's language, and always give the reference (book chapter:verse). Never translate a verse yourself and never quote a modern non-English translation. Write plain text only: no Markdown headings and no # characters. Answer briefly (2-4 sentences) with compassion, referencing one specific Bible verse (book chapter:verse) that supports your answer.",
        messages: messages,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data });
    }

    const text = data.content?.map((b) => (b.type === 'text' ? b.text : '')).join('\n') || '';

    if (isAnon) {
      await fetch(SUPABASE_URL + '/rest/v1/anon_usage', {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify({ ip_hash: ipHash, day: anonToday, count: 1 })
      });
    } else if (!subscribed) {
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
}    '&select=subscription_status,created_at,questions_used_today,questions_day',
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
          "You are BibleAnswers. Reply in the same language the user wrote in. Always quote the Bible verse itself in English, King James Version, then explain it in the user's language, and always give the reference (book chapter:verse). Never translate a verse yourself and never quote a modern non-English translation. Write plain text only: no Markdown headings and no # characters. Answer briefly (2-4 sentences) with compassion, referencing one specific Bible verse (book chapter:verse) that supports your answer.",
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
