import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

import {
  comparePassword,
  createUser,
  createUserToken,
  findUserByEmail,
  getUsers,
  type UserRole,
} from '../lib/auth';

type LoginBody = {
  email?: string;
  password?: string;
};

type CreateUserBody = {
  name?: string;
  email?: string;
  password?: string;
  role?: UserRole;
};

export async function login(req: Request, res: Response): Promise<Response> {
  const { email, password } = req.body as LoginBody;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required.',
    });
  }

  const user = await findUserByEmail(email);

  if (!user || !user.isActive || !comparePassword(password, user.password)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid email or password.',
    });
  }

  const token = createUserToken({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
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

export async function getCurrentUser(
  req: Request,
  res: Response,
): Promise<Response> {
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

export async function listUsers(
  req: Request,
  res: Response,
): Promise<Response> {
  return res.status(200).json({
    success: true,
    users: await getUsers(),
  });
}

export async function createAccount(
  req: Request,
  res: Response,
): Promise<Response> {
  const { name, email, password, role } = req.body as CreateUserBody;

  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and password are required.',
    });
  }

  try {
    const user = await createUser({
      name,
      email,
      password,
      role: role && ['SUPER_ADMIN', 'ADMIN', 'STAFF'].includes(role) ? role : 'STAFF',
    });

    return res.status(201).json({
      success: true,
      user,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : 'Unable to create the new user.',
    });
  }
}

export async function updateAccountStatus(
  req: Request,
  res: Response,
): Promise<Response> {
  const userId = req.params.userId?.trim();
  const isActive = req.body?.isActive;

  if (!userId || typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, error: 'userId and boolean isActive are required.' });
  }

  if (userId === req.user?.id && !isActive) {
    return res.status(400).json({ success: false, error: 'You cannot deactivate your own account.' });
  }

  const user = await prisma.user.update({ where: { id: userId }, data: { isActive } });

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

export async function deleteAccount(
  req: Request,
  res: Response,
): Promise<Response> {
  const userId = req.params.userId?.trim();

  if (!userId || userId === req.user?.id) {
    return res.status(400).json({ success: false, error: 'A different userId is required.' });
  }

  await prisma.user.delete({ where: { id: userId } });
  return res.status(204).send();
}