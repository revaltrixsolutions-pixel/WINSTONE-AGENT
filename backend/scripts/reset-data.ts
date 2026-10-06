import 'dotenv/config';

import { prisma } from '../src/lib/prisma';
import { ensureSuperAdmin, getSuperAdminConfig } from '../src/lib/auth';

const { email: superAdminEmail } = getSuperAdminConfig();

async function resetData(): Promise<void> {
  await prisma.$transaction([
    prisma.messageLog.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.user.deleteMany({
      where: {
        email: {
          not: superAdminEmail,
        },
      },
    }),
  ]);

  await ensureSuperAdmin();

  const remainingUsers = await prisma.user.findMany({
    select: { email: true, role: true },
  });

  console.info('[Database Reset Complete]', {
    deletedPatientData: true,
    retainedUsers: remainingUsers,
    retainedSuperAdmin: superAdminEmail,
  });
}

resetData()
  .catch((error: unknown) => {
    console.error('[Database Reset Failed]', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });