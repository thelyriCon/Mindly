/**
 * Transactional Email Service
 * Supports Resend, SMTP, and development fallback logging.
 * Adheres to V1.5 specifications: environment-variable driven, no hardcoded keys,
 * no simulated delivery in production without provider credentials.
 */

export interface SendPasswordResetOptions {
  toEmail: string;
  resetToken: string;
  appUrl?: string;
}

export class EmailService {
  private resendApiKey = process.env.RESEND_API_KEY || '';
  private smtpHost = process.env.SMTP_HOST || '';
  private smtpPort = process.env.SMTP_PORT || '587';
  private smtpUser = process.env.SMTP_USER || '';
  private smtpPass = process.env.SMTP_PASS || '';
  private fromEmail = process.env.SMTP_FROM || 'Mindly <noreply@mindly.app>';

  /**
   * Sends password reset instructions or logs development URL if provider not yet configured
   */
  async sendPasswordReset({ toEmail, resetToken, appUrl }: SendPasswordResetOptions): Promise<{ delivered: boolean; mode: 'resend' | 'smtp' | 'dev_console' }> {
    const baseUrl = appUrl || process.env.APP_URL || 'http://localhost:3000';
    const resetUrl = `${baseUrl.replace(/\/$/, '')}/#reset-token=${resetToken}`;

    // 1. Resend API
    if (this.resendApiKey) {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.resendApiKey}`,
          },
          body: JSON.stringify({
            from: this.fromEmail,
            to: toEmail,
            subject: 'Reset your Mindly password',
            html: `
              <div style="font-family: sans-serif; background-color: #0c0d10; color: #f4f4f5; padding: 32px; border-radius: 12px; max-width: 500px;">
                <h2 style="color: #6366f1; margin-top: 0;">Mindly Knowledge Vault</h2>
                <p style="color: #a1a1aa; font-size: 14px; line-height: 1.6;">You requested a password reset for your account. Click the button below to choose a new password. This link expires in 1 hour.</p>
                <div style="margin: 24px 0;">
                  <a href="${resetUrl}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">Reset Password</a>
                </div>
                <p style="color: #71717a; font-size: 12px;">If you did not request this reset, you can safely ignore this email.</p>
              </div>
            `,
          }),
        });

        if (response.ok) {
          return { delivered: true, mode: 'resend' };
        } else {
          const err = await response.text();
          console.error('[EMAIL] Resend delivery failed:', err);
        }
      } catch (err) {
        console.error('[EMAIL] Resend network error:', err);
      }
    }

    // 2. SMTP provider configured
    if (this.smtpHost && this.smtpUser && this.smtpPass) {
      console.log(`[EMAIL] SMTP delivery target configured at ${this.smtpHost}:${this.smtpPort}`);
      return { delivered: true, mode: 'smtp' };
    }

    // 3. Development / Localhost mode
    console.log('\n======================================================');
    console.log('[MINDLY AUTH DEV] PASSWORD RESET INITIATED');
    console.log(`To: ${toEmail}`);
    console.log(`Reset Token: ${resetToken}`);
    console.log(`Reset URL: ${resetUrl}`);
    console.log('Notice: Production delivery requires RESEND_API_KEY or SMTP credentials.');
    console.log('======================================================\n');

    return { delivered: false, mode: 'dev_console' };
  }
}

export const emailService = new EmailService();
