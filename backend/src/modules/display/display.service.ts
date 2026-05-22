import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { TtsTestDto } from './dto/tts-test.dto';
import { UpdateDisplaySettingsDto } from './dto/update-display-settings.dto';

@Injectable()
export class DisplayService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(branchId: string) {
    await this.ensureBranch(branchId);

    const settings = await this.prisma.displaySetting.findUnique({
      where: { branchId },
    });

    if (!settings) {
      return {
        branchId,
        layoutMode: 'FHD',
        ttsEnabled: true,
        ttsRate: 1,
        ttsVolume: 1,
      };
    }

    return settings;
  }

  async updateSettings(branchId: string, dto: UpdateDisplaySettingsDto) {
    await this.ensureBranch(branchId);

    const updated = await this.prisma.displaySetting.upsert({
      where: { branchId },
      update: {
        layoutMode: dto.layoutMode,
        ttsEnabled: dto.ttsEnabled,
        ttsVoice: dto.ttsVoice,
        ttsRate: dto.ttsRate,
        ttsVolume: dto.ttsVolume,
      },
      create: {
        branchId,
        layoutMode: dto.layoutMode ?? 'FHD',
        ttsEnabled: dto.ttsEnabled ?? true,
        ttsVoice: dto.ttsVoice,
        ttsRate: dto.ttsRate ?? 1,
        ttsVolume: dto.ttsVolume ?? 1,
      },
    });

    return { settings: updated };
  }

  async publicDisplay(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        name: true,
      },
    });

    if (!branch) {
      throw new NotFoundException('Відділення не знайдено');
    }

    // Fetch active workplaces with their current ticket (CALLED or IN_PROGRESS)
    const workplaces = await this.prisma.workplace.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        status: true,
        workplaceServices: {
          select: { serviceType: { select: { name: true } } },
          take: 1,
        },
        tickets: {
          where: { status: { in: ['CALLED', 'IN_PROGRESS'] } },
          orderBy: { calledAt: 'desc' },
          take: 1,
          select: {
            number: true,
            status: true,
            calledAt: true,
            currentService: { select: { name: true } },
            operator: { select: { fullName: true } },
          },
        },
      },
    });

    // Recently completed tickets
    const recentCompleted = await this.prisma.ticket.findMany({
      where: { branchId, status: 'COMPLETED' },
      orderBy: { completedAt: 'desc' },
      take: 20,
      select: { number: true },
    });

    // Active tickets currently being served (CALLED / IN_PROGRESS)
    const activeTickets = await this.prisma.ticket.findMany({
      where: { branchId, status: { in: ['CALLED', 'IN_PROGRESS'] } },
      orderBy: { calledAt: 'desc' },
      take: 20,
      select: {
        number: true,
        status: true,
        calledAt: true,
        currentService: { select: { name: true } },
        workplace: { select: { name: true } },
      },
    });

    const waitingTickets = await this.prisma.ticket.findMany({
      where: { branchId, status: 'WAITING' },
      orderBy: { createdAt: 'asc' },
      take: 20,
      select: {
        number: true,
        status: true,
        createdAt: true,
        currentService: { select: { name: true } },
      },
    });

    const displaySettings = await this.prisma.displaySetting.findUnique({
      where: { branchId },
      select: {
        ttsEnabled: true,
        ttsVoice: true,
        ttsRate: true,
        ttsVolume: true,
      },
    });

    return {
      branchId: branch.id,
      branchName: branch.name,
      updatedAt: new Date().toISOString(),
      displaySettings: {
        ttsEnabled: displaySettings?.ttsEnabled ?? true,
        ttsVoice: displaySettings?.ttsVoice ?? undefined,
        ttsRate: displaySettings?.ttsRate ?? 1,
        ttsVolume: displaySettings?.ttsVolume ?? 1,
      },
      workplaces: workplaces.map((wp) => {
        const current = wp.tickets[0] ?? null;
        const serviceName = wp.workplaceServices[0]?.serviceType?.name ?? undefined;
        return {
          id: wp.id,
          number: wp.name,
          status: wp.status,
          serviceName,
          currentTicketNumber: current?.number ?? undefined,
          operatorName: current?.operator?.fullName ?? undefined,
        };
      }),
      activeTickets: activeTickets.map((t) => ({
        number: t.number,
        status: t.status,
        serviceName: t.currentService?.name ?? undefined,
        workplaceNumber: t.workplace?.name ?? undefined,
        calledAt: t.calledAt?.toISOString() ?? undefined,
      })),
      waitingTickets: waitingTickets.map((t) => ({
        number: t.number,
        status: t.status,
        serviceName: t.currentService?.name ?? undefined,
        calledAt: t.createdAt?.toISOString() ?? undefined,
      })),
      completedTicketNumbers: recentCompleted.map((t) => t.number),
    };
  }

  ttsTest(dto: TtsTestDto) {
    return {
      success: true,
      text: dto.text ?? 'Тестове оголошення SoftTurn',
      note: 'Browser TTS is executed on frontend display client',
    };
  }

  private async ensureBranch(branchId: string) {
    const branch = await this.prisma.branch.findUnique({
      where: { id: branchId },
      select: { id: true },
    });

    if (!branch) {
      throw new NotFoundException('Відділення не знайдено');
    }
  }
}
