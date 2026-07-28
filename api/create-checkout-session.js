// api/create-checkout-session.js
// Creează o sesiune de Stripe Checkout pentru planul ales (weekly/monthly/yearly)
// și returnează URL-ul către care browserul trebuie redirecționat.

const PRICE_IDS = {
  weekly: 'price_1TxfCjJmNPM3ykGBHdr0m1Va',
  monthly: 'price_1TxfKTJmNPM3ykGBXpg6WAOz',
  yearly: 'price_1TxfIgJmNPM3ykGB0MLPKhxB',
  'yearly-promo': 'price_1TxfIgJmNPM3ykGB0MLPKhxB', // folosim același preț yearly pentru promo, până creăm un discount separat în Stripe
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { plan } = req.body;
    const priceId = PRICE_IDS[plan];

    if (!priceId) {
      res.status(400).json({ error: 'Invalid plan' });
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
