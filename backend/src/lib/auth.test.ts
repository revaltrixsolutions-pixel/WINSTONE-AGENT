import test from 'node:test';
import assert from 'node:assert/strict';

import {
  comparePassword,
  createUserToken,
  hashPassword,
  verifyUserToken,
} from './auth';

test('hashes and verifies provider passwords', () => {
  const hash = hashPassword('StrongP@ssword!');

  assert.notEqual(hash, 'StrongP@ssword!');
  assert.equal(comparePassword('StrongP@ssword!', hash), true);
  assert.equal(comparePassword('WrongPassword!', hash), false);
});

test('creates and validates signed auth tokens', () => {
  const token = createUserToken({
    id: 'user-123',
    email: 'superadmin@phadam.com',
    role: 'SUPER_ADMIN',
    name: 'Super Admin',
    isActive: true,
  });

  const payload = verifyUserToken(token);

  assert.ok(payload);
  assert.equal(payload.id, 'user-123');
  assert.equal(payload.role, 'SUPER_ADMIN');
});