// api/stripe-webhook.js
// Primeste evenimente de la Stripe si actualizeaza tabelul profiles din Supabase.

const SUPABASE_URL = 'https://zacllsdldntmcgttudod.supabase.co';

const STRIPE_KEY =
  process.env.STRIPE_SECRET_KEY ||
  process.env.STRIPE_API_KEY ||
  process.env.STRIPE_SECRET;

async function stripeGet(path) {
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    headers: { Authorization: 'Bearer ' + STRIPE_KEY },
  });
  if (!r.ok) {
    console.error('stripe get failed', path, r.status);
    return null;
  }
  return r.json();
}

async function updateProfile(filter, fields) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const r = await fetch(SUPABASE_URL + '/rest/v1/profiles?' + filter, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(fields),
  });
  const rows = await r.json().catch(() => null);
  console.log('profiles patch', filter, r.status, JSON.stringify(rows));
  return Array.isArray(rows) && rows.length > 0;
}

function periodEnd(sub) {
  const item = sub.items && sub.items.data && sub.items.data[0];
  const secs = sub.current_period_end || (item && item.current_period_end);
  return secs ? new Date(secs * 1000).toISOString() : null;
}

async function saveSubscription(sub, userIdHint) {
  const userId =
    userIdHint || (sub.metadata && sub.metadata.supabase_user_id) || null;
  const customerId = typeof sub.customer === 'string' ? sub.customer : null;

  const fields = {
    subscription_status: sub.status,
    current_period_end: periodEnd(sub),
  };
  if (customerId) fields.stripe_customer_id = customerId;

  if (userId) {
    const ok = await updateProfile('id=eq.' + userId, fields);
    if (ok) return true;
  }
  if (customerId) {
    return updateProfile('stripe_customer_id=eq.' + customerId, fields);
  }
  console.error('no user id and no customer id on', sub.id);
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!STRIPE_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('missing env vars');
    res.status(500).json({ error: 'Server not configured' });
    return;
  }

  try {
    const posted = req.body || {};
    const eventId = posted.id;
    if (typeof eventId !== 'string' || eventId.indexOf('evt_') !== 0) {
      res.status(400).json({ error: 'Not a Stripe event' });
      return;
    }

    // Sursa de adevar: reluam evenimentul direct de la Stripe.
    // Un POST falsificat nu trece, pentru ca id-ul lui nu exista in contul nostru.
    const event = await stripeGet('events/' + eventId);
    if (!event || !event.type) {
      res.status(400).json({ error: 'Event not found in Stripe' });
      return;
    }

    const obj = event.data.object;

    if (event.type === 'checkout.session.completed') {
      const userId =
        obj.client_reference_id ||
        (obj.metadata && obj.metadata.supabase_user_id) ||
        null;
      if (obj.subscription) {
        const sub = await stripeGet('subscriptions/' + obj.subscription);
        if (sub) await saveSubscription(sub, userId);
      }
    } else if (
      event.type === 'customer.subscription.updated' ||
      event.type === 'customer.subscription.deleted'
    ) {
      await saveSubscription(obj, null);
    } else {
      console.log('ignored event', event.type);
    }

    res.status(200).json({ received: true });
  } catch (e) {
    console.error('webhook error', e);
    res.status(200).json({ received: true });
  }
};
