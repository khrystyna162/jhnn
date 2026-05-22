import * as bcrypt from 'bcryptjs';
import { PrismaClient, Role, ScopeLevel } from '@prisma/client';

const prisma = new PrismaClient();

const PERMISSIONS = [
  'tickets.read',
  'tickets.create',
  'tickets.next',
  'tickets.start',
  'tickets.complete',
  'tickets.cancel',
  'tickets.redirect',
  'users.manage',
  'scopes.manage',
  'services.manage',
  'analytics.read',
  'audit.read',
  'display.manage',
  'system.manage',
];

async function main() {
  const password = process.env.SEED_DEMO_PASSWORD ?? 'password123';
  const passwordHash = await bcrypt.hash(password, 10);

  for (const code of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  const country = await prisma.country.create({
    data: {
      code: 'UA',
      name: 'Україна',
      isActive: true,
    },
  });

  const city = await prisma.city.create({
    data: {
      countryId: country.id,
      name: 'Київ',
      isActive: true,
    },
  });

  const district = await prisma.district.create({
    data: {
      cityId: city.id,
      name: 'Шевченківський',
      isActive: true,
    },
  });

  const branch = await prisma.branch.create({
    data: {
      countryId: country.id,
      cityId: city.id,
      districtId: district.id,
      code: 'KYIV-001',
      name: 'Відділення Київ Центр',
      addressLine: 'вул. Хрещатик, 1',
      isActive: true,
    },
  });

  const service = await prisma.serviceType.create({
    data: {
      code: 'CONSULT',
      name: 'Консультація',
      prefix: 'A',
      slaMinutes: 20,
      isActive: true,
    },
  });

  const workplace = await prisma.workplace.create({
    data: {
      branchId: branch.id,
      code: 'W1',
      name: 'Вікно 1',
      status: 'ACTIVE',
      isActive: true,
    },
  });

  await prisma.workplaceServiceType.create({
    data: {
      workplaceId: workplace.id,
      serviceTypeId: service.id,
    },
  });

  await prisma.displaySetting.create({
    data: {
      branchId: branch.id,
      layoutMode: 'FHD',
      ttsEnabled: true,
      ttsRate: 1.0,
      ttsVolume: 1.0,
    },
  });

  const operator = await prisma.user.create({
    data: {
      fullName: 'SoftTurn Operator',
      email: 'operator@softturn.local',
      role: Role.OPERATOR,
      isActive: true,
      passwordHash,
    },
  });

  const admin = await prisma.user.create({
    data: {
      fullName: 'SoftTurn Admin',
      email: 'admin@softturn.local',
      role: Role.ADMIN,
      isActive: true,
      passwordHash,
    },
  });

  const permissionIds = await prisma.permission.findMany({
    select: { id: true },
  });

  await prisma.userPermission.createMany({
    data: [operator.id, admin.id].flatMap((userId) =>
      permissionIds.map((permission) => ({
        userId,
        permissionId: permission.id,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.userScope.createMany({
    data: [operator.id, admin.id].map((userId) => ({
      userId,
      level: ScopeLevel.BRANCH,
      countryId: country.id,
      cityId: city.id,
      districtId: district.id,
      branchId: branch.id,
    })),
  });

  console.log('Minimal seed done');
  console.log(`Branch: ${branch.name} (${branch.id})`);
  console.log(`Operator: operator@softturn.local / ${password}`);
  console.log(`Admin: admin@softturn.local / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
