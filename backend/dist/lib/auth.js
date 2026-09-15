"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireSuperAdmin = exports.requireAuth = void 0;
exports.hashPassword = hashPassword;
exports.comparePassword = comparePassword;
exports.createUserToken = createUserToken;
exports.verifyUserToken = verifyUserToken;
exports.findUserByEmail = findUserByEmail;
exports.findUserById = findUserById;
exports.getUsers = getUsers;
exports.createUser = createUser;
exports.ensureSuperAdmin = ensureSuperAdmin;
const node_crypto_1 = __importDefault(require("node:crypto"));
const prisma_1 = require("./prisma");
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
    'wilsonnyaanga2@gmail.com';
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD?.trim() ||
    '38895790@WO';
const SUPER_ADMIN_NAME = process.env.SUPER_ADMIN_NAME?.trim() || 'Wilson Nyaanga';
const AUTH_SECRET = process.env.AUTH_SECRET?.trim() || node_crypto_1.default
    .createHash('sha256')
    .update(`${SUPER_ADMIN_EMAIL}:${SUPER_ADMIN_PASSWORD}:${process.env.DATABASE_URL || 'phadam'}`)
    .digest('hex');
function hashPassword(password) {
    const salt = node_crypto_1.default.randomBytes(16).toString('hex');
    const derived = node_crypto_1.default.pbkdf2Sync(password, salt, 210_000, 64, 'sha512').toString('hex');
    return `${salt}:${derived}`;
}
function comparePassword(suppliedPassword, storedHash) {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash || hash.length !== 128)
        return false;
    const suppliedHash = node_crypto_1.default.pbkdf2Sync(suppliedPassword, salt, 210_000, 64, 'sha512').toString('hex');
    return node_crypto_1.default.timingSafeEqual(Buffer.from(suppliedHash, 'hex'), Buffer.from(hash, 'hex'));
}
function encodeTokenSection(value) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
}
function decodeTokenSection(value) {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}
function createUserToken(user) {
    const header = encodeTokenSection({ alg: 'HS256', typ: 'JWT' });
    const body = encodeTokenSection({ ...user, iat: Math.floor(Date.now() / 1000) });
    const signature = node_crypto_1.default.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}
function verifyUserToken(token) {
    const parts = token.split('.');
    if (parts.length !== 3)
        return null;
    const [header, body, signature] = parts;
    const expectedSignature = node_crypto_1.default.createHmac('sha256', AUTH_SECRET).update(`${header}.${body}`).digest('base64url');
    if (signature.length !== expectedSignature.length || !node_crypto_1.default.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) {
        return null;
    }
    try {
        const payload = decodeTokenSection(body);
        if (typeof payload.id !== 'string' ||
            typeof payload.name !== 'string' ||
            typeof payload.email !== 'string' ||
            !['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(payload.role || '') ||
            typeof payload.iat !== 'number') {
            return null;
        }
        return payload;
    }
    catch {
        return null;
    }
}
function toPublicUser(user) {
    return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
    };
}
async function findUserByEmail(email) {
    return prisma_1.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}
async function findUserById(id) {
    return prisma_1.prisma.user.findUnique({ where: { id } });
}
async function getUsers() {
    const users = await prisma_1.prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, isActive: true },
        orderBy: { createdAt: 'asc' },
    });
    return users.map(toPublicUser);
}
async function createUser(input) {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    const password = input.password.trim();
    if (!name || !email || password.length < 8) {
        throw new Error('Name, email, and a password of at least 8 characters are required.');
    }
    const user = await prisma_1.prisma.user.create({
        data: { name, email, password: hashPassword(password), role: input.role || 'STAFF', isActive: true },
    });
    return toPublicUser(user);
}
async function ensureSuperAdmin() {
    const existing = await findUserByEmail(SUPER_ADMIN_EMAIL);
    if (existing) {
        if (existing.role !== 'SUPER_ADMIN') {
            await prisma_1.prisma.user.update({ where: { id: existing.id }, data: { role: 'SUPER_ADMIN' } });
        }
        return;
    }
    await prisma_1.prisma.user.create({
        data: {
            name: SUPER_ADMIN_NAME,
            email: SUPER_ADMIN_EMAIL,
            password: hashPassword(SUPER_ADMIN_PASSWORD),
            role: 'SUPER_ADMIN',
            isActive: true,
        },
    });
}
const requireAuth = async (req, res, next) => {
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
exports.requireAuth = requireAuth;
const requireSuperAdmin = (req, res, next) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        res.status(403).json({ success: false, error: 'Only the super admin can manage staff accounts.' });
        return;
    }
    next();
};
exports.requireSuperAdmin = requireSuperAdmin;
