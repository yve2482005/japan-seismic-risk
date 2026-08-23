import { createSign } from "node:crypto";
import { describe, expect, it } from "vitest";

type ServiceAccount = {
  type: string;
  client_email: string;
  private_key: string;
  token_uri: string;
};

function base64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function createAssertion(account: ServiceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64Url(JSON.stringify({
    iss: account.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file",
    aud: account.token_uri,
    iat: now,
    exp: now + 300,
  }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(account.private_key).toString("base64url")}`;
}

describe("Google service-account connection", () => {
  it("obtains a token and accesses the Drive metadata endpoint without exposing credentials", async () => {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    expect(raw, "GOOGLE_SERVICE_ACCOUNT_JSON must be configured").toBeTruthy();
    const account = JSON.parse(raw!) as ServiceAccount;
    expect(account.type).toBe("service_account");

    const tokenResponse = await fetch(account.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: createAssertion(account),
      }),
    });
    expect(tokenResponse.status, "Google OAuth token request must succeed").toBe(200);
    const token = await tokenResponse.json() as { access_token?: string };
    expect(token.access_token).toMatch(/^[A-Za-z0-9._-]+$/);

    const driveResponse = await fetch("https://www.googleapis.com/drive/v3/files?pageSize=1&fields=files(id)", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    expect(driveResponse.status, "Google Drive API must accept the service-account token").toBe(200);
  }, 20_000);

  it("accepts a valid owner-sharing address while the authorized Drive endpoint remains available", async () => {
    const ownerEmail = process.env.GOOGLE_SHEETS_OWNER_EMAIL;
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    expect(ownerEmail, "GOOGLE_SHEETS_OWNER_EMAIL must be configured").toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    const account = JSON.parse(raw!) as ServiceAccount;
    const tokenResponse = await fetch(account.token_uri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: createAssertion(account) }),
    });
    const token = await tokenResponse.json() as { access_token?: string };
    const response = await fetch("https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    expect(response.status, "Google Drive must remain authorized before sharing a spreadsheet").toBe(200);
  }, 20_000);
});
