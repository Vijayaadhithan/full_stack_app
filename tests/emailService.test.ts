import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getWelcomeEmailContent,
  getPasswordResetEmailContent,
  getVerificationEmailContent,
} from "../server/emailService";

describe("email templates", () => {
  it("creates welcome email content", () => {
    const mail = getWelcomeEmailContent("John", "link");
    assert.ok(mail.subject.includes("Welcome"));
    assert.ok(mail.text.includes("John"));
    assert.ok(mail.text.includes("link"));
  });

  it("creates verification email content", () => {
    const mail = getVerificationEmailContent("John", "link");
    assert.ok(mail.subject.toLowerCase().includes("verify"));
    assert.ok(mail.text.includes("link"));
  });
  it("creates password reset content", () => {
    const mail = getPasswordResetEmailContent("John", "reset");
    assert.ok(mail.text.includes("reset"));
  });
});
