import { Router } from "express";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import { prisma } from "../lib/prisma";
import { validate } from "../middleware/validate";
import { signupSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, activateAccountSchema } from "../schemas/auth.schema";
import { hashPassword, verifyPassword, generateResetToken, hashResetToken } from "../lib/password";
import { sendPasswordResetEmail, sendWelcomeEmail } from "../lib/mailer";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });

function issueToken(userId: string, email: string, role: string) {
  if (!JWT_SECRET) throw Object.assign(new Error("Server misconfiguration"), { status: 500 });
  return jwt.sign({ sub: userId, email, role }, JWT_SECRET, { expiresIn: "7d" });
}

// Only Admin and Customer self-register. Staff accounts are created
// exclusively by an Admin via POST /api/staff/invite.
router.post("/signup", authLimiter, validate({ body: signupSchema }), async (req, res, next) => {
  try {
    const { email, password, role, name, businessName } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "An account with this email already exists. Please log in instead." });

    const passwordHash = await hashPassword(password);
    const isAdmin = role === "admin";
    const code = isAdmin ? generateResetToken() : undefined;
    const resetTokenHash = code ? hashResetToken(code) : null;
    const resetTokenExpiresAt = code ? new Date(Date.now() + 10 * 60 * 1000) : null;

    const user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          name,
          role,
          active: true,
          resetTokenHash,
          resetTokenExpiresAt,
        },
      });
      if (role === "admin") {
        await tx.fashionHouse.create({ data: { adminId: newUser.id, shopName: businessName || name } });
      }
      return newUser;
    });

    await sendWelcomeEmail(email, name, code).catch(() => {});
    const token = issueToken(user.id, user.email, user.role);

    let shopName: string | null = null;
    let onboardingCompleted = false;
    if (user.role === "admin") {
      const fh = await prisma.fashionHouse.findUnique({ where: { adminId: user.id } });
      if (fh) {
        if (fh.shopName) shopName = fh.shopName;
        onboardingCompleted = fh.onboardingCompleted ?? false;
      }
    }

    res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? "",
        shopName,
        isVerified: user.resetTokenHash === null,
        onboardingCompleted,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Same error message for "no such user" and "wrong password" — prevents
// email enumeration.
router.post("/login", authLimiter, validate({ body: loginSchema }), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: "Incorrect email or password." });
    if (!user.active) return res.status(403).json({ error: "This account hasn't been activated yet. Check your email for the activation link." });

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Incorrect email or password." });

    const token = issueToken(user.id, user.email, user.role);

    let shopName: string | null = null;
    let onboardingCompleted = false;
    if (user.role === "admin") {
      const fh = await prisma.fashionHouse.findUnique({ where: { adminId: user.id } });
      if (fh) {
        if (fh.shopName) shopName = fh.shopName;
        onboardingCompleted = fh.onboardingCompleted ?? false;
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? "",
        shopName,
        isVerified: user.resetTokenHash === null,
        onboardingCompleted,
        createdAt: user.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Always returns the same response regardless of whether the email
// exists — standard defense against email enumeration.
router.post("/forgot-password", authLimiter, validate({ body: forgotPasswordSchema }), async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (user) {
      const rawToken = generateResetToken();
      const resetTokenHash = hashResetToken(rawToken);
      const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash, resetTokenExpiresAt } });
      console.log(`[AUTH] Reset PIN generated for ${normalizedEmail}: ${rawToken}`);
      try {
        await sendPasswordResetEmail(normalizedEmail, rawToken);
      } catch (mailErr) {
        console.error("Failed to send password reset email:", mailErr);
      }
    }
    res.json({ message: "If an account exists for this email, a reset link has been sent." });
  } catch (err) {
    next(err);
  }
});

router.post("/reset-password", authLimiter, validate({ body: resetPasswordSchema }), async (req, res, next) => {
  try {
    const normalizedEmail = req.body.email.toLowerCase().trim();
    const normalizedToken = req.body.token.trim().toUpperCase();
    const { newPassword } = req.body;

    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired code." });
    }
    if (user.resetTokenExpiresAt < new Date()) {
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: null, resetTokenExpiresAt: null } });
      return res.status(400).json({ error: "This code has expired. Request a new one." });
    }
    if (hashResetToken(normalizedToken) !== user.resetTokenHash) {
      return res.status(400).json({ error: "Invalid or expired code." });
    }

    const newPasswordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: newPasswordHash, resetTokenHash: null, resetTokenExpiresAt: null } });
    res.json({ message: "Password updated. You can now log in with your new password." });
  } catch (err) {
    next(err);
  }
});

