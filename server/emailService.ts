import { google } from "googleapis";
import nodemailer from "nodemailer";
import { OAuth2Client } from "google-auth-library";
import logger from "./logger";
import { addJob } from "./jobQueue";

const GMAIL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const EMAIL_SENDER = process.env.EMAIL_SENDER;

if (
  !GMAIL_CLIENT_ID ||
  !GMAIL_CLIENT_SECRET ||
  !GMAIL_REFRESH_TOKEN ||
  !EMAIL_SENDER
) {
  logger.error(
    "Missing Gmail API credentials or sender email in environment variables. Email functionality will be disabled.",
  );
  // Optionally, throw an error to prevent the application from starting without email capabilities
  // throw new Error('Missing Gmail API credentials or sender email.');
}

const oauth2Client = new OAuth2Client(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob", // Or your redirect URI if applicable for obtaining the refresh token
);

if (GMAIL_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
}

async function createTransporter() {
  if (!GMAIL_REFRESH_TOKEN) {
    logger.warn(
      "Gmail refresh token is not set. Email sending will likely fail.",
    );
    // Fallback or throw error if you don't want to proceed without a refresh token
    return null;
  }

  try {
    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    if (!accessToken) {
      throw new Error("Failed to retrieve access token for Gmail.");
    }

    return nodemailer.createTransport({
      service: "gmail",
      auth: {
        type: "OAuth2",
        user: EMAIL_SENDER,
        clientId: GMAIL_CLIENT_ID,
        clientSecret: GMAIL_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN,
        accessToken: accessToken,
      },
    });
  } catch (error) {
    logger.error("Error creating Nodemailer transporter:", error);
    return null;
  }
}

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function sendEmailNow(mailOptions: MailOptions): Promise<void> {
  if (
    !GMAIL_CLIENT_ID ||
    !GMAIL_CLIENT_SECRET ||
    !GMAIL_REFRESH_TOKEN ||
    !EMAIL_SENDER
  ) {
    logger.error(
      "Cannot send email due to missing Gmail API credentials or sender email.",
    );
    return;
  }

  const transporter = await createTransporter();
  if (!transporter) {
    logger.error("Failed to create email transporter. Email not sent.");
    return;
  }

  try {
    await transporter.sendMail({
      from: `"DoorStep" <${EMAIL_SENDER}>`,
      ...mailOptions,
    });
    logger.info(
      `Email sent to ${mailOptions.to} with subject "${mailOptions.subject}"`,
    );
    return;
  } catch (error) {
    logger.error("Error sending email:", error);
    return;
  }
}
export async function sendEmail(mailOptions: MailOptions): Promise<boolean> {
  addJob(() => sendEmailNow(mailOptions));
  return true;
}

// --- Template Functions --- //
export function getVerificationEmailContent(
  name: string,
  verificationLink: string,
): MailOptions {
  const subject = "Verify your DoorStep account";
  const text = `Hi ${name},

Please verify your email address by clicking this link: ${verificationLink}

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${name},</p>
<p>Please verify your email address by clicking this link: <a href="${verificationLink}">${verificationLink}</a></p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}
export function getWelcomeEmailContent(
  name: string,
  verificationLink: string,
): MailOptions {
  const subject = "Welcome to DoorStep!";
  
  const text = `Hi ${name},

Welcome to DoorStep! We're excited to have you on board.

Please verify your email address by clicking this link: ${verificationLink}

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${name},</p>
<p>Welcome to DoorStep! We're excited to have you on board.</p>
<p>Please verify your email address by clicking this link: <a href="${verificationLink}">${verificationLink}</a></p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" }; // 'to' will be set by the caller
}

