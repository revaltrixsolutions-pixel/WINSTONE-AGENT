"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = login;
exports.getCurrentUser = getCurrentUser;
exports.listUsers = listUsers;
exports.createAccount = createAccount;
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
    if (!user || !(0, auth_1.comparePassword)(password, user.password)) {
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
    });
    return res.status(200).json({
        success: true,
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
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
        },
    });
}
async function listUsers(req, res) {
    return res.status(200).json({
        success: true,
        users: (0, auth_1.getUsers)(),
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
        const user = (0, auth_1.createUser)({
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