// Used only by Staff accounts created via /api/staff/invite. Same
// pattern as reset-password, but refuses to run if passwordHash already
// exists, so a stale token can never hijack an already-active account.
router.post("/activate-account", authLimiter, validate({ body: activateAccountSchema }), async (req, res, next) => {
  try {
    const { email, token, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired code." });
    }
    if (user.passwordHash) return res.status(400).json({ error: "This account has already been activated." });
    if (user.resetTokenExpiresAt < new Date()) {
      await prisma.user.update({ where: { id: user.id }, data: { resetTokenHash: null, resetTokenExpiresAt: null } });
      return res.status(400).json({ error: "This activation code has expired. Ask your Admin to resend it." });
    }
    if (hashResetToken(token) !== user.resetTokenHash) {
      return res.status(400).json({ error: "Invalid or expired code." });
    }

    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash, active: true, resetTokenHash: null, resetTokenExpiresAt: null } });

    const jwtToken = issueToken(user.id, user.email, user.role);
    res.json({ token: jwtToken, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
});

router.post("/verify-code", authLimiter, async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code are required." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.resetTokenHash || !user.resetTokenExpiresAt) {
      return res.status(400).json({ error: "Invalid or expired code." });
    }
    if (user.resetTokenExpiresAt < new Date()) {
      return res.status(400).json({ error: "This code has expired. Please request a new one." });
    }
    if (hashResetToken(code) !== user.resetTokenHash) {
      return res.status(400).json({ error: "Incorrect verification code." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: null, resetTokenExpiresAt: null },
    });

    res.json({ message: "Verification successful." });
  } catch (err) {
    next(err);
  }
});

router.post("/resend-code", authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required." });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: "If an account exists, a new code has been sent." });
    }

    const code = generateResetToken();
    const resetTokenHash = hashResetToken(code);
    const resetTokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash, resetTokenExpiresAt },
    });

    await sendWelcomeEmail(user.email, user.email.split("@")[0], code).catch(() => {});
    res.json({ message: "A new code has been sent." });
  } catch (err) {
    next(err);
  }
});

router.post("/google", authLimiter, async (req, res, next) => {
  try {
    const { idToken, role } = req.body;
    if (!idToken) return res.status(400).json({ error: "ID token is required." });

    // Restrict self-registration to customer or admin only (staff are invited by admins)
    const safeRole: "admin" | "customer" = role === "admin" ? "admin" : "customer";

    // Verify token with Google and check audience matches THIS app's client ID
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ error: "Server misconfiguration: missing GOOGLE_CLIENT_ID." });
    }
    let googleId: string;
    let email: string;
    let name: string | undefined;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload) throw new Error("Empty payload");
      googleId = payload.sub;
      email = payload.email!;
      name = payload.name;
    } catch {
      return res.status(401).json({ error: "Invalid or expired Google token." });
    }

    if (!email) return res.status(400).json({ error: "Google account did not provide an email address." });

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
      include: { fashionHouseOwned: true },
    });

    if (!user) {
      // Create new user with selected role
      const createdUserId = await prisma.$transaction(async (tx) => {
        const newUser = await tx.user.create({
          data: {
            email,
            googleId,
            name: name ?? "",
            role: safeRole,
            active: true,
          },
        });

        if (safeRole === "admin") {
          await tx.fashionHouse.create({
            data: { adminId: newUser.id, shopName: name || "My Fashion House", onboardingCompleted: false },
          });
        }
        return newUser.id;
      });

      user = (await prisma.user.findUnique({
        where: { id: createdUserId },
        include: { fashionHouseOwned: true },
      }))!;
    } else if (!user.googleId) {
      // Link Google ID to existing email account
      user = await prisma.user.update({
        where: { id: user.id },
        data: { googleId },
        include: { fashionHouseOwned: true },
      });
    }

    const onboardingCompleted = user.fashionHouseOwned?.onboardingCompleted ?? false;
    const token = issueToken(user.id, user.email, user.role);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name ?? "",
        shopName: user.fashionHouseOwned?.shopName ?? "",
        onboardingCompleted,
        isVerified: true,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
