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
}

const oauth2Client = new OAuth2Client(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  "urn:ietf:wg:oauth:2.0:oob",
);

if (GMAIL_REFRESH_TOKEN) {
  oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
}

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

async function createTransporter() {
  if (!GMAIL_REFRESH_TOKEN) {
    logger.warn(
      "Gmail refresh token is not set. Email sending will likely fail.",
    );
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
  } catch (error) {
    logger.error("Error sending email:", error);
  }
}

function enqueueEmail(mailOptions: MailOptions): boolean {
  addJob(() => sendEmailNow(mailOptions));
  return true;
}

export async function sendEmail(mailOptions: MailOptions): Promise<boolean> {
  return enqueueEmail(mailOptions);
}

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
  return { subject, text, html, to: "" };
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

export function getMagicLinkEmailContent(
  name: string,
  magicLink: string,
): MailOptions {
  const subject = "Your DoorStep magic link";
  const text = `Hi ${name},

Click the link below to securely sign in to DoorStep:
${magicLink}

This link expires in 15 minutes. If you did not request it, you can safely ignore this email.

Thanks,
The DoorStep Team`;
  const html = `<p>Hi ${name},</p>
<p>Click the link below to securely sign in to DoorStep:</p>
<p><a href="${magicLink}">${magicLink}</a></p>
<p>This link expires in 15 minutes. If you did not request it, you can safely ignore this email.</p>
<p>Thanks,<br/>The DoorStep Team</p>`;
  return { subject, text, html, to: "" };
}
