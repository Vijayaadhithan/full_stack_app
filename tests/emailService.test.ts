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
      deliveryMethod: "pickup",
      shopPhone: "9876543210",
      shopAddress: "123 Market Street, Mumbai",
    });
    assert.ok(mail.subject.includes("Order Confirmation #1 from Spice Shop"));
    assert.ok(mail.text.includes("Hi John,"));
    assert.ok(mail.text.includes("Order Number: 1"));
    assert.ok(mail.text.includes("Shop Contact"));
    assert.ok(mail.text.includes("9876543210"));
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
      deliveryMethod: "delivery",
      customerPhone: "9123456789",
      customerAddress: "456 Customer Lane, Chennai",
    });
    assert.ok(mail.subject.includes("New Order #1 from John"));
    assert.ok(mail.text.includes("Hi Shop Owner,"));
    assert.ok(mail.html && mail.html.includes("Customer Phone"));
    assert.ok(mail.text.includes("Customer Contact"));
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
