import crypto from 'node:crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

import { prisma } from './prisma';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'STAFF';

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

type TokenPayload = PublicUser & { iat: number };

const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
  'wilsonnyaanga2@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD?.trim() ||
  '38895790@WO';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME?.trim() || 'Wilson Nyaanga';
const AUTH_SECRET = process.env.AUTH_SECRET?.trim() || crypto
  .createHash('sha256')
  .update(`${SUPER_ADMIN_EMAIL}:${SUPER_ADMIN_PASSWORD}:${process.env.DATABASE_URL || 'phadam'}`)
  .digest('hex');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.pbkdf2Sync(password, salt, 210_000, 64, 'sha512').toString('hex');
  return `${salt}:${derived}`;
}

export function comparePassword(suppliedPassword: string, storedHash: string): boolean {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash || hash.length !== 128) return false;

  const suppliedHash = crypto.pbkdf2Sync(suppliedPassword, salt, 210_000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(suppliedHash, 'hex'), Buffer.from(hash, 'hex'));
}

function encodeTokenSection(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function decodeTokenSection(value: string): unknown {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

export function createUserToken(user: PublicUser): string {
  const header = encodeTokenSection({ alg: 'HS256', typ: 'JWT' });
  const body = encodeTokenSection({ ...user, iat: Math.floor(Date.now() / 1000) });
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyUserToken(token: string): TokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;
  const expectedSignature = crypto.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');

  if (signature.length !== expectedSignature.length || !crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
    return null;
  }

  try {
    const payload = decodeTokenSection(body) as Partial<TokenPayload>;
    if (
      typeof payload.id !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.email !== 'string' ||
      !['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(payload.role || '') ||
      typeof payload.iat !== 'number'
    ) {
      return null;
    }

    return payload as TokenPayload;
  } catch {
    return null;
  }
}

function toPublicUser(user: { id: string; name: string; email: string; role: string; isActive: boolean }): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
    isActive: user.isActive,
  };
}

export async function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

export async function getUsers(): Promise<PublicUser[]> {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  return users.map(toPublicUser);
}

export async function createUser(input: { name: string; email: string; password: string; role?: UserRole }): Promise<PublicUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const password = input.password.trim();

  if (!name || !email || password.length < 8) {
    throw new Error('Name, email, and a password of at least 8 characters are required.');
  }

  const user = await prisma.user.create({
    data: { name, email, password: hashPassword(password), role: input.role || 'STAFF', isActive: true },
  });
  return toPublicUser(user);
}

export async function ensureSuperAdmin(): Promise<void> {
  const existing = await findUserByEmail(SUPER_ADMIN_EMAIL);
  if (existing) {
    if (existing.role !== 'SUPER_ADMIN') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN' } });
    }
    return;
  }

  await prisma.user.create({
    data: {
      name: SUPER_ADMIN_NAME,
      email: SUPER_ADMIN_EMAIL,
      password: hashPassword(SUPER_ADMIN_PASSWORD),
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
}

export const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  const payload = token ? verifyUserToken(token) : null;

  if (!payload) {
    res.status(401).json({ success: false, error: 'Unauthorized. Please log in first.' });
    return;
  }

  const user = await findUserById(payload.id);
  if (!user) {
    res.status(401).json({ success: false, error: 'User account no longer exists.' });
    return;
  }

  if (!user.isActive) {
    res.status(403).json({
      success: false,
      error: 'This account has been deactivated. Contact the super admin.',
    });
    return;
  }

  req.user = toPublicUser(user);
  next();
};

export const requireSuperAdmin: RequestHandler = (req, res, next): void => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ success: false, error: 'Only the super admin can manage staff accounts.' });
    return;
  }
  next();
};

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}
