import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getWelcomeEmailContent,
  getPasswordResetEmailContent,
  getVerificationEmailContent,
  getOrderConfirmationEmailContent,
  getBookingConfirmationEmailContent,
} from "../server/emailService";

const items = [{ name: "item", quantity: 2, price: "50" }];

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

  it("creates order confirmation for customer", () => {
    const mail = getOrderConfirmationEmailContent({
      recipientName: "John",
      customerName: "John",
      shopName: "Spice Shop",
      orderNumber: 1,
      total: "100",
      items,
    });
    assert.ok(mail.subject.includes("Order Confirmation #1 from Spice Shop"));
    assert.ok(mail.text.includes("Hi John,"));
    assert.ok(mail.text.includes("Order Number: 1"));
  });

  it("creates order notification for shop owner", () => {
    const mail = getOrderConfirmationEmailContent({
      recipientName: "Shop Owner",
      customerName: "John",
      shopName: "Spice Shop",
      orderNumber: 1,
      total: "100",
      items,
      forShopOwner: true,
    });
    assert.ok(mail.subject.includes("New Order #1 from John"));
    assert.ok(mail.text.includes("Hi Shop Owner,"));
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
