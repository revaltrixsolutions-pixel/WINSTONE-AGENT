"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getCurrentUser = getCurrentUser;
exports.listUsers = listUsers;
exports.createAccount = createAccount;
exports.updateAccountStatus = updateAccountStatus;
exports.deleteAccount = deleteAccount;
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../lib/auth");
async function login(req, res) {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Email and password are required.',
        });
    }
    const user = await (0, auth_1.findUserByEmail)(email);
    if (!user || !user.isActive || !(0, auth_1.comparePassword)(password, user.password)) {
        return res.status(401).json({
            success: false,
            error: 'Invalid email or password.',
        });
    }
    const token = (0, auth_1.createUserToken)({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
    });
    return res.status(200).json({
        success: true,
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
        },
    });
}
async function getCurrentUser(req, res) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized.',
        });
    }
    return res.status(200).json({
        success: true,
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            isActive: req.user.isActive,
        },
    });
}
async function listUsers(req, res) {
    return res.status(200).json({
        success: true,
        users: await (0, auth_1.getUsers)(),
    });
}
async function createAccount(req, res) {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
        return res.status(400).json({
            success: false,
            error: 'Name, email, and password are required.',
        });
    }
    try {
        const user = await (0, auth_1.createUser)({
            name,
            email,
            password,
            role: role && ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role) ? role : 'STAFF',
        });
        return res.status(201).json({
            success: true,
            user,
        });
    }
    catch (error) {
        return res.status(400).json({
            success: false,
            error: error instanceof Error
                ? error.message
                : 'Unable to create the new user.',
        });
    }
}
async function updateAccountStatus(req, res) {
    const userId = req.params.userId?.trim();
    const isActive = req.body?.isActive;
    if (!userId || typeof isActive !== 'boolean') {
        return res.status(400).json({ success: false, error: 'userId and boolean isActive are required.' });
    }
    if (userId === req.user?.id && !isActive) {
        return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
    }
    const user = await prisma_1.prisma.user.update({ where: { id: userId }, data: { isActive } });
    return res.status(200).json({
        success: true,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
        },
    });
}
async function deleteAccount(req, res) {
    const userId = req.params.userId?.trim();
    if (!userId || userId === req.user?.id) {
        return res.status(400).json({ success: false, error: 'A different userId is required.' });
    }
    await prisma_1.prisma.user.delete({ where: { id: userId } });
    return res.status(204).send();
}
