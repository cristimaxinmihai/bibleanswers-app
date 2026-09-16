module.exports = async (req, res) => {
  const SUPABASE_URL = 'https://zacllsdldntmcgttudod.supabase.co';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const token = (req.query && req.query.token) || '';
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const page = (title, body) =>
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + title + '</title><style>' +
    'body{margin:0;background:#fff;color:#1a1d29;font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}' +
    '.w{max-width:32rem;margin:0 auto;padding:4rem 1.25rem}' +
    'h1{font-family:Georgia,serif;font-weight:600;font-size:1.75rem;margin:0 0 1rem}' +
    'a{color:#3a4f7a}' +
    '</style></head><body><div class="w">' + body +
    '<p><a href="https://askbibleanswers.com">Back to AskBibleAnswers</a></p>' +
    '</div></body></html>';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!uuidRe.test(token)) {
    return res.status(400).send(page('Invalid link',
      '<h1>This link is not valid</h1><p>Please use the unsubscribe link from a recent email, or email cristimaxinmihai@yahoo.com and we will remove you.</p>'));
  }

  try {
    const resp = await fetch(
      SUPABASE_URL + '/rest/v1/profiles?unsubscribe_token=eq.' + token,
      {
        method: 'PATCH',
        headers: {
          apikey: SERVICE_KEY,
          Authorization: 'Bearer ' + SERVICE_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation'
        },
        body: JSON.stringify({ daily_email: false })
      }
    );

    if (!resp.ok) {
      console.error('unsubscribe failed', resp.status, await resp.text());
      return res.status(500).send(page('Something went wrong',
        '<h1>Something went wrong</h1><p>Please email cristimaxinmihai@yahoo.com and we will remove you right away.</p>'));
    }

    const rows = await resp.json();
    if (!rows.length) {
      return res.status(404).send(page('Not found',
        '<h1>This link is no longer valid</h1><p>The account may have been deleted. If you still receive emails, write to cristimaxinmihai@yahoo.com.</p>'));
    }

    return res.status(200).send(page('Unsubscribed',
      '<h1>You have been unsubscribed</h1><p>You will no longer receive the daily verse and question. Your account and saved questions are untouched.</p>'));
  } catch (err) {
    console.error('unsubscribe error', err);
    return res.status(500).send(page('Something went wrong',
      '<h1>Something went wrong</h1><p>Please email cristimaxinmihai@yahoo.com and we will remove you right away.</p>'));
  }
};
