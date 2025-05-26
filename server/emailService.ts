import { google } from 'googleapis';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';

const GMAIL_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GMAIL_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
const EMAIL_SENDER = process.env.EMAIL_SENDER;

if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !EMAIL_SENDER) {
  console.error('Missing Gmail API credentials or sender email in environment variables. Email functionality will be disabled.');
  // Optionally, throw an error to prevent the application from starting without email capabilities
  // throw new Error('Missing Gmail API credentials or sender email.');
}

const oauth2Client = new OAuth2Client(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  'urn:ietf:wg:oauth:2.0:oob' // Or your redirect URI if applicable for obtaining the refresh token
);

if (GMAIL_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
}

async function createTransporter() {
  if (!GMAIL_REFRESH_TOKEN) {
    console.warn('Gmail refresh token is not set. Email sending will likely fail.');
    // Fallback or throw error if you don't want to proceed without a refresh token
    return null;
  }

  try {
    const accessTokenResponse = await oauth2Client.getAccessToken();
    const accessToken = accessTokenResponse.token;

    if (!accessToken) {
      throw new Error('Failed to retrieve access token for Gmail.');
    }

    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: EMAIL_SENDER,
        clientId: GMAIL_CLIENT_ID,
        clientSecret: GMAIL_CLIENT_SECRET,
        refreshToken: GMAIL_REFRESH_TOKEN,
        accessToken: accessToken,
      },
    });
  } catch (error) {
    console.error('Error creating Nodemailer transporter:', error);
    return null;
  }
}

interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendEmail(mailOptions: MailOptions): Promise<boolean> {
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN || !EMAIL_SENDER) {
    console.error('Cannot send email due to missing Gmail API credentials or sender email.');
    return false;
  }

  const transporter = await createTransporter();
  if (!transporter) {
    console.error('Failed to create email transporter. Email not sent.');
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"IndianBudgetTracker" <${EMAIL_SENDER}>`,
      ...mailOptions,
    });
    console.log(`Email sent to ${mailOptions.to} with subject "${mailOptions.subject}"`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

// --- Template Functions --- //

export function getWelcomeEmailContent(name: string, verificationLink?: string): MailOptions {
  const subject = 'Welcome to IndianBudgetTracker!';
  const text = `Hi ${name},

Welcome to IndianBudgetTracker! We're excited to have you on board.

${verificationLink ? `Please verify your email address by clicking this link: ${verificationLink}

` : ''}Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>Welcome to IndianBudgetTracker! We're excited to have you on board.</p>
${verificationLink ? `<p>Please verify your email address by clicking this link: <a href="${verificationLink}">${verificationLink}</a></p>` : ''}
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' }; // 'to' will be set by the caller
}

