module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const SUPABASE_URL = 'https://zacllsdldntmcgttudod.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'sign_in_required' });

  try {
    const userResp = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: { Authorization: 'Bearer ' + token, apikey: SERVICE_KEY }
    });
    if (!userResp.ok) return res.status(401).json({ error: 'sign_in_required' });

    const user = await userResp.json();
    const userId = user.id;
    if (!userId) return res.status(401).json({ error: 'sign_in_required' });

    const profResp = await fetch(SUPABASE_URL + '/rest/v1/profiles?select=stripe_customer_id&id=eq.' + userId, {
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
    });
    const rows = profResp.ok ? await profResp.json() : [];
    const customerId = rows[0] && rows[0].stripe_customer_id;

    if (customerId && STRIPE_KEY) {
      const subsResp = await fetch('https://api.stripe.com/v1/subscriptions?customer=' + customerId + '&status=active&limit=10', {
        headers: { Authorization: 'Bearer ' + STRIPE_KEY }
      });
      if (subsResp.ok) {
        const subs = await subsResp.json();
        for (const sub of (subs.data || [])) {
          await fetch('https://api.stripe.com/v1/subscriptions/' + sub.id, {
            method: 'DELETE',
            headers: { Authorization: 'Bearer ' + STRIPE_KEY }
          });
        }
      }
    }

    const delResp = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + userId, {
      method: 'DELETE',
      headers: { apikey: SERVICE_KEY, Authorization: 'Bearer ' + SERVICE_KEY }
    });

    if (!delResp.ok) {
      const text = await delResp.text();
      console.error('delete failed', delResp.status, text);
      return res.status(500).json({ error: 'delete_failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('delete-account error', err);
    return res.status(500).json({ error: 'delete_failed' });
  }
};
