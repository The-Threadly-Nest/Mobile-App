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
      subject: "Welcome to The Threadly Nest!",
      text: `Hi ${name}, welcome aboard! Your account has been created successfully. You can now explore fashion houses, book design consultations, and track your bespoke orders.`,
      html: `<div style="font-family: sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #4A080C; border-radius: 8px; text-align: center;">
        <h1 style="font-size: 18px; color:#4A080C; font-family: Georgia, serif; letter-spacing: 1px; margin-bottom: 20px;">THE THREADLY NEST</h1>
        <p style="font-size: 16px; color: #3A2E1A; line-height: 1.6; margin-bottom: 12px;">Welcome aboard, <strong>${name}</strong>!</p>
        <p style="font-size: 14px; color: #3A2E1A; line-height: 1.5;">Your account is ready. Discover top fashion houses, book custom design consultations, and track your bespoke orders seamlessly.</p>
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
      <p style="font-size: 14px; color: #3A2E1A; margin-bottom: 12px;">Your 4-digit activation PIN is:</p>
      <div style="font-size: 32px; font-weight: bold; color: #4A080C; margin: 20px 0; letter-spacing: 8px; font-family: monospace;">${rawToken}</div>
      <p style="font-size: 12px; color: #737373; margin-bottom: 24px;">This code expires in 10 minutes.</p>
      <a href="${activateUrl}" style="display: inline-block; padding: 12px 28px; background: #4A080C; color: #FBF7EF; text-decoration: none; border-radius: 999px; font-weight: bold; font-size: 14px;">Activate Your Account</a>
    </div>`,
  });
}

export async function sendStaffInviteEmail({
  to,
  name,
  fashionHouseName,
  tempPassword,
}: {
  to: string;
  name: string;
  fashionHouseName: string;
  tempPassword?: string;
}) {
  const passwordSection = tempPassword
    ? `<div style="background: #FBF7EF; border: 1px solid #E4D5B7; padding: 14px; border-radius: 8px; margin: 16px 0; text-align: left;">
        <p style="margin: 0 0 6px 0; font-size: 13px; color: #4A080C; font-weight: bold;">Your Temporary Log In Credentials:</p>
        <p style="margin: 0 0 4px 0; font-size: 13px; color: #3A2E1A;"><strong>Email:</strong> ${to}</p>
        <p style="margin: 0; font-size: 13px; color: #3A2E1A;"><strong>Temporary Password:</strong> ${tempPassword}</p>
      </div>`
    : "";

  await transporter.sendMail({
    from: `"The Threadly Nest" <${process.env.GMAIL_USER}>`,
    to,
    subject: `You've been added to ${fashionHouseName} on The Threadly Nest`,
    text: `Hi ${name},\n\nYou have been added as a staff member at ${fashionHouseName}.\n\nSteps to log in:\n1. Open The Threadly Nest app.\n2. Select Staff Login.\n3. Log in with your email (${to}) and temporary password (${tempPassword || "provided by admin"}).\n4. Complete onboarding and set your new private password.`,
    html: `<div style="font-family: sans-serif; max-width: 460px; margin: 0 auto; padding: 24px; border: 1px solid #4A080C; border-radius: 12px; text-align: left;">
      <h1 style="font-size: 18px; color: #4A080C; font-family: Georgia, serif; letter-spacing: 1px; margin-bottom: 20px; text-align: center;">THE THREADLY NEST</h1>
      <p style="font-size: 15px; color: #3A2E1A; line-height: 1.5; margin-bottom: 12px;">Hi <strong>${name}</strong>,</p>
      <p style="font-size: 14px; color: #3A2E1A; line-height: 1.5;">You have been added as a staff member at <strong>${fashionHouseName}</strong>.</p>
      
      ${passwordSection}

      <p style="font-size: 14px; font-weight: bold; color: #4A080C; margin-top: 20px; margin-bottom: 8px;">Steps to Log In & Get Started:</p>
      <ol style="font-size: 13px; color: #3A2E1A; line-height: 1.6; padding-left: 20px; margin-bottom: 20px;">
        <li style="margin-bottom: 6px;">Open <strong>The Threadly Nest</strong> app on your device.</li>
        <li style="margin-bottom: 6px;">Select <strong>Log In</strong> and enter your staff email.</li>
        <li style="margin-bottom: 6px;">Enter your temporary password listed above.</li>
        <li style="margin-bottom: 6px;">Explore staff onboarding and set your personal private password.</li>
      </ol>

      <p style="font-size: 12px; color: #8A7550; text-align: center; margin-top: 24px;">Welcome to the team!</p>
    </div>`,
  });
}
