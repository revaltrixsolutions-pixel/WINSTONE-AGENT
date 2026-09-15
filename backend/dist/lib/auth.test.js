"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const auth_1 = require("./auth");
(0, node_test_1.default)('hashes and verifies provider passwords', () => {
    const hash = (0, auth_1.hashPassword)('StrongP@ssword!');
    strict_1.default.notEqual(hash, 'StrongP@ssword!');
    strict_1.default.equal((0, auth_1.comparePassword)('StrongP@ssword!', hash), true);
    strict_1.default.equal((0, auth_1.comparePassword)('WrongPassword!', hash), false);
});
(0, node_test_1.default)('creates and validates signed auth tokens', () => {
    const token = (0, auth_1.createUserToken)({
        id: 'user-123',
        email: 'superadmin@phadam.com',
        role: 'SUPER_ADMIN',
        name: 'Super Admin',
        isActive: true,
    });
    const payload = (0, auth_1.verifyUserToken)(token);
    strict_1.default.ok(payload);
    strict_1.default.equal(payload.id, 'user-123');
    strict_1.default.equal(payload.role, 'SUPER_ADMIN');
});
