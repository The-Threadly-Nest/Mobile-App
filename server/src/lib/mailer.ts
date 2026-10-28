const RESEND_API_URL = "https://api.resend.com/emails";
const BRAND_NAME = "Owuja";

const getSender = () => process.env.EMAIL_FROM || `${BRAND_NAME} <heyowuja@owuja.com>`;
const getReplyTo = () => process.env.EMAIL_REPLY_TO || "support@owuja.com";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] || character);
}

async function sendEmail({ to, subject, text, html }: { to: string; subject: string; text: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw Object.assign(new Error("Transactional email is not configured."), { status: 503 });

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: getSender(), reply_to: getReplyTo(), to: [to], subject, text, html }),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { message?: string } | null;
    console.error(JSON.stringify({ event: "email_delivery_failed", provider: "resend", status: response.status }));
    throw Object.assign(new Error(result?.message || "Email delivery failed."), { status: 502 });
  }
}

function emailShell(content: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:460px;margin:0 auto;padding:24px;border:1px solid #4A080C;border-radius:12px;color:#3A2E1A;">
    <h1 style="font-size:22px;color:#4A080C;font-family:Georgia,serif;letter-spacing:1px;margin:0 0 20px;text-align:center;">OWUJA</h1>
    ${content}
    <p style="font-size:12px;color:#8A7550;text-align:center;margin:24px 0 0;">Need help? Reply to this email or contact support@owuja.com.</p>
  </div>`;
}

export async function sendWelcomeEmail(to: string, name: string, code?: string) {
  if (code) {
    return sendEmail({
      to,
      subject: `Verify your email – ${BRAND_NAME}`,
      text: `Hi ${name}, your 4-digit verification PIN is ${code}. It expires in 10 minutes.`,
      html: emailShell(`<p style="font-size:14px;text-align:center;">Hi ${escapeHtml(name)}, your 4-digit verification PIN is:</p>
        <div style="font-size:32px;font-weight:bold;color:#4A080C;margin:20px 0;letter-spacing:8px;font-family:monospace;text-align:center;">${escapeHtml(code)}</div>
        <p style="font-size:12px;color:#737373;text-align:center;">This PIN expires in 10 minutes.</p>`),
    });
  }
  return sendEmail({
    to,
    subject: `Welcome to ${BRAND_NAME}!`,
    text: `Hi ${name}, welcome to ${BRAND_NAME}. Your account has been created successfully.`,
    html: emailShell(`<p style="font-size:16px;">Welcome, <strong>${escapeHtml(name)}</strong>!</p>
      <p style="font-size:14px;line-height:1.5;">Your account is ready. Discover fashion houses, book custom design consultations, and track your bespoke orders.</p>`),
  });
}

export async function sendPasswordResetEmail(to: string, rawToken: string) {
  return sendEmail({
    to,
    subject: `Reset your password – ${BRAND_NAME}`,
    text: `Your 4-digit password-reset PIN is ${rawToken}. It expires in 10 minutes.`,
    html: emailShell(`<p style="font-size:14px;text-align:center;">We received a password-reset request. Your PIN is:</p>
      <div style="font-size:32px;font-weight:bold;color:#4A080C;margin:20px 0;letter-spacing:8px;font-family:monospace;text-align:center;">${escapeHtml(rawToken)}</div>
      <p style="font-size:12px;color:#737373;text-align:center;">This PIN expires in 10 minutes.</p>`),
  });
}

export async function sendStaffActivationEmail(to: string, name: string, fashionHouseName: string, rawToken: string) {
  const activateBase = process.env.APP_DEEP_LINK_BASE_ACTIVATE || "threadlynest://activate";
  const activateUrl = `${activateBase}?token=${encodeURIComponent(rawToken)}&email=${encodeURIComponent(to)}`;
  return sendEmail({
    to,
    subject: `You've been added to ${fashionHouseName}`,
    text: `Hi ${name}, you've been added as staff at ${fashionHouseName}. Your activation PIN is ${rawToken}. It expires in 10 minutes.`,
    html: emailShell(`<p>Hi ${escapeHtml(name)}, you've been added as staff at <strong>${escapeHtml(fashionHouseName)}</strong>.</p>
      <p style="text-align:center;">Your activation PIN is:</p>
      <div style="font-size:32px;font-weight:bold;color:#4A080C;margin:20px 0;letter-spacing:8px;font-family:monospace;text-align:center;">${escapeHtml(rawToken)}</div>
      <p style="text-align:center;"><a href="${escapeHtml(activateUrl)}" style="display:inline-block;padding:12px 28px;background:#4A080C;color:#FBF7EF;text-decoration:none;border-radius:999px;font-weight:bold;">Activate your account</a></p>`),
  });
}

export async function sendStaffInviteEmail({ to, name, fashionHouseName, tempPassword }: {
  to: string; name: string; fashionHouseName: string; tempPassword?: string;
}) {
  const credentials = tempPassword
    ? `<div style="background:#FBF7EF;border:1px solid #E4D5B7;padding:14px;border-radius:8px;margin:16px 0;"><p><strong>Email:</strong> ${escapeHtml(to)}</p><p><strong>Temporary password:</strong> ${escapeHtml(tempPassword)}</p></div>`
    : "";
  return sendEmail({
    to,
    subject: `You've been added to ${fashionHouseName} on ${BRAND_NAME}`,
    text: `Hi ${name}, you have been added as a staff member at ${fashionHouseName}. Open ${BRAND_NAME}, choose Log In, and use your staff email and temporary password.`,
    html: emailShell(`<p>Hi <strong>${escapeHtml(name)}</strong>,</p><p>You have been added as a staff member at <strong>${escapeHtml(fashionHouseName)}</strong>.</p>${credentials}
      <ol style="font-size:13px;line-height:1.7;padding-left:20px;"><li>Open <strong>${BRAND_NAME}</strong>.</li><li>Select <strong>Log In</strong>.</li><li>Enter your staff email and temporary password.</li><li>Set your new private password.</li></ol>`),
  });
}