export function getPasswordResetEmailContent(
  name: string,
  resetLink: string,
): MailOptions {
  const subject = "Password Reset Request for DoorStep";
  const text = `Hi ${name},

You requested a password reset for your DoorStep account.
Click this link to reset your password: ${resetLink}

If you didn't request this, please ignore this email.

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${name},</p>
<p>You requested a password reset for your DoorStep account.</p>
<p>Click this link to reset your password: <a href="${resetLink}">${resetLink}</a></p>
<p>If you didn't request this, please ignore this email.</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

import { formatIndianDisplay } from "@shared/date-utils"; // Import IST utility

export interface OrderItemInfo {
  name: string;
  quantity: number;
  price: string | number;
}

export interface OrderConfirmationEmailOptions {
  recipientName: string;
  customerName: string;
  shopName: string;
  orderNumber: number | string;
  total: string | number;
  items: OrderItemInfo[];
  forShopOwner?: boolean;
}

function formatItemsText(items: OrderItemInfo[]): string {
  return items
    .map((item) => `- ${item.name} x${item.quantity} @ ₹${item.price}`)
    .join("\n");
}

function formatItemsHtml(items: OrderItemInfo[]): string {
  return (
    "<ul>" +
    items
      .map((item) => `<li>${item.name} x${item.quantity} @ ₹${item.price}</li>`)
      .join("") +
    "</ul>"
  );
}

export function getOrderConfirmationEmailContent({
  recipientName,
  customerName,
  shopName,
  orderNumber,
  total,
  items,
  forShopOwner = false,
}: OrderConfirmationEmailOptions): MailOptions {
  const subject = forShopOwner
    ? `New Order #${orderNumber} from ${customerName}`
    : `Order Confirmation #${orderNumber} from ${shopName}`;

  const greetingName = forShopOwner ? recipientName : customerName;
  const introLine = forShopOwner
    ? `A new order has been placed on ${shopName} by ${customerName}.`
    : `Thank you for your order from ${shopName}!`;

  const orderDetailsTextLines = [
    `Order Number: ${orderNumber}`,
    `Total: ${total}`,
    `${forShopOwner ? "Customer" : "Shop"}: ${forShopOwner ? customerName : shopName}`,
  ];

  const orderDetailsHtmlParts = [
    `<li><strong>Order Number:</strong> ${orderNumber}</li>`,
    `<li><strong>Total:</strong> ${total}</li>`,
    `<li><strong>${forShopOwner ? "Customer" : "Shop"}:</strong> ${
      forShopOwner ? customerName : shopName
    }</li>`,
  ];

  const text = `Hi ${greetingName},

${introLine}

${orderDetailsTextLines.join("\n")}
Items:\n${formatItemsText(items)}
Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${greetingName},</p>
<p>${introLine}</p>
<p><strong>Order Details:</strong></p>
<ul>${orderDetailsHtmlParts.join("")}</ul>
<p><strong>Items:</strong></p>
${formatItemsHtml(items)}
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

// This function is now primarily for the provider's "New Booking Request"
export function getBookingConfirmationEmailContent(
  providerName: string,
  bookingDetails: {
    bookingId: string;
    customerName: string;
    serviceName: string;
    bookingDate: string | Date;
    customerAddress?: string;
    customerPhone?: string;
  },
): MailOptions {
  const subject = "New Booking Request!";
  const text = `Hi ${providerName},

New booking request for ${bookingDetails.serviceName}.

Details:
- Booking ID: ${bookingDetails.bookingId}
- Customer: ${bookingDetails.customerName}
- Service: ${bookingDetails.serviceName}
- Date & Time: ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}
${bookingDetails.customerAddress ? `- Address: ${bookingDetails.customerAddress}` : ""}
${bookingDetails.customerPhone ? `- Phone: ${bookingDetails.customerPhone}` : ""}

Please review this request in your dashboard.

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${providerName},</p>
<p>New booking request for <strong>${bookingDetails.serviceName}</strong>.</p>
<p><strong>Details:</strong></p>
<ul>
    <li><strong>Booking ID:</strong> ${bookingDetails.bookingId}</li>
    <li><strong>Customer:</strong> ${bookingDetails.customerName}</li>
    <li><strong>Service:</strong> ${bookingDetails.serviceName}</li>
    <li><strong>Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}</li>
    ${bookingDetails.customerAddress ? `<li><strong>Address:</strong> ${bookingDetails.customerAddress}</li>` : ""}
    ${bookingDetails.customerPhone ? `<li><strong>Phone:</strong> ${bookingDetails.customerPhone}</li>` : ""}
