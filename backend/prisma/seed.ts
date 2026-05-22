import * as bcrypt from 'bcryptjs';
import { NotificationChannel, PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const permissions = [
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

  for (const code of permissions) {
    await prisma.permission.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  const country = await prisma.country.upsert({
    where: { code: 'UA' },
    update: { name: 'Україна', isActive: true },
    create: {
      code: 'UA',
      name: 'Україна',
      isActive: true,
    },
  });

  const city = await prisma.city.upsert({
    where: { countryId_name: { countryId: country.id, name: 'Київ' } },
    update: { isActive: true },
    create: {
      countryId: country.id,
      name: 'Київ',
      isActive: true,
    },
  });

  const district = await prisma.district.upsert({
    where: { cityId_name: { cityId: city.id, name: 'Шевченківський' } },
    update: { isActive: true },
    create: {
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
      code: `KIEV-${Date.now()}`,
      name: 'Відділення Київ Центр',
      isActive: true,
    },
  }).catch(async () => {
    return prisma.branch.findFirstOrThrow({ where: { cityId: city.id, districtId: district.id } });
  });

  const service = await prisma.serviceType.upsert({
    where: { code: 'CONSULT' },
    update: { isActive: true },
    create: {
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
      code: `W1-${Date.now()}`,
      name: 'Вікно 1',
      status: 'ACTIVE',
      isActive: true,
    },
  }).catch(async () => {
    return prisma.workplace.findFirstOrThrow({ where: { branchId: branch.id, name: 'Вікно 1' } });
  });

  await prisma.workplaceServiceType.upsert({
    where: {
      workplaceId_serviceTypeId: {
        workplaceId: workplace.id,
        serviceTypeId: service.id,
      },
    },
    update: {},
    create: {
      workplaceId: workplace.id,
      serviceTypeId: service.id,
    },
  });

  const cityLviv = await prisma.city.upsert({
    where: { countryId_name: { countryId: country.id, name: 'Львів' } },
    update: { isActive: true },
    create: {
      countryId: country.id,
      name: 'Львів',
      isActive: true,
    },
  });

  const districtLviv = await prisma.district.upsert({
    where: { cityId_name: { cityId: cityLviv.id, name: 'Галицький' } },
    update: { isActive: true },
    create: {
      cityId: cityLviv.id,
      name: 'Галицький',
      isActive: true,
    },
  });

  const branchWest = await prisma.branch.upsert({
    where: { code: 'LVIV-001' },
    update: {
      name: 'Відділення Львів Центр',
      countryId: country.id,
      cityId: cityLviv.id,
      districtId: districtLviv.id,
      isActive: true,
    },
    create: {
      code: 'LVIV-001',
      name: 'Відділення Львів Центр',
      countryId: country.id,
      cityId: cityLviv.id,
      districtId: districtLviv.id,
      isActive: true,
    },
  });

  const servicePass = await prisma.serviceType.upsert({
    where: { code: 'PASSPORT' },
    update: { name: 'Оформлення паспорта', prefix: 'P', isActive: true },
    create: {
      code: 'PASSPORT',
      name: 'Оформлення паспорта',
      prefix: 'P',
      slaMinutes: 30,
      isActive: true,
    },
  });

  const serviceReg = await prisma.serviceType.upsert({
    where: { code: 'REGISTRATION' },
    update: { name: 'Реєстраційні дії', prefix: 'R', isActive: true },
    create: {
      code: 'REGISTRATION',
      name: 'Реєстраційні дії',
      prefix: 'R',
      slaMinutes: 25,
      isActive: true,
    },
  });

  const workplacesSeed = [
    { branchId: branch.id, name: 'Вікно 2', serviceId: servicePass.id },
    { branchId: branch.id, name: 'Вікно 3', serviceId: serviceReg.id },
    { branchId: branchWest.id, name: 'Вікно 1', serviceId: service.id },
    { branchId: branchWest.id, name: 'Вікно 2', serviceId: servicePass.id },
  ];

  for (const row of workplacesSeed) {
    const wp = await prisma.workplace.upsert({
      where: { branchId_name: { branchId: row.branchId, name: row.name } },
      update: { isActive: true, status: 'ACTIVE' },
      create: {
        branchId: row.branchId,
        name: row.name,
        isActive: true,
        status: 'ACTIVE',
      },
    });

    await prisma.workplaceServiceType.upsert({
      where: {
        workplaceId_serviceTypeId: {
          workplaceId: wp.id,
          serviceTypeId: row.serviceId,
        },
      },
      update: {},
      create: {
        workplaceId: wp.id,
        serviceTypeId: row.serviceId,
      },
    });
  }

  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'password123';
  const demoPasswordHash = await bcrypt.hash(demoPassword, 10);

  const operator = await prisma.user.upsert({
    where: { email: 'operator@example.com' },
    update: {
      fullName: 'SoftTurn Operator',
      role: Role.OPERATOR,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      fullName: 'SoftTurn Operator',
      email: 'operator@example.com',
      role: Role.OPERATOR,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      fullName: 'SoftTurn Admin',
      role: Role.ADMIN,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      fullName: 'SoftTurn Admin',
      email: 'admin@example.com',
      role: Role.ADMIN,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
  });

  const sysadmin = await prisma.user.upsert({
    where: { email: 'sysadmin@example.com' },
    update: {
      fullName: 'SoftTurn SysAdmin',
      role: Role.SYSADMIN,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      fullName: 'SoftTurn SysAdmin',
      email: 'sysadmin@example.com',
      role: Role.SYSADMIN,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
  });

  await prisma.user.upsert({
    where: { email: 'sysadmin@softturn.local' },
    update: {
      fullName: 'SoftTurn SysAdmin Local',
      role: Role.SYSADMIN,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
    create: {
      fullName: 'SoftTurn SysAdmin Local',
      email: 'sysadmin@softturn.local',
      role: Role.SYSADMIN,
      isActive: true,
      passwordHash: demoPasswordHash,
    },
  });

  const allPermissionIds = await prisma.permission.findMany({
    select: { id: true },
  });

  await prisma.userPermission.deleteMany({ where: { userId: { in: [operator.id, admin.id, sysadmin.id] } } });
  await prisma.userPermission.createMany({
    data: [operator.id, admin.id, sysadmin.id].flatMap((userId) =>
      allPermissionIds.map((permission) => ({
        userId,
        permissionId: permission.id,
      })),
    ),
    skipDuplicates: true,
  });

  await prisma.userScope.deleteMany({ where: { userId: { in: [operator.id, admin.id, sysadmin.id] } } });
  await prisma.userScope.create({
    data: {
      userId: operator.id,
      level: 'BRANCH',
      branchId: branch.id,
      cityId: city.id,
      countryId: country.id,
      districtId: district.id,
    },
  });
  await prisma.userScope.create({
    data: {
      userId: admin.id,
      level: 'BRANCH',
      branchId: branch.id,
      cityId: city.id,
      countryId: country.id,
      districtId: district.id,
    },
  });
  await prisma.userScope.create({
    data: {
      userId: sysadmin.id,
      level: 'ALL',
    },
  });

  await prisma.userServiceAccess.deleteMany({
    where: {
      userId: {
        in: [operator.id, admin.id, sysadmin.id],
      },
    },
  });
  await prisma.userServiceAccess.createMany({
    data: [operator.id, admin.id, sysadmin.id].flatMap((userId) => [service.id, servicePass.id, serviceReg.id].map((serviceTypeId) => ({
      userId,
      serviceTypeId,
    }))),
    skipDuplicates: true,
  });

  const phones = [
    '+380671000001',
    '+380671000002',
    '+380671000003',
    '+380671000004',
    '+380671000005',
    '+380671000006',
    '+380671000007',
    '+380671000008',
    '+380671000009',
    '+380671000010',
    '+380671000011',
    '+380671000012',
  ];

  const activeExisting = await prisma.ticket.findMany({
    where: {
      status: { in: ['WAITING', 'CALLED', 'IN_PROGRESS'] },
    },
    select: { phone: true },
  });
  const activePhoneSet = new Set(activeExisting.map((item) => item.phone));

  const ensureTicket = async (
    number: string,
    phone: string,
    status: 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'COMPLETED',
    branchId: string,
    serviceTypeId: string,
    operatorId?: string,
  ) => {
    const exists = await prisma.ticket.findUnique({ where: { number } });
    if (exists) return;
    if (['WAITING', 'CALLED', 'IN_PROGRESS'].includes(status) && activePhoneSet.has(phone)) return;

    await prisma.ticket.create({
      data: {
        number,
        phone,
        phoneMasked: `${phone.slice(0, 4)}******${phone.slice(-2)}`,
        clientName: `Клієнт ${number}`,
        branchId,
        serviceTypeId,
        status,
        operatorId: status === 'WAITING' ? null : operatorId,
        calledAt: status === 'WAITING' ? null : new Date(),
        startedAt: status === 'IN_PROGRESS' || status === 'COMPLETED' ? new Date() : null,
        completedAt: status === 'COMPLETED' ? new Date() : null,
      },
    });

    if (['WAITING', 'CALLED', 'IN_PROGRESS'].includes(status)) {
      activePhoneSet.add(phone);
    }
  };

  const ticketSeedRows: Array<{
    number: string;
    phone: string;
    status: 'WAITING' | 'CALLED' | 'IN_PROGRESS' | 'COMPLETED';
    branchId: string;
    serviceTypeId: string;
  }> = [
    { number: 'A101', phone: phones[0], status: 'WAITING', branchId: branch.id, serviceTypeId: service.id },
    { number: 'A102', phone: phones[1], status: 'WAITING', branchId: branch.id, serviceTypeId: service.id },
    { number: 'P101', phone: phones[2], status: 'WAITING', branchId: branch.id, serviceTypeId: servicePass.id },
    { number: 'R101', phone: phones[3], status: 'WAITING', branchId: branch.id, serviceTypeId: serviceReg.id },
    { number: 'A201', phone: phones[4], status: 'CALLED', branchId: branchWest.id, serviceTypeId: service.id },
    { number: 'P201', phone: phones[5], status: 'IN_PROGRESS', branchId: branchWest.id, serviceTypeId: servicePass.id },
    { number: 'R201', phone: phones[6], status: 'COMPLETED', branchId: branchWest.id, serviceTypeId: serviceReg.id },
    { number: 'A202', phone: phones[7], status: 'COMPLETED', branchId: branch.id, serviceTypeId: service.id },
  ];

  for (const row of ticketSeedRows) {
    await ensureTicket(
      row.number,
      row.phone,
      row.status,
      row.branchId,
      row.serviceTypeId,
      operator.id,
    );
  }

  await prisma.notificationTemplate.upsert({
    where: {
      code_channel_version: {
        code: 'TICKET_CREATED',
        channel: NotificationChannel.VIBER,
        version: 1,
      },
    },
    update: {
      isActive: true,
      text: 'Ваш талон {{ticketNumber}}. Послуга: {{serviceName}}. Відділення: {{branchName}}.',
    },
    create: {
      code: 'TICKET_CREATED',
      channel: NotificationChannel.VIBER,
      version: 1,
      isActive: true,
      text: 'Ваш талон {{ticketNumber}}. Послуга: {{serviceName}}. Відділення: {{branchName}}.',
    },
  });

  await prisma.notificationTemplate.upsert({
    where: {
      code_channel_version: {
        code: 'TICKET_CALLED',
        channel: NotificationChannel.VIBER,
        version: 1,
      },
    },
    update: {
      isActive: true,
      text: 'Ваш талон {{ticketNumber}} запрошено до обслуговування. Відділення: {{branchName}}.',
    },
    create: {
      code: 'TICKET_CALLED',
      channel: NotificationChannel.VIBER,
      version: 1,
      isActive: true,
      text: 'Ваш талон {{ticketNumber}} запрошено до обслуговування. Відділення: {{branchName}}.',
    },
  });

  await prisma.notificationTemplate.upsert({
    where: {
      code_channel_version: {
        code: 'TICKET_CALLED',
        channel: NotificationChannel.SMS,
        version: 1,
      },
    },
    update: {
      isActive: true,
      text: 'Талон {{ticketNumber}}: запрошення до обслуговування у {{branchName}}.',
    },
    create: {
      code: 'TICKET_CALLED',
      channel: NotificationChannel.SMS,
      version: 1,
      isActive: true,
      text: 'Талон {{ticketNumber}}: запрошення до обслуговування у {{branchName}}.',
    },
  });

  await prisma.notificationTemplate.upsert({
    where: {
      code_channel_version: {
        code: 'TICKET_CREATED',
        channel: NotificationChannel.SMS,
        version: 1,
      },
    },
    update: {
      isActive: true,
      text: 'Талон {{ticketNumber}}. {{serviceName}}. {{branchName}}.',
    },
    create: {
      code: 'TICKET_CREATED',
      channel: NotificationChannel.SMS,
      version: 1,
      isActive: true,
      text: 'Талон {{ticketNumber}}. {{serviceName}}. {{branchName}}.',
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'notification_provider_mode' },
    update: { value: { mode: 'mock' } },
    create: { key: 'notification_provider_mode', value: { mode: 'mock' } },
  });

  await prisma.systemSetting.upsert({
    where: { key: 'kiosk_terminals' },
    update: {
      value: [
        {
          id: 'kiosk-kyiv-1',
          name: 'Кіоск Київ 1',
          branchId: branch.id,
          branchName: branch.name,
          status: 'ACTIVE',
          apiKey: 'st_kiosk_seed_kyiv_1',
          description: 'Вхідна зона, 1 поверх',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'kiosk-lviv-1',
          name: 'Кіоск Львів 1',
          branchId: branchWest.id,
          branchName: branchWest.name,
          status: 'ACTIVE',
          apiKey: 'st_kiosk_seed_lviv_1',
          description: 'Ресепшн',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
    create: {
      key: 'kiosk_terminals',
      value: [
        {
          id: 'kiosk-kyiv-1',
          name: 'Кіоск Київ 1',
          branchId: branch.id,
          branchName: branch.name,
          status: 'ACTIVE',
          apiKey: 'st_kiosk_seed_kyiv_1',
          description: 'Вхідна зона, 1 поверх',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'kiosk-lviv-1',
          name: 'Кіоск Львів 1',
          branchId: branchWest.id,
          branchName: branchWest.name,
          status: 'ACTIVE',
          apiKey: 'st_kiosk_seed_lviv_1',
          description: 'Ресепшн',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    },
  });

  console.log('Seed completed');
  console.log('Operator email: operator@example.com');
  console.log('Admin email: admin@example.com');
  console.log('Sysadmin email: sysadmin@example.com');
  console.log('Legacy sysadmin email: sysadmin@softturn.local');
  console.log(`Demo password: ${demoPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
