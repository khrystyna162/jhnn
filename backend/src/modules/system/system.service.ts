import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../database/prisma.service';

type ProviderMode = 'mock' | 'sandbox' | 'production';
type TerminalStatus = 'ACTIVE' | 'INACTIVE';

interface KioskTerminal {
  id: string;
  name: string;
  branchId: string;
  branchName?: string;
  status: TerminalStatus;
  apiKey: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  lastSeenAt?: string;
}

type ResolvedTerminalContext = {
  id: string;
  name: string;
  branchId: string;
  branchName?: string;
  status: TerminalStatus;
  lastSeenAt?: string;
};

@Injectable()
export class SystemService {
  constructor(private readonly prisma: PrismaService) {}

  private terminalsSettingKey = 'kiosk_terminals';

  private generateApiKey() {
    return `st_kiosk_${randomBytes(18).toString('hex')}`;
  }

  private async readTerminals(): Promise<KioskTerminal[]> {
    const row = await this.prisma.systemSetting.findUnique({
      where: { key: this.terminalsSettingKey },
    });

    if (!row || !Array.isArray(row.value)) {
      return [];
    }

    return row.value as unknown as KioskTerminal[];
  }

  private async writeTerminals(terminals: KioskTerminal[]) {
    await this.prisma.systemSetting.upsert({
      where: { key: this.terminalsSettingKey },
      update: { value: terminals as unknown as object },
      create: { key: this.terminalsSettingKey, value: terminals as unknown as object },
    });
  }

  async getSettings() {
    const rows = await this.prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    });

    return {
      data: rows,
      total: rows.length,
    };
  }

  async updateSettings(payload: Record<string, unknown>) {
    const entries = Object.entries(payload);

    await this.prisma.$transaction(
      entries.map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          update: { value: value as object },
          create: { key, value: value as object },
        }),
      ),
    );

    return { success: true, updated: entries.length };
  }

  async switchProvider(mode: ProviderMode) {
    await this.prisma.systemSetting.upsert({
      where: { key: 'notification_provider_mode' },
      update: { value: { mode } },
      create: { key: 'notification_provider_mode', value: { mode } },
    });

    return { success: true, mode };
  }

  async getKioskTerminals() {
    const [terminals, branches] = await Promise.all([
      this.readTerminals(),
      this.prisma.branch.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
      }),
    ]);

    const branchMap = new Map(branches.map((branch) => [branch.id, branch.name]));

    return {
      data: terminals.map((terminal) => ({
        ...terminal,
        branchName: terminal.branchName ?? branchMap.get(terminal.branchId) ?? terminal.branchId,
      })),
      total: terminals.length,
    };
  }

  async createKioskTerminal(payload: {
    name: string;
    branchId: string;
    status?: TerminalStatus;
    description?: string;
  }) {
    const branch = await this.prisma.branch.findUnique({ where: { id: payload.branchId } });
    if (!branch) {
      throw new NotFoundException('Філію не знайдено');
    }

    const terminals = await this.readTerminals();
    const now = new Date().toISOString();
    const terminal: KioskTerminal = {
      id: randomBytes(12).toString('hex'),
      name: payload.name.trim(),
      branchId: payload.branchId,
      branchName: branch.name,
      status: payload.status ?? 'ACTIVE',
      description: payload.description?.trim() || undefined,
      apiKey: this.generateApiKey(),
      createdAt: now,
      updatedAt: now,
    };

    await this.writeTerminals([terminal, ...terminals]);

    return { terminal };
  }

  async updateKioskTerminal(
    terminalId: string,
    payload: {
      name?: string;
      branchId?: string;
      status?: TerminalStatus;
      description?: string;
      lastSeenAt?: string;
    },
  ) {
    const terminals = await this.readTerminals();
    const index = terminals.findIndex((terminal) => terminal.id === terminalId);
    if (index < 0) {
      throw new NotFoundException('Термінал не знайдено');
    }

    let branchName = terminals[index].branchName;
    if (payload.branchId && payload.branchId !== terminals[index].branchId) {
      const branch = await this.prisma.branch.findUnique({ where: { id: payload.branchId } });
      if (!branch) {
        throw new NotFoundException('Філію не знайдено');
      }
      branchName = branch.name;
    }

    terminals[index] = {
      ...terminals[index],
      name: payload.name?.trim() || terminals[index].name,
      branchId: payload.branchId ?? terminals[index].branchId,
      branchName,
      status: payload.status ?? terminals[index].status,
      description: payload.description !== undefined ? payload.description.trim() || undefined : terminals[index].description,
      lastSeenAt: payload.lastSeenAt ?? terminals[index].lastSeenAt,
      updatedAt: new Date().toISOString(),
    };

    await this.writeTerminals(terminals);
    return { terminal: terminals[index] };
  }

  async rotateKioskTerminalKey(terminalId: string) {
    const terminals = await this.readTerminals();
    const index = terminals.findIndex((terminal) => terminal.id === terminalId);
    if (index < 0) {
      throw new NotFoundException('Термінал не знайдено');
    }

    terminals[index] = {
      ...terminals[index],
      apiKey: this.generateApiKey(),
      updatedAt: new Date().toISOString(),
    };

    await this.writeTerminals(terminals);
    return { terminal: terminals[index] };
  }

  async deleteKioskTerminal(terminalId: string) {
    const terminals = await this.readTerminals();
    const next = terminals.filter((terminal) => terminal.id !== terminalId);
    if (next.length === terminals.length) {
      throw new NotFoundException('Термінал не знайдено');
    }

    await this.writeTerminals(next);
    return { success: true };
  }

  async resolveTerminalByApiKey(apiKey: string, options?: { touchLastSeen?: boolean }) {
    const normalizedKey = apiKey.trim();
    if (!normalizedKey) {
      throw new UnauthorizedException('Ключ термінала не вказано');
    }

    const terminals = await this.readTerminals();
    const terminalIndex = terminals.findIndex((terminal) => terminal.apiKey === normalizedKey);
    if (terminalIndex < 0) {
      throw new UnauthorizedException('Невірний ключ термінала');
    }

    const terminal = terminals[terminalIndex];
    if (terminal.status !== 'ACTIVE') {
      throw new UnauthorizedException('Термінал неактивний');
    }

    const branch = await this.prisma.branch.findUnique({
      where: { id: terminal.branchId },
      select: { name: true, isActive: true },
    });

    if (!branch || !branch.isActive) {
      throw new NotFoundException('Філію термінала не знайдено');
    }

    const lastSeenAt = new Date().toISOString();
    if (options?.touchLastSeen) {
      terminals[terminalIndex] = {
        ...terminal,
        lastSeenAt,
        branchName: branch.name,
        updatedAt: lastSeenAt,
      };
      await this.writeTerminals(terminals);
    }

    const resolved: ResolvedTerminalContext = {
      id: terminal.id,
      name: terminal.name,
      branchId: terminal.branchId,
      branchName: branch.name,
      status: terminal.status,
      lastSeenAt: options?.touchLastSeen ? lastSeenAt : terminal.lastSeenAt,
    };

    return { terminal: resolved };
  }

  async metrics() {
    const [users, branches, workplaces, waitingTickets, inProgressTickets] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.branch.count({ where: { isActive: true } }),
      this.prisma.workplace.count({ where: { isActive: true } }),
      this.prisma.ticket.count({ where: { status: 'WAITING' } }),
      this.prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
    ]);

    return {
      users,
      branches,
      workplaces,
      waitingTickets,
      inProgressTickets,
      timestamp: new Date().toISOString(),
    };
  }

  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