</ul>
<p>Please review this request in your dashboard.</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

export function sendBookingUpdateEmail(
  to: string,
  details: {
    customerName: string;
    serviceName: string;
    bookingStatus: string;
    bookingDate: string;
    bookingId: string;
    providerName: string;
    comments: string;
    subject: string;
    loginUrl: string;
    bookingDetailsUrl: string;
  },
): Promise<boolean> {
  const {
    customerName,
    serviceName,
    bookingStatus,
    bookingDate,
    bookingId,
    providerName,
    comments,
    subject,
    loginUrl,
    bookingDetailsUrl,
  } = details;

  const mailOptions = {
    to,
    subject,
    text: `Hi ${customerName},\n\nYour booking for ${serviceName} has been updated to ${bookingStatus}.\n\nDetails:\n- Booking ID: ${bookingId}\n- Service: ${serviceName}\n- Status: ${bookingStatus}\n- Date: ${bookingDate}\n- Provider: ${providerName}\n\n${comments ? `Comments: ${comments}\n\n` : ""}You can view your booking details here: ${bookingDetailsUrl}\n\nThanks,\nThe DoorStep Team`,
    html: `<p>Hi ${customerName},</p>
<p>Your booking for <strong>${serviceName}</strong> has been updated to <strong>${bookingStatus}</strong>.</p>
<p><strong>Details:</strong></p>
<ul>
  <li><strong>Booking ID:</strong> ${bookingId}</li>
  <li><strong>Service:</strong> ${serviceName}</li>
  <li><strong>Status:</strong> ${bookingStatus}</li>
  <li><strong>Date:</strong> ${bookingDate}</li>
  <li><strong>Provider:</strong> ${providerName}</li>
</ul>
${comments ? `<p><strong>Comments:</strong> ${comments}</p>` : ""}
<p>You can <a href="${bookingDetailsUrl}">view your booking details here</a>.</p>
<p>Thanks,<br/>The DoorStep Team</p>`,
  };

  return sendEmail(mailOptions);
}

export function sendBookingRescheduledByCustomerEmail(
  to: string,
  details: {
    providerName: string;
    customerName: string;
    serviceName: string;
    newBookingDate: string;
    originalBookingDate: string;
    bookingId: string;
    loginUrl: string;
    bookingDetailsUrl: string;
  },
): Promise<boolean> {
  const {
    providerName,
    customerName,
    serviceName,
    newBookingDate,
    originalBookingDate,
    bookingId,
    loginUrl,
    bookingDetailsUrl,
  } = details;

  const mailOptions = {
    to,
    subject: `Customer Reschedule Request for Booking #${bookingId}`,
    text: `Hi ${providerName},\n\nCustomer ${customerName} has requested to reschedule booking #${bookingId} for '${serviceName}'.\nOriginal Date: ${originalBookingDate}\nNew Requested Date: ${newBookingDate}.\n\nPlease review this request in your dashboard: ${bookingDetailsUrl}\n\nThanks,\nThe DoorStep Team`,
    html: `<p>Hi ${providerName},</p>
<p>Customer <strong>${customerName}</strong> has requested to reschedule booking #${bookingId} for '<strong>${serviceName}</strong>'.</p>
<p>Original Date: <strong>${originalBookingDate}</strong></p>
<p>New Requested Date: <strong>${newBookingDate}</strong></p>
<p>Please <a href="${bookingDetailsUrl}">review this request in your dashboard</a>.</p>
<p>Thanks,<br/>The DoorStep Team</p>`,
  };

  return sendEmail(mailOptions);
}

