import { describe, it, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let importCounter = 0;

type SetupOptions = {
  env?: Record<string, string | undefined>;
  accessToken?: string | null;
};

async function setupEmailService(options: SetupOptions = {}) {
  mock.restoreAll();
  const originalEnv = { ...process.env };
  process.env = { ...originalEnv, ...options.env };

  const googleAuth = await import("google-auth-library");
  const nodemailerModule = require("nodemailer");
  const loggerModule = await import("../server/logger");

  const sendMailMock = mock.fn(async () => undefined);
  const createTransportMock = mock.fn(() => ({ sendMail: sendMailMock }));

  const originalCreateTransport = nodemailerModule.createTransport;
  nodemailerModule.createTransport = createTransportMock as any;

  const logger = loggerModule.default;
  mock.method(logger, "info", () => undefined);
  mock.method(logger, "warn", () => undefined);
  mock.method(logger, "error", () => undefined);

  mock.method(
    googleAuth.OAuth2Client.prototype,
    "setCredentials",
    () => undefined,
  );
 mock.method(
    googleAuth.OAuth2Client.prototype,
    "getAccessToken",
    async () => ({
      token:
        options.accessToken === undefined
          ? "test-access-token"
          : options.accessToken,
    }),
  );

  const immediateCallbacks: Array<() => unknown> = [];
  mock.method(global, "setImmediate", (cb: (...args: never[]) => unknown, ...args: never[]) => {
    immediateCallbacks.push(() => cb(...args));
    return {} as NodeJS.Immediate;
  });

  const moduleSpecifier = `../server/emailService?test=${++importCounter}`;
  const service = await import(moduleSpecifier);

  async function runQueuedJobs() {
    while (immediateCallbacks.length > 0) {
      const job = immediateCallbacks.shift();
      if (!job) continue;
      await job();
    }
  }

  return {
    ...service,
    logger,
    sendMailMock,
    createTransportMock,
    runQueuedJobs,
    restore() {
      process.env = originalEnv;
      nodemailerModule.createTransport = originalCreateTransport;
      mock.restoreAll();
    },
  };
}

afterEach(() => {
  mock.restoreAll();
});

describe("email templates", () => {
  it("generates user-facing email bodies", async () => {
    const mod = await setupEmailService();
    try {
      const {
        getWelcomeEmailContent,
        getPasswordResetEmailContent,
        getVerificationEmailContent,
        getMagicLinkEmailContent,
      } = mod;

      const welcome = getWelcomeEmailContent("John", "link");
      assert.ok(welcome.subject.includes("Welcome"));
      assert.ok(welcome.text.includes("John"));

      const verify = getVerificationEmailContent("John", "link");
      assert.ok(verify.subject.toLowerCase().includes("verify"));
      assert.ok(verify.text.includes("link"));

      const reset = getPasswordResetEmailContent("John", "reset");
      assert.ok(reset.text.includes("reset"));

      const magic = getMagicLinkEmailContent("John", "magic");
      assert.ok(magic.text.includes("magic"));
    } finally {
      mod.restore();
    }
  });
});

describe("email dispatch", () => {
  it("queues email jobs and sends messages when credentials are configured", async () => {
    const credentials = {
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      GMAIL_REFRESH_TOKEN: "refresh",
      EMAIL_SENDER: "noreply@example.com",
    };

    const mod = await setupEmailService({ env: credentials });
    try {
      const { sendEmail, runQueuedJobs, createTransportMock, sendMailMock } = mod;

      const queued = await sendEmail({
        to: "user@example.com",
        subject: "Hello",
        text: "Body",
      });

      assert.equal(queued, true);
      await runQueuedJobs();

      assert.equal(createTransportMock.mock.callCount(), 1);
      const transporterConfig = createTransportMock.mock.calls[0].arguments[0];
      assert.equal(transporterConfig.auth?.user, "noreply@example.com");
      assert.equal(sendMailMock.mock.callCount(), 1);
    } finally {
      mod.restore();
    }
  });

  it("logs and aborts when transporter cannot be created", async () => {
    const credentials = {
      GOOGLE_CLIENT_ID: "client",
      GOOGLE_CLIENT_SECRET: "secret",
      GMAIL_REFRESH_TOKEN: "refresh",
      EMAIL_SENDER: "noreply@example.com",
    };

    const mod = await setupEmailService({ env: credentials, accessToken: null });
    try {
      const { sendEmail, runQueuedJobs, createTransportMock, logger } = mod;

      await sendEmail({
        to: "user@example.com",
        subject: "Hi",
        text: "Body",
      });

      await runQueuedJobs();

      assert.equal(createTransportMock.mock.callCount(), 0);
      assert.ok(
        logger.error.mock.calls.some((call) => {
          const [firstArg] = call.arguments;
          return (
            typeof firstArg === "string" &&
            firstArg.includes("Failed to create email transporter")
          );
        }),
      );
    } finally {
      mod.restore();
    }
  });

  it("skips sending when credentials are missing", async () => {
    const mod = await setupEmailService({
      env: {
        GOOGLE_CLIENT_ID: undefined,
        GOOGLE_CLIENT_SECRET: undefined,
        GMAIL_REFRESH_TOKEN: undefined,
        EMAIL_SENDER: undefined,
      },
    });
    try {
      const { sendEmail, runQueuedJobs, logger, createTransportMock } = mod;

      await sendEmail({
        to: "user@example.com",
        subject: "Test",
        text: "Body",
      });

      await runQueuedJobs();

      assert.equal(createTransportMock.mock.callCount(), 0);
      assert.ok(
        logger.error.mock.calls.some((call) => {
          const [firstArg] = call.arguments;
          return (
            typeof firstArg === "string" &&
            firstArg.includes("Cannot send email")
          );
        }),
      );
    } finally {
      mod.restore();
    }
  });
});
