import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getWelcomeEmailContent,
  getPasswordResetEmailContent,
  getOrderConfirmationEmailContent,
  getBookingConfirmationEmailContent,
} from "../server/emailService";

const orderSummary = { orderId: 1, total: "100" };
const items = [{ name: "item", quantity: 2, price: "50" }];

describe("email templates", () => {
  it("creates welcome email content", () => {
    const mail = getWelcomeEmailContent("John", "link");
    assert.ok(mail.subject.includes("Welcome"));
    assert.ok(mail.text.includes("John"));
  });

  it("creates password reset content", () => {
    const mail = getPasswordResetEmailContent("John", "reset");
    assert.ok(mail.text.includes("reset"));
  });

  it("creates order confirmation for customer", () => {
    const mail = getOrderConfirmationEmailContent("John", orderSummary, items);
    assert.ok(mail.subject.includes("Confirmation"));
    assert.ok(mail.text.includes("Order ID"));
  });

  it("creates booking confirmation for provider", () => {
    const mail = getBookingConfirmationEmailContent("Provider", {
      bookingId: "1",
      customerName: "John",
      serviceName: "Service",
      bookingDate: new Date(),
    });
    assert.ok(mail.subject.includes("Booking"));
  });
});