export function sendBookingRescheduledByProviderEmail(
  to: string,
  details: {
    customerName: string;
    providerName: string;
    serviceName: string;
    newBookingDate: string;
    originalBookingDate: string;
    bookingId: string;
    comments?: string;
    loginUrl: string;
    bookingDetailsUrl: string;
  },
): Promise<boolean> {
  const {
    customerName,
    providerName,
    serviceName,
    newBookingDate,
    originalBookingDate,
    bookingId,
    comments,
    loginUrl,
    bookingDetailsUrl,
  } = details;

  const mailOptions = {
    to,
    subject: `Booking #${bookingId} Has Been Rescheduled by Provider`,
    text: `Hi ${customerName},\n\nYour booking #${bookingId} for '${serviceName}' with ${providerName} has been rescheduled.\nOriginal Date: ${originalBookingDate}\nNew Date: ${newBookingDate}.\n\n${comments ? `Provider's reason: ${comments}\n` : ""}\nPlease check your updated booking details: ${bookingDetailsUrl}\n\nThanks,\nThe DoorStep Team`,
    html: `<p>Hi ${customerName},</p>
<p>Your booking #${bookingId} for '<strong>${serviceName}</strong>' with <strong>${providerName}</strong> has been rescheduled.</p>
<p>Original Date: <strong>${originalBookingDate}</strong></p>
<p>New Date: <strong>${newBookingDate}</strong></p>
${comments ? `<p>Provider's reason: ${comments}</p>` : ""}
<p>Please <a href="${bookingDetailsUrl}">check your updated booking details</a>.</p>
<p>Thanks,<br/>The DoorStep Team</p>`,
  };

  return sendEmail(mailOptions);
}

export function getBookingUpdateEmailContent(
  name: string,
  bookingDetails: {
    id: string;
    serviceName?: string;
    bookingDate?: string | Date;
  },
  oldStatus: string,
  newStatus: string,
  forProvider: boolean = false,
): MailOptions {
  const subject = forProvider
    ? `Booking Update Notification (ID: ${bookingDetails.id})`
    : `Your DoorStep Booking Has Been Updated (ID: ${bookingDetails.id})`;
  let bookingDetailsHtml = "<ul>";
  bookingDetailsHtml += `<li><strong>Booking ID:</strong> ${bookingDetails.id}</li>`;
  if (bookingDetails.serviceName) {
    bookingDetailsHtml += `<li><strong>Service:</strong> ${bookingDetails.serviceName}</li>`;
  }
  if (bookingDetails.bookingDate) {
    bookingDetailsHtml += `<li><strong>Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}</li>`;
  }
  bookingDetailsHtml += "</ul>";

  const text = `Hi ${name},

${forProvider ? "A booking has been updated." : "There has been an update to your booking on DoorStep."}

Booking ID: ${bookingDetails.id}
Previous Status: ${oldStatus}
New Status: ${newStatus}

Booking Details:
${JSON.stringify(bookingDetails, null, 2)}

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${name},</p>
<p>${forProvider ? "A booking has been updated." : "There has been an update to your booking on DoorStep."}</p>
<p><strong>Booking ID:</strong> ${bookingDetails.id}</p>
<p><strong>Previous Status:</strong> ${oldStatus}</p>
<p><strong>New Status:</strong> ${newStatus}</p>
<p><strong>Booking Details:</strong></p>${bookingDetailsHtml}
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

// --- New Email Template Functions --- //

export function getBookingRequestPendingEmailContent(
  customerName: string,
  bookingDetails: {
    serviceName: string;
    bookingDate: string | Date;
    providerName: string;
  },
): MailOptions {
  const subject = "Your Booking Request is Pending - DoorStep";
  const text = `Hi ${customerName},

Your request for "${bookingDetails.serviceName}" on ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")} with ${bookingDetails.providerName} has been sent.

We'll notify you of any updates from the provider.

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Your request for "<strong>${bookingDetails.serviceName}</strong>" on <strong>${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}</strong> with <strong>${bookingDetails.providerName}</strong> has been sent.</p>
<p>We'll notify you of any updates from the provider.</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

export function getBookingAcceptedEmailContent(
  customerName: string,
  bookingDetails: { serviceName: string; bookingDate: string | Date },
  providerDetails: { name: string; location?: string },
): MailOptions {
  const subject = "Your Booking Has Been Accepted! - DoorStep";
  const text = `Hi ${customerName},

Great news! Your booking for "${bookingDetails.serviceName}" on ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")} with ${providerDetails.name} has been accepted.

${providerDetails.location ? `Provider Location: ${providerDetails.location}` : ""}

We look forward to seeing you!

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Great news! Your booking for "<strong>${bookingDetails.serviceName}</strong>" on <strong>${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}</strong> with <strong>${providerDetails.name}</strong> has been accepted.</p>
${providerDetails.location ? `<p><strong>Provider Location:</strong> ${providerDetails.location}</p>` : ""}
<p>We look forward to seeing you!</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

export function getBookingRejectedEmailContent(
  customerName: string,
  bookingDetails: { serviceName: string; bookingDate: string | Date },
  rejectionReason?: string,
): MailOptions {
  const subject = "Your Booking Request Was Rejected - DoorStep";
  let reasonText = "";
  if (rejectionReason) {
    reasonText = `Reason for rejection: ${rejectionReason}`;
  }
  const text = `Hi ${customerName},

Unfortunately, your booking request for "${bookingDetails.serviceName}" on ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")} has been rejected.

${reasonText}

We apologize for any inconvenience.

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Unfortunately, your booking request for "<strong>${bookingDetails.serviceName}</strong>" on <strong>${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}</strong> has been rejected.</p>
${rejectionReason ? `<p><strong>Reason for rejection:</strong> ${rejectionReason}</p>` : ""}
<p>We apologize for any inconvenience.</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

export function getServicePaymentConfirmedCustomerEmailContent(
  customerName: string,
  bookingDetails: {
    bookingId: string;
    serviceName: string;
    bookingDate: string | Date;
  },
  paymentDetails: { amountPaid: number | string; paymentId: string },
): MailOptions {
  const subject = "Service Payment Confirmed - DoorStep";
  const text = `Hi ${customerName},

Your payment for the service booking has been confirmed.

Booking ID: ${bookingDetails.bookingId}
Service: ${bookingDetails.serviceName}
Date & Time: ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}
Amount Paid: ${paymentDetails.amountPaid}
Payment ID: ${paymentDetails.paymentId}

Thank you for using DoorStep!

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Your payment for the service booking has been confirmed.</p>
<p><strong>Booking Details:</strong></p>
<ul>
    <li><strong>Booking ID:</strong> ${bookingDetails.bookingId}</li>
    <li><strong>Service:</strong> ${bookingDetails.serviceName}</li>
    <li><strong>Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}</li>
</ul>
<p><strong>Payment Details:</strong></p>
<ul>
    <li><strong>Amount Paid:</strong> ${paymentDetails.amountPaid}</li>
    <li><strong>Payment ID:</strong> ${paymentDetails.paymentId}</li>
</ul>
<p>Thank you for using DoorStep!</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

export function getServiceProviderPaymentReceivedEmailContent(
  providerName: string,
  bookingDetails: {
    bookingId: string;
    serviceName: string;
    bookingDate: string | Date;
  },
  customerDetails: { name: string },
  paymentDetails: { amountReceived: number | string; paymentId: string },
): MailOptions {
  const subject = "Payment Received for Service - DoorStep";
  const text = `Hi ${providerName},

You have received a payment for a service booking.

Booking ID: ${bookingDetails.bookingId}
Service: ${bookingDetails.serviceName}
Date & Time: ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}
Customer Name: ${customerDetails.name}
Amount Received: ${paymentDetails.amountReceived}
Payment ID: ${paymentDetails.paymentId}

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${providerName},</p>
<p>You have received a payment for a service booking.</p>
<p><strong>Booking Details:</strong></p>
<ul>
    <li><strong>Booking ID:</strong> ${bookingDetails.bookingId}</li>
    <li><strong>Service:</strong> ${bookingDetails.serviceName}</li>
    <li><strong>Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), "datetime")}</li>
    <li><strong>Customer Name:</strong> ${customerDetails.name}</li>
</ul>
<p><strong>Payment Details:</strong></p>
<ul>
    <li><strong>Amount Received:</strong> ${paymentDetails.amountReceived}</li>
    <li><strong>Payment ID:</strong> ${paymentDetails.paymentId}</li>
</ul>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}

export function getGenericNotificationEmailContent(
  name: string,
  title: string,
  message: string,
): MailOptions {
  const subject = `DoorStep Notification: ${title}`;
  const text = `Hi ${name},

${message}

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${name},</p>
<p>${message}</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}
