import 'dotenv/config';

import { getSuperAdminConfig, hashPassword } from '../src/lib/auth';
import { prisma } from '../src/lib/prisma';

async function provisionSuperAdmin(): Promise<void> {
  const { email, name, password } = getSuperAdminConfig();
  const passwordHash = hashPassword(password);

  await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      password: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    update: {
      name,
      password: passwordHash,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });

  console.info('Super-admin account provisioned successfully.');
}

provisionSuperAdmin()
  .catch((error: unknown) => {
    const errorCode =
      error && typeof error === 'object' && 'code' in error &&
      typeof error.code === 'string'
        ? error.code
        : undefined;

    console.error(
      'Super-admin provisioning failed.',
      errorCode ? `Database error code: ${errorCode}.` : 'Check the configured environment and database connection.',
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
