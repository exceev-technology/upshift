#!/usr/bin/env node
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

const TWENTY_BRAND_WORD = /(?<![\w@./-])Twenty(?!\w|\.[a-z])/;
const HEALTH_TIMEOUT_MS = 15 * 60 * 1000;
const PRIVACY_SETTLE_MS = 20_000;

const { values: options } = parseArgs({
  options: {
    'base-url': { type: 'string', default: 'http://localhost:3000' },
    'brand-name': { type: 'string', default: 'Upshift' },
    'sink-log': { type: 'string' },
  },
});

const baseUrl = options['base-url'].replace(/\/$/, '');
const brandName = options['brand-name'];
const sinkLogPath = options['sink-log'];

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const check = (name, condition, detail) => {
  if (!condition) {
    throw new Error(`${name} failed${detail ? `: ${detail}` : ''}`);
  }

  console.log(`ok  ${name}`);
};

const readSinkConnections = () =>
  sinkLogPath
    ? readFileSync(sinkLogPath, 'utf8').split('\n').filter(Boolean)
    : [];

const waitForHealth = async () => {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/healthz`);

      if (response.ok) {
        return;
      }
    } catch {
      // the server is still starting
    }

    await sleep(5_000);
  }

  throw new Error(`${baseUrl}/healthz did not become healthy`);
};

const graphql = async ({ query, variables, token }) => {
  const response = await fetch(`${baseUrl}/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  const body = await response.json();

  if (Array.isArray(body.errors) && body.errors.length > 0) {
    throw new Error(`GraphQL error: ${JSON.stringify(body.errors).slice(0, 600)}`);
  }

  return body.data;
};

const checkBranding = async () => {
  const html = await fetch(`${baseUrl}/`).then((response) => response.text());

  check('page title', html.includes(`<title>${brandName}</title>`));
  check('no Twenty in the served page', !TWENTY_BRAND_WORD.test(html));

  const manifest = await fetch(`${baseUrl}/manifest.json`).then((response) =>
    response.json(),
  );

  check(
    'PWA manifest name',
    manifest.name === brandName && manifest.short_name === brandName,
    JSON.stringify({ name: manifest.name, short_name: manifest.short_name }),
  );

  const serverCard = await fetch(`${baseUrl}/.well-known/mcp/server-card.json`).then(
    (response) => response.json(),
  );

  check('MCP server card title', serverCard.title === `${brandName} CRM`, serverCard.title);
  check(
    'no twenty in the MCP server card',
    !/twenty/i.test(JSON.stringify(serverCard)),
  );
};

const checkSignUpAndSignIn = async () => {
  const email = `smoke-${randomBytes(4).toString('hex')}@upshift-smoke.io`;
  const password = `Smoke-${randomBytes(12).toString('hex')}!`;

  const signUpData = await graphql({
    query: `mutation SignUp($email: String!, $password: String!) {
      signUp(email: $email, password: $password) {
        tokens { accessOrWorkspaceAgnosticToken { token } }
      }
    }`,
    variables: { email, password },
  });
  const workspaceAgnosticToken =
    signUpData.signUp.tokens.accessOrWorkspaceAgnosticToken.token;

  check('sign up', Boolean(workspaceAgnosticToken));

  const workspaceData = await graphql({
    query: `mutation SignUpInNewWorkspace($input: SignUpInNewWorkspaceInput) {
      signUpInNewWorkspace(input: $input) {
        loginToken { token }
        workspace { id }
      }
    }`,
    variables: { input: { displayName: 'Smoke test' } },
    token: workspaceAgnosticToken,
  });
  const loginToken = workspaceData.signUpInNewWorkspace.loginToken.token;

  check('create workspace', Boolean(workspaceData.signUpInNewWorkspace.workspace.id));

  const tokensData = await graphql({
    query: `mutation GetAuthTokensFromLoginToken($loginToken: String!, $origin: String!) {
      getAuthTokensFromLoginToken(loginToken: $loginToken, origin: $origin) {
        tokens { accessOrWorkspaceAgnosticToken { token } }
      }
    }`,
    variables: { loginToken, origin: baseUrl },
  });
  const accessToken =
    tokensData.getAuthTokensFromLoginToken.tokens.accessOrWorkspaceAgnosticToken.token;

  const currentUserData = await graphql({
    query: '{ currentUser { email } }',
    token: accessToken,
  });

  check(
    'authenticated request',
    currentUserData.currentUser.email === email,
    currentUserData.currentUser.email,
  );

  const signInData = await graphql({
    query: `mutation SignIn($email: String!, $password: String!) {
      signIn(email: $email, password: $password) {
        tokens { accessOrWorkspaceAgnosticToken { token } }
      }
    }`,
    variables: { email, password },
  });

  check('sign in', Boolean(signInData.signIn.tokens.accessOrWorkspaceAgnosticToken.token));
};

await waitForHealth();
check('server healthy', true);

const connectionsBeforeTest = readSinkConnections().length;

await checkBranding();
await checkSignUpAndSignIn();

if (sinkLogPath) {
  await sleep(PRIVACY_SETTLE_MS);

  const newConnections = readSinkConnections().slice(connectionsBeforeTest);

  check(
    'no connection to Twenty-owned hosts after sign-up and sign-in',
    newConnections.length === 0,
    newConnections.join('; '),
  );
}

console.log('Smoke test passed');
