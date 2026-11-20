// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateKeyPairSync, createVerify } from "crypto";
// @ts-expect-error -- plain .mjs script, no type declarations
import { parseArgs, cleanChange, notesFromChangelog, fitNotes, releaseBody, signJwt } from "../../scripts/play-upload.mjs";

describe("parseArgs", () => {
  it("defaults to a production draft", () => {
    const o = parseArgs([], {});
    expect(o.track).toBe("production");
    expect(o.status).toBe("draft");
    expect(o.fraction).toBeNull();
  });

  it("maps --rollout and --fraction to Play statuses", () => {
    expect(parseArgs(["--rollout"], {}).status).toBe("completed");
    const staged = parseArgs(["--fraction", "0.2"], {});
    expect(staged.status).toBe("inProgress");
    expect(staged.fraction).toBe(0.2);
  });

  it("rejects bad input", () => {
    expect(() => parseArgs(["--track", "prod"], {})).toThrow(/--track/);
    expect(() => parseArgs(["--fraction", "1"], {})).toThrow(/between 0 and 1/);
    expect(() => parseArgs(["--existing", "abc"], {})).toThrow(/version code/);
    expect(() => parseArgs(["--status", "completed", "--fraction", "0.5", "--rollout"], {})).toThrow(/staged rollout/);
    expect(() => parseArgs(["--bogus"], {})).toThrow(/Unknown option/);
  });

  it("honours PLAY_TRACK", () => {
    expect(parseArgs([], { PLAY_TRACK: "internal" }).track).toBe("internal");
  });
});

describe("release notes", () => {
  it("strips commit prefixes", () => {
    expect(cleanChange("- fix(db): close database functions anyone could call")).toBe("Close database functions anyone could call");
    expect(cleanChange("feat: hosts edit rules")).toBe("Hosts edit rules");
  });

  it("drops docs/chore lines and duplicates", () => {
    const notes = notesFromChangelog({
      versionName: "4.33",
      changes: ["- fix(a): One thing", "- fix(b): one thing", "- docs(db): note", "- chore: bump", "- feat(x): Another"],
    });
    expect(notes).toBe("• One thing\n• Another");
  });

  it("falls back when nothing user-facing is left", () => {
    expect(notesFromChangelog({ versionName: "4.33", changes: ["- docs: x"] })).toBe("Version 4.33: bug fixes and improvements.");
  });

  it("stays within Play's 500-character limit and keeps whole lines", () => {
    const lines = Array.from({ length: 30 }, (_, i) => `• Change number ${i} with some descriptive words`);
    const text = fitNotes(lines);
    expect(text.length).toBeLessThanOrEqual(500);
    expect(text.endsWith("• Other fixes and improvements")).toBe(true);
    for (const l of text.split("\n")) expect(lines.includes(l) || l === "• Other fixes and improvements").toBe(true);
  });
});

describe("releaseBody", () => {
  it("adds userFraction only for staged rollouts", () => {
    const draft = releaseBody(parseArgs([], {}), 433, "n", "4.33 (433)");
    expect(draft).toEqual({
      track: "production",
      releases: [{ name: "4.33 (433)", versionCodes: ["433"], status: "draft", releaseNotes: [{ language: "en-US", text: "n" }] }],
    });
    const staged = releaseBody(parseArgs(["--fraction", "0.1"], {}), 433, "n", "x");
    expect(staged.releases[0].userFraction).toBe(0.1);
  });
});

describe("signJwt", () => {
  it("produces an RS256 JWT for the androidpublisher scope that verifies with the public key", () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const key = {
      client_email: "uploader@example.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    const jwt = signJwt(key, 1_000_000);
    const [h, c, sig] = jwt.split(".");
    const dec = (s: string) => JSON.parse(Buffer.from(s, "base64url").toString());
    expect(dec(h)).toEqual({ alg: "RS256", typ: "JWT" });
    expect(dec(c)).toMatchObject({
      iss: key.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: 1_000_000,
      exp: 1_003_600,
    });
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });
});
