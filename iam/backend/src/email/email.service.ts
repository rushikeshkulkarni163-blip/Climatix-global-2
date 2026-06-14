import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private readonly config: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: config.get<string>('smtp.host'),
      port: config.get<number>('smtp.port'),
      secure: config.get<boolean>('smtp.secure'),
      auth: {
        user: config.get<string>('smtp.user'),
        pass: config.get<string>('smtp.pass'),
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });
  }

  private get from(): string {
    const name = this.config.get<string>('smtp.fromName');
    const email = this.config.get<string>('smtp.fromEmail');
    return `"${name}" <${email}>`;
  }

  async sendEmailVerification(to: string, verifyUrl: string): Promise<void> {
    await this.send(to, 'Verify your Climactix email address', this.emailVerificationHtml(verifyUrl));
  }

  async sendPasswordReset(to: string, resetUrl: string, firstName: string): Promise<void> {
    await this.send(to, 'Reset your Climactix password', this.passwordResetHtml(resetUrl, firstName));
  }

  async sendOtp(to: string, otp: string): Promise<void> {
    await this.send(to, `Your Climactix verification code: ${otp}`, this.otpHtml(otp));
  }

  async sendWelcome(to: string, firstName: string, orgName?: string): Promise<void> {
    await this.send(to, 'Welcome to Climactix Global', this.welcomeHtml(firstName, orgName));
  }

  async sendInvite(to: string, inviterName: string, orgName: string, acceptUrl: string): Promise<void> {
    await this.send(to, `You've been invited to ${orgName} on Climactix`, this.inviteHtml(inviterName, orgName, acceptUrl));
  }

  async sendSecurityAlert(to: string, event: string, ip: string, location?: string): Promise<void> {
    await this.send(to, 'Security alert — Climactix account', this.securityAlertHtml(event, ip, location));
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      this.logger.error(`Email failed to ${to}: ${err.message}`);
      // Never throw — email failure should not break the auth flow
    }
  }

  // ── HTML Templates ──────────────────────────────────────────────────────

  private baseHtml(content: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { background: #000; color: #e0e0e0; font-family: 'IBM Plex Mono', monospace; margin: 0; padding: 20px; }
    .container { max-width: 560px; margin: 40px auto; border: 1px solid #2C2C2C; background: #0A0A0A; padding: 40px; }
    .logo { color: #FF6600; font-size: 13px; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 32px; }
    .title { font-size: 16px; font-weight: 600; color: #fff; margin-bottom: 20px; letter-spacing: 0.05em; }
    .body { font-size: 13px; color: #999; line-height: 1.7; }
    .btn { display: inline-block; background: #FF6600; color: #000; padding: 12px 28px; text-decoration: none;
           font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; margin: 24px 0; }
    .code { background: #111; border: 1px solid #2C2C2C; padding: 16px 24px; font-size: 28px; font-weight: 700;
            letter-spacing: 0.3em; color: #FF6600; text-align: center; margin: 24px 0; }
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #1a1a1a; font-size: 11px; color: #444; }
    .divider { border: none; border-top: 1px solid #1a1a1a; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CLIMACTIX GLOBAL — INTELLIGENCE PLATFORM</div>
    ${content}
    <div class="footer">
      This email was sent by Climactix Global. If you did not request this, you can safely ignore it.<br>
      &copy; ${new Date().getFullYear()} Climactix Global. All rights reserved.
    </div>
  </div>
</body>
</html>`;
  }

  private emailVerificationHtml(verifyUrl: string): string {
    return this.baseHtml(`
      <div class="title">VERIFY YOUR EMAIL ADDRESS</div>
      <div class="body">
        <p>To complete your Climactix Global account setup, please verify your email address.</p>
        <p>This link expires in 24 hours.</p>
        <a href="${verifyUrl}" class="btn">Verify Email Address</a>
        <hr class="divider">
        <p style="font-size: 11px; color: #555;">Or paste this URL in your browser:<br>${verifyUrl}</p>
      </div>
    `);
  }

  private passwordResetHtml(resetUrl: string, firstName: string): string {
    return this.baseHtml(`
      <div class="title">PASSWORD RESET REQUEST</div>
      <div class="body">
        <p>Hello${firstName ? ` ${firstName}` : ''},</p>
        <p>A password reset was requested for your Climactix Global account. This link expires in 1 hour.</p>
        <p>If you did not request this, please ignore this email and your password will remain unchanged.</p>
        <a href="${resetUrl}" class="btn">Reset Password</a>
      </div>
    `);
  }

  private otpHtml(otp: string): string {
    return this.baseHtml(`
      <div class="title">YOUR VERIFICATION CODE</div>
      <div class="body">
        <p>Use the following code to complete verification. It expires in 10 minutes.</p>
        <div class="code">${otp}</div>
        <p>Do not share this code with anyone.</p>
      </div>
    `);
  }

  private welcomeHtml(firstName: string, orgName?: string): string {
    return this.baseHtml(`
      <div class="title">ACCESS GRANTED — CLIMACTIX GLOBAL</div>
      <div class="body">
        <p>Welcome, ${firstName}.</p>
        ${orgName ? `<p>Your organization <strong>${orgName}</strong> has been configured on the Climactix Global intelligence platform.</p>` : ''}
        <p>You now have access to institutional-grade climate risk intelligence, ESG analytics, and scenario simulation tools.</p>
        <a href="${this.config.get('app.url')}/dashboard" class="btn">Access Intelligence Platform</a>
      </div>
    `);
  }

  private inviteHtml(inviterName: string, orgName: string, acceptUrl: string): string {
    return this.baseHtml(`
      <div class="title">YOU HAVE BEEN INVITED TO ${orgName.toUpperCase()}</div>
      <div class="body">
        <p>${inviterName} has invited you to join ${orgName} on the Climactix Global Intelligence Platform.</p>
        <p>This invitation expires in 72 hours.</p>
        <a href="${acceptUrl}" class="btn">Accept Invitation</a>
      </div>
    `);
  }

  private securityAlertHtml(event: string, ip: string, location?: string): string {
    return this.baseHtml(`
      <div class="title" style="color: #FF6600;">SECURITY ALERT</div>
      <div class="body">
        <p>A security event was detected on your Climactix Global account.</p>
        <p><strong>Event:</strong> ${event}</p>
        <p><strong>IP Address:</strong> ${ip}</p>
        ${location ? `<p><strong>Location:</strong> ${location}</p>` : ''}
        <p>If this was not you, please reset your password immediately and contact support.</p>
        <a href="${this.config.get('app.url')}/auth/forgot-password" class="btn">Secure My Account</a>
      </div>
    `);
  }
}
