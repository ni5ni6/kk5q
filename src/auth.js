const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

function generateState() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function requireAuth(req, res, next) {
  if (req.session?.notionToken) return next();
  req.session.returnTo = req.originalUrl;
  res.redirect('auth/notion');
}

export function notionTokenForReq(req) {
  return req.session?.notionToken ?? null;
}

export function workspaceIdForReq(req) {
  return req.session?.workspaceId ?? 'default';
}

export function registerAuthRoutes(app) {
  app.get('/auth/notion', (req, res) => {
    if (!process.env.NOTION_CLIENT_ID || !process.env.NOTION_REDIRECT_URI) {
      return res.status(500).send('OAuth not configured (NOTION_CLIENT_ID / NOTION_REDIRECT_URI missing).');
    }
    const state = generateState();
    req.session.oauthState = state;
    const params = new URLSearchParams({
      client_id: process.env.NOTION_CLIENT_ID,
      response_type: 'code',
      owner: 'user',
      redirect_uri: process.env.NOTION_REDIRECT_URI,
      state,
    });
    res.redirect(`${NOTION_AUTH_URL}?${params}`);
  });

  app.get('/auth/notion/callback', async (req, res) => {
    const { code, state, error } = req.query;
    if (error)  return res.status(400).send(`Notion auth error: ${error}`);
    if (!code)  return res.status(400).send('Missing authorization code.');
    if (state !== req.session.oauthState) return res.status(400).send('Invalid state parameter.');
    delete req.session.oauthState;

    try {
      const credentials = Buffer.from(
        `${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`
      ).toString('base64');

      const resp = await fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: process.env.NOTION_REDIRECT_URI,
        }),
      });

      if (!resp.ok) {
        console.error('Notion token exchange failed:', await resp.text());
        return res.status(500).send('Token exchange failed.');
      }

      const data = await resp.json();
      req.session.notionToken    = data.access_token;
      req.session.workspaceId    = data.workspace_id;
      req.session.workspaceName  = data.workspace_name;

      const returnTo = req.session.returnTo || '/';
      delete req.session.returnTo;
      res.redirect(returnTo);
    } catch (err) {
      console.error('OAuth callback error:', err);
      res.status(500).send('Authentication failed.');
    }
  });

  app.get('/auth/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/auth/notion'));
  });
}
