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

export function getOrderConfirmationEmailContent(name: string, orderDetails: any, forShopOwner: boolean = false): MailOptions {
  const subject = forShopOwner ? 'New Order Received!' : 'Your IndianBudgetTracker Order Confirmation';
  // Customize orderDetails formatting as needed
  const orderDetailsText = JSON.stringify(orderDetails, null, 2);
  const text = `Hi ${name},

${forShopOwner ? 'A new order has been placed through your shop.' : 'Thank you for your order on IndianBudgetTracker!'}

Order Details:
${orderDetailsText}

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>${forShopOwner ? 'A new order has been placed through your shop.' : 'Thank you for your order on IndianBudgetTracker!'}</p>
<p><strong>Order Details:</strong></p><pre>${orderDetailsText}</pre>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getBookingConfirmationEmailContent(name: string, bookingDetails: any, forProvider: boolean = false): MailOptions {
  const subject = forProvider ? 'New Booking Request!' : 'Your IndianBudgetTracker Booking Confirmation';
  const bookingDetailsText = JSON.stringify(bookingDetails, null, 2);
  const text = `Hi ${name},

${forProvider ? 'You have a new booking request.' : 'Your booking on IndianBudgetTracker has been confirmed!'}

Booking Details:
${bookingDetailsText}

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>${forProvider ? 'You have a new booking request.' : 'Your booking on IndianBudgetTracker has been confirmed!'}</p>
<p><strong>Booking Details:</strong></p><pre>${bookingDetailsText}</pre>
<p>Thanks,<br/>The IndianBudgetTracker Team</p>`;
  return { subject, text, html, to: '' };
}

export function getBookingUpdateEmailContent(name: string, bookingDetails: any, oldStatus: string, newStatus: string, forProvider: boolean = false): MailOptions {
  const subject = forProvider ? `Booking Update Notification (ID: ${bookingDetails.id})` : `Your IndianBudgetTracker Booking Has Been Updated (ID: ${bookingDetails.id})`;
  const bookingDetailsText = JSON.stringify(bookingDetails, null, 2);
  const text = `Hi ${name},

${forProvider ? 'A booking has been updated.' : 'There has been an update to your booking on IndianBudgetTracker.'}

Booking ID: ${bookingDetails.id}
Previous Status: ${oldStatus}
New Status: ${newStatus}

Booking Details:
${bookingDetailsText}

Thanks,
The IndianBudgetTracker Team`;
  const html = `<p>Hi ${name},</p>
<p>${forProvider ? 'A booking has been updated.' : 'There has been an update to your booking on IndianBudgetTracker.'}</p>
<p><strong>Booking ID:</strong> ${bookingDetails.id}</p>
<p><strong>Previous Status:</strong> ${oldStatus}</p>
<p><strong>New Status:</strong> ${newStatus}</p>
<p><strong>Booking Details:</strong></p><pre>${bookingDetailsText}</pre>
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