const raw = process.argv[2];
if (!raw) throw new Error("OIDC response JSON is required.");
const parsed = JSON.parse(raw);
if (typeof parsed.value !== "string" || !parsed.value) throw new Error("OIDC response did not contain a token value.");
process.stdout.write(parsed.value);
