const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT),
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const brandedEmail = (title, preheader, bodyHTML) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#F0F4F2;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F0F4F2;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr>
          <td style="background:#0B3D2E;padding:32px 40px;text-align:center;">
            <img src="${process.env.FRONTEND_URL}/Climatix_logo.png" alt="Climactix Global" style="height:48px;width:auto;filter:brightness(0) invert(1);" />
            <p style="color:rgba(255,255,255,0.7);font-size:12px;margin:8px 0 0;letter-spacing:1.5px;text-transform:uppercase;">ESG Intelligence Platform</p>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            ${bodyHTML}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#F8FAF9;border-top:1px solid #E5EDE8;padding:24px 40px;text-align:center;">
            <p style="color:#64748B;font-size:12px;margin:0;">© ${new Date().getFullYear()} Climactix Global · Media. Branding. Impact.</p>
            <p style="color:#94A3B8;font-size:11px;margin:6px 0 0;">If you didn't request this, you can safely ignore this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

exports.sendVerificationEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/verify-email.html?token=${token}`;
  const body = `
    <h2 style="color:#0B3D2E;font-size:24px;margin:0 0 8px;">Verify your email</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">Hi <strong>${user.fullName}</strong>, welcome to Climactix Global. Please verify your email address to activate your account.</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 32px;">
      <a href="${url}" style="display:inline-block;background:#0B3D2E;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Verify Email Address →</a>
    </td></tr></table>
    <p style="color:#94A3B8;font-size:13px;margin:0;">This link expires in <strong>24 hours</strong>. Or copy this URL:<br><span style="color:#0B3D2E;word-break:break-all;">${url}</span></p>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Verify your Climactix Global account',
    html: brandedEmail('Verify Email', 'Complete your registration', body)
  });
};

exports.sendPasswordResetEmail = async (user, token) => {
  const url = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
  const body = `
    <h2 style="color:#0B3D2E;font-size:24px;margin:0 0 8px;">Reset your password</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">Hi <strong>${user.fullName}</strong>, we received a request to reset your password. Click below to set a new one.</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 32px;">
      <a href="${url}" style="display:inline-block;background:#0B3D2E;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;">Reset Password →</a>
    </td></tr></table>
    <p style="color:#EF4444;font-size:13px;margin:0 0 12px;">⚠ This link expires in <strong>30 minutes</strong>.</p>
    <p style="color:#94A3B8;font-size:13px;margin:0;">If you didn't request this, your account is safe — no changes were made.</p>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Reset your Climactix Global password',
    html: brandedEmail('Password Reset', 'Reset your password', body)
  });
};

exports.sendWelcomeEmail = async (user) => {
  const body = `
    <h2 style="color:#0B3D2E;font-size:24px;margin:0 0 8px;">Welcome aboard, ${user.fullName}!</h2>
    <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 24px;">Your account is verified and ready. You can now access the full Climactix Global ESG Assessment platform.</p>
    <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 32px;">
      <a href="${process.env.FRONTEND_URL}/assessment.html" style="display:inline-block;background:#0B3D2E;color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;">Start Assessment →</a>
    </td></tr></table>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: 'Welcome to Climactix Global',
    html: brandedEmail('Welcome', 'Your account is active', body)
  });
};
