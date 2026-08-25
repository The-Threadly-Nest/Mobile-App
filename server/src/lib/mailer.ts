import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
});

export async function sendWelcomeEmail(to: string, name: string, code?: string) {
  if (code) {
    await transporter.sendMail({
      from: `"The Threadly Nest" <${process.env.GMAIL_USER}>`,
      to,
      subject: "Verify your email - The Threadly Nest",
      text: `Hi ${name}, your 4-digit PIN is: ${code}\n\nThis PIN expires in 10 minutes.`,
      html: `<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #4A080C; border-radius: 8px; text-align: center;">
        <h1 style="font-size: 18px; color:#4A080C; font-family: Georgia, serif; letter-spacing: 1px; margin-bottom: 20px;">THE THREADLY NEST</h1>
        <p style="font-size: 14px; color: #3A2E1A; line-height: 1.5; margin-bottom: 12px;">Hi ${name}, your 4-digit PIN is:</p>
        <div style="font-size: 32px; font-weight: bold; color: #4A080C; margin: 20px 0; letter-spacing: 8px; font-family: monospace;">${code}</div>
        <p style="font-size: 12px; color: #737373;">This PIN expires in 10 minutes.</p>
      </div>`,
    });
  } else {
    await transporter.sendMail({
      from: `"The Threadly Nest" <${process.env.GMAIL_USER}>`,
      to,
      subject: "Welcome to The Threadly Nest",
      text: `Hi ${name}, your account has been created. You can now log in with your email and password.`,
      html: `<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #4A080C; border-radius: 8px; text-align: center;">
        <h1 style="font-size: 18px; color:#4A080C; font-family: Georgia, serif; letter-spacing: 1px; margin-bottom: 20px;">THE THREADLY NEST</h1>
        <p style="font-size: 15px; color: #3A2E1A; line-height: 1.6; margin-bottom: 12px;">Hi <strong>${name}</strong>, welcome aboard!</p>
        <p style="font-size: 14px; color: #3A2E1A; line-height: 1.5;">Your account has been created. You can now log in with your email and password.</p>
      </div>`,
    });
  }
}


export async function sendPasswordResetEmail(to: string, rawToken: string) {
  await transporter.sendMail({
    from: `"The Threadly Nest" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Reset your password - The Threadly Nest",
    text: `Your 4-digit password reset PIN is: ${rawToken}\n\nThis PIN expires in 10 minutes.`,
    html: `<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #4A080C; border-radius: 8px; text-align: center;">
      <h1 style="font-size: 18px; color:#4A080C; font-family: Georgia, serif; letter-spacing: 1px; margin-bottom: 20px;">THE THREADLY NEST</h1>
      <p style="font-size: 14px; color: #3A2E1A; line-height: 1.5; margin-bottom: 12px;">We received a request to reset your password. Your 4-digit PIN is:</p>
      <div style="font-size: 32px; font-weight: bold; color: #4A080C; margin: 20px 0; letter-spacing: 8px; font-family: monospace;">${rawToken}</div>
      <p style="font-size: 12px; color: #737373;">This PIN expires in 10 minutes.</p>
    </div>`,
  });
}

export async function sendStaffActivationEmail(to: string, name: string, fashionHouseName: string, rawToken: string) {
  const activateUrl = `${process.env.APP_DEEP_LINK_BASE_ACTIVATE ?? "thethreadlynest://activate"}?token=${rawToken}&email=${encodeURIComponent(to)}`;
  await transporter.sendMail({
    from: `"The Threadly Nest" <${process.env.GMAIL_USER}>`,
    to,
    subject: `You've been added to ${fashionHouseName}`,
    text: `Hi ${name}, you've been added as staff at ${fashionHouseName}. Your activation code is: ${rawToken}\n\nThis code expires in 10 minutes. Alternatively, tap this link to activate: ${activateUrl}`,
    html: `<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #4A080C; border-radius: 8px; text-align: center;">
      <h1 style="font-size: 18px; color:#4A080C; font-family: Georgia, serif; letter-spacing: 1px; margin-bottom: 20px;">THE THREADLY NEST</h1>
      <p style="font-size: 14px; color: #3A2E1A; line-height: 1.5; margin-bottom: 12px;">Hi ${name}, you've been added as staff at <strong>${fashionHouseName}</strong>.</p>
      <p style="font-size: 14px; color: #3A2E1A; margin-bottom: 12px;">Your 4-character activation code is:</p>
      <div style="font-size: 32px; font-weight: bold; color: #4A080C; margin: 20px 0; letter-spacing: 8px; font-family: monospace;">${rawToken}</div>
      <p style="font-size: 12px; color: #737373; margin-bottom: 24px;">This code expires in 10 minutes.</p>
      <a href="${activateUrl}" style="display: inline-block; padding: 12px 28px; background: #4A080C; color: #FBF7EF; text-decoration: none; border-radius: 999px; font-weight: bold; font-size: 14px;">Activate Your Account</a>
    </div>`,
  });
}
