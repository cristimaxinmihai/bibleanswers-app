// api/create-checkout-session.js
// Creează o sesiune de Stripe Checkout pentru planul ales (weekly/monthly/yearly)
// și returnează URL-ul către care browserul trebuie redirecționat.
//
// Sesiunea poartă acum identitatea utilizatorului Supabase, în două locuri:
//   - client_reference_id         → ajunge în checkout.session.completed
//   - subscription_data[metadata] → rămâne lipit de abonament, deci ajunge și în
//                                   customer.subscription.updated / .deleted

const PRICE_IDS = {
  weekly: 'price_1Tyc0OJc0oLZr7dskStORKLt',
  monthly: 'price_1Tyc0SJc0oLZr7dsogTpJB6A',
    yearly: 'price_1U7chfJc0oLZr7dsuUL35ety',
};

// Perioada de probă gratuită (card cerut, prima plată după 7 zile).
// Doar la monthly/yearly și doar pentru cine n-a mai avut niciodată abonament.
const TRIAL_DAYS = 7;
const TRIAL_PLANS = ['monthly', 'yearly'];
const SUPABASE_URL = 'https://zacllsdldntmcgttudod.supabase.co';

async function hadSubscriptionBefore(userId) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key || !/^[0-9a-f-]{36}$/i.test(userId)) return true; // la dubiu, fără probă
  try {
    const r = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?id=eq.' + userId + '&select=stripe_customer_id',
      { headers: { apikey: key, Authorization: 'Bearer ' + key } }
    );
    const rows = await r.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    return !row || !!row.stripe_customer_id;
  } catch (e) {
    return true;
  }
}

module.exports = async (req, res) => {
res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { plan, userId, email } = req.body;

    const priceId = PRICE_IDS[plan];
    if (!priceId) {
      res.status(400).json({ error: 'Invalid plan' });
      return;
    }

    // Fără cont nu avem cui atribui abonamentul.
    if (!userId) {
      res.status(400).json({ error: 'Sign in before subscribing' });
      return;
    }

    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      res.status(500).json({ error: 'Stripe is not configured' });
      return;
    }

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', `${origin}/?checkout=success`);
    params.append('cancel_url', `${origin}/?checkout=cancel`);

    // Cine plătește.
    params.append('client_reference_id', userId);
    params.append('subscription_data[metadata][supabase_user_id]', userId);
    if (email) {
      params.append('customer_email', email);
    }

    if (TRIAL_PLANS.includes(plan) && !(await hadSubscriptionBefore(userId))) {
      params.append('subscription_data[trial_period_days]', String(TRIAL_DAYS));
    }

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Stripe error:', data);
      res.status(500).json({ error: 'Could not create checkout session' });
      return;
    }

    res.status(200).json({ url: data.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
};