export function getPasswordResetEmailContent(name: string, resetLink: string): MailOptions {
  const subject = 'Password Reset Request for IndianBudgetTracker';
  const text = `Hi ${name},

You requested a password reset for your IndianBudgetTracker account.
Click this link to reset your password: ${resetLink}

If you didn't request this, please ignore this email.

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>You requested a password reset for your IndianBudgetTracker account.</p>
<p>Click this link to reset your password: <a href="${resetLink}">${resetLink}</a></p>
<p>If you didn't request this, please ignore this email.</p>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

import { formatIndianDisplay } from '@shared/date-utils'; // Import IST utility

export function getOrderConfirmationEmailContent(name: string, orderDetails: any, forShopOwner: boolean = false): MailOptions {
  const subject = forShopOwner ? 'New Order Received!' : 'Your IndianBudgetTracker Order Confirmation';
  // Improved HTML formatting for order details
  let orderDetailsHtml = '<ul>';
  for (const key in orderDetails) {
    if (Object.prototype.hasOwnProperty.call(orderDetails, key)) {
      const value = key.toLowerCase().includes('date') && orderDetails[key] 
                    ? formatIndianDisplay(new Date(orderDetails[key]), 'datetime') 
                    : orderDetails[key];
      orderDetailsHtml += `<li><strong>${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:</strong> ${value}</li>`;
    }
  }
  orderDetailsHtml += '</ul>';

  const text = `Hi ${name},

${forShopOwner ? 'A new order has been placed through your shop.' : 'Thank you for your order on IndianBudgetTracker!'}

Order Details:
${JSON.stringify(orderDetails, null, 2)}

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>${forShopOwner ? 'A new order has been placed through your shop.' : 'Thank you for your order on IndianBudgetTracker!'}</p>
<p><strong>Order Details:</strong></p>${orderDetailsHtml}
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

// This function is now primarily for the provider's "New Booking Request"
export function getBookingConfirmationEmailContent(providerName: string, bookingDetails: { bookingId: string; customerName: string; serviceName: string; bookingDate: string | Date; }): MailOptions {
  const subject = 'New Booking Request!';
  const text = `Hi ${providerName},

You have a new booking request for your service: ${bookingDetails.serviceName}.

Booking Details:
- Booking ID: ${bookingDetails.bookingId}
- Customer Name: ${bookingDetails.customerName}
- Service: ${bookingDetails.serviceName}
- Requested Date & Time: ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}

Please review and respond to this request in your dashboard.

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${providerName},</p>
<p>You have a new booking request for your service: <strong>${bookingDetails.serviceName}</strong>.</p>
<p><strong>Booking Details:</strong></p>
<ul>
    <li><strong>Booking ID:</strong> ${bookingDetails.bookingId}</li>
    <li><strong>Customer Name:</strong> ${bookingDetails.customerName}</li>
    <li><strong>Service:</strong> ${bookingDetails.serviceName}</li>
    <li><strong>Requested Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}</li>
</ul>
<p>Please review and respond to this request in your dashboard.</p>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getBookingUpdateEmailContent(name: string, bookingDetails: { id: string; serviceName?: string; bookingDate?: string | Date }, oldStatus: string, newStatus: string, forProvider: boolean = false): MailOptions {
  const subject = forProvider ? `Booking Update Notification (ID: ${bookingDetails.id})` : `Your IndianBudgetTracker Booking Has Been Updated (ID: ${bookingDetails.id})`;
  let bookingDetailsHtml = '<ul>';
  bookingDetailsHtml += `<li><strong>Booking ID:</strong> ${bookingDetails.id}</li>`;
  if (bookingDetails.serviceName) {
    bookingDetailsHtml += `<li><strong>Service:</strong> ${bookingDetails.serviceName}</li>`;
  }
  if (bookingDetails.bookingDate) {
    bookingDetailsHtml += `<li><strong>Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}</li>`;
  }
  bookingDetailsHtml += '</ul>';

  const text = `Hi ${name},

${forProvider ? 'A booking has been updated.' : 'There has been an update to your booking on IndianBudgetTracker.'}

Booking ID: ${bookingDetails.id}
Previous Status: ${oldStatus}
New Status: ${newStatus}

Booking Details:
${JSON.stringify(bookingDetails, null, 2)}

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>${forProvider ? 'A booking has been updated.' : 'There has been an update to your booking on IndianBudgetTracker.'}</p>
<p><strong>Booking ID:</strong> ${bookingDetails.id}</p>
<p><strong>Previous Status:</strong> ${oldStatus}</p>
<p><strong>New Status:</strong> ${newStatus}</p>
<p><strong>Booking Details:</strong></p>${bookingDetailsHtml}
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}


// --- New Email Template Functions --- //

export function getBookingRequestPendingEmailContent(customerName: string, bookingDetails: { serviceName: string; bookingDate: string | Date; }): MailOptions {
  const subject = 'Your Booking Request is Pending - IndianBudgetTracker';
  const text = `Hi ${customerName},

Your request for the service "${bookingDetails.serviceName}" on ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')} has been sent to the provider.

We will notify you once the provider responds.

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Your request for the service "<strong>${bookingDetails.serviceName}</strong>" on <strong>${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}</strong> has been sent to the provider.</p>
<p>We will notify you once the provider responds.</p>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getBookingAcceptedEmailContent(customerName: string, bookingDetails: { serviceName: string; bookingDate: string | Date; }, providerDetails: { name: string; location?: string }): MailOptions {
  const subject = 'Your Booking Has Been Accepted! - IndianBudgetTracker';
  const text = `Hi ${customerName},

Great news! Your booking for "${bookingDetails.serviceName}" on ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')} with ${providerDetails.name} has been accepted.

${providerDetails.location ? `Provider Location: ${providerDetails.location}` : ''}

We look forward to seeing you!

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Great news! Your booking for "<strong>${bookingDetails.serviceName}</strong>" on <strong>${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}</strong> with <strong>${providerDetails.name}</strong> has been accepted.</p>
${providerDetails.location ? `<p><strong>Provider Location:</strong> ${providerDetails.location}</p>` : ''}
<p>We look forward to seeing you!</p>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getBookingRejectedEmailContent(customerName: string, bookingDetails: { serviceName: string; bookingDate: string | Date; }, rejectionReason?: string): MailOptions {
  const subject = 'Your Booking Request Was Rejected - IndianBudgetTracker';
  let reasonText = '';
  if (rejectionReason) {
    reasonText = `Reason for rejection: ${rejectionReason}`;
  }
  const text = `Hi ${customerName},

Unfortunately, your booking request for "${bookingDetails.serviceName}" on ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')} has been rejected.

${reasonText}

We apologize for any inconvenience.

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Unfortunately, your booking request for "<strong>${bookingDetails.serviceName}</strong>" on <strong>${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}</strong> has been rejected.</p>
${rejectionReason ? `<p><strong>Reason for rejection:</strong> ${rejectionReason}</p>` : ''}
<p>We apologize for any inconvenience.</p>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getServicePaymentConfirmedCustomerEmailContent(customerName: string, bookingDetails: { bookingId: string; serviceName: string; bookingDate: string | Date; }, paymentDetails: { amountPaid: number | string; paymentId: string; }): MailOptions {
  const subject = 'Service Payment Confirmed - IndianBudgetTracker';
  const text = `Hi ${customerName},

Your payment for the service booking has been confirmed.

Booking ID: ${bookingDetails.bookingId}
Service: ${bookingDetails.serviceName}
Date & Time: ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}
Amount Paid: ${paymentDetails.amountPaid}
Payment ID: ${paymentDetails.paymentId}

Thank you for using IndianBudgetTracker!

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${customerName},</p>
<p>Your payment for the service booking has been confirmed.</p>
<p><strong>Booking Details:</strong></p>
<ul>
    <li><strong>Booking ID:</strong> ${bookingDetails.bookingId}</li>
    <li><strong>Service:</strong> ${bookingDetails.serviceName}</li>
    <li><strong>Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}</li>
</ul>
<p><strong>Payment Details:</strong></p>
<ul>
    <li><strong>Amount Paid:</strong> ${paymentDetails.amountPaid}</li>
    <li><strong>Payment ID:</strong> ${paymentDetails.paymentId}</li>
</ul>
<p>Thank you for using IndianBudgetTracker!</p>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getServiceProviderPaymentReceivedEmailContent(providerName: string, bookingDetails: { bookingId: string; serviceName: string; bookingDate: string | Date; }, customerDetails: { name: string; }, paymentDetails: { amountReceived: number | string; paymentId: string; }): MailOptions {
  const subject = 'Payment Received for Service - IndianBudgetTracker';
  const text = `Hi ${providerName},

You have received a payment for a service booking.

Booking ID: ${bookingDetails.bookingId}
Service: ${bookingDetails.serviceName}
Date & Time: ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}
Customer Name: ${customerDetails.name}
Amount Received: ${paymentDetails.amountReceived}
Payment ID: ${paymentDetails.paymentId}

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${providerName},</p>
<p>You have received a payment for a service booking.</p>
<p><strong>Booking Details:</strong></p>
<ul>
    <li><strong>Booking ID:</strong> ${bookingDetails.bookingId}</li>
    <li><strong>Service:</strong> ${bookingDetails.serviceName}</li>
    <li><strong>Date & Time:</strong> ${formatIndianDisplay(new Date(bookingDetails.bookingDate), 'datetime')}</li>
    <li><strong>Customer Name:</strong> ${customerDetails.name}</li>
</ul>
<p><strong>Payment Details:</strong></p>
<ul>
    <li><strong>Amount Received:</strong> ${paymentDetails.amountReceived}</li>
    <li><strong>Payment ID:</strong> ${paymentDetails.paymentId}</li>
</ul>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getGenericNotificationEmailContent(name: string, title: string, message: string): MailOptions {
  const subject = `IndianBudgetTracker Notification: ${title}`;
  const text = `Hi ${name},

${message}

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>${message}</p>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}