import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../database/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuditLogInput } from '../audit/audit.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { CreateCityDto } from './dto/create-city.dto';
import { CreateCountryDto } from './dto/create-country.dto';
import { CreateDistrictDto } from './dto/create-district.dto';
import { UpdateOrgEntityDto } from './dto/update-org-entity.dto';

@Injectable()
export class OrgStructureService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getTree() {
    const countries = await this.prisma.country.findMany({
      orderBy: { name: 'asc' },
      include: {
        cities: {
          orderBy: { name: 'asc' },
          include: {
            districts: {
              orderBy: { name: 'asc' },
              include: {
                branches: {
                  orderBy: { name: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    return {
      id: 'ALL',
      level: 'ALL',
      name: 'All',
      children: countries.map((country) => ({
        id: country.id,
        level: 'COUNTRY',
        name: country.name,
        isActive: country.isActive,
        children: country.cities.map((city) => ({
          id: city.id,
          level: 'CITY',
          name: city.name,
          isActive: city.isActive,
          children: city.districts.map((district) => ({
            id: district.id,
            level: 'DISTRICT',
            name: district.name,
            isActive: district.isActive,
            children: district.branches.map((branch) => ({
              id: branch.id,
              level: 'BRANCH',
              name: branch.name,
              isActive: branch.isActive,
              children: [],
            })),
          })),
        })),
      })),
    };
  }

  async getCountries() {
    return this.prisma.country.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async getCities(countryId?: string) {
    return this.prisma.city.findMany({
      where: countryId ? { countryId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        country: {
          select: { name: true },
        },
      },
    }).then((rows) => rows.map((row) => ({
      ...row,
      countryName: row.country?.name,
    })));
  }

  async getDistricts(cityId?: string) {
    return this.prisma.district.findMany({
      where: cityId ? { cityId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        city: {
          select: { name: true },
        },
      },
    }).then((rows) => rows.map((row) => ({
      ...row,
      cityName: row.city?.name,
    })));
  }

  async getBranches(districtId?: string) {
    return this.prisma.branch.findMany({
      where: districtId ? { districtId } : undefined,
      orderBy: { name: 'asc' },
      include: {
        district: {
          select: { name: true },
        },
      },
    }).then((rows) => rows.map((row) => ({
      ...row,
      districtName: row.district?.name,
    })));
  }

  async createCountry(dto: CreateCountryDto, actorId?: string) {
    const country = await this.prisma.country.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        name: dto.name.trim(),
      },
    });

    await this.safeAudit({
      actorId,
      action: 'ORG_COUNTRY_CREATED',
      entityType: 'COUNTRY',
      entityId: country.id,
    });

    return { country };
  }

  async createCity(dto: CreateCityDto, actorId?: string) {
    await this.ensureCountry(dto.countryId);
    const city = await this.prisma.city.create({
      data: {
        countryId: dto.countryId,
        name: dto.name.trim(),
      },
    });

    await this.safeAudit({
      actorId,
      action: 'ORG_CITY_CREATED',
      entityType: 'CITY',
      entityId: city.id,
      meta: {
        countryId: dto.countryId,
      },
    });

    return { city };
  }

  async createDistrict(dto: CreateDistrictDto, actorId?: string) {
    await this.ensureCity(dto.cityId);
    const district = await this.prisma.district.create({
      data: {
        cityId: dto.cityId,
        name: dto.name.trim(),
      },
    });

    await this.safeAudit({
      actorId,
      action: 'ORG_DISTRICT_CREATED',
      entityType: 'DISTRICT',
      entityId: district.id,
      meta: {
        cityId: dto.cityId,
      },
    });

    return { district };
  }

  async createBranch(dto: CreateBranchDto, actorId?: string) {
    const [country, city, district] = await Promise.all([
      this.prisma.country.findUnique({ where: { id: dto.countryId } }),
      this.prisma.city.findUnique({ where: { id: dto.cityId } }),
      this.prisma.district.findUnique({ where: { id: dto.districtId } }),
    ]);

    if (!country) {
      throw new NotFoundException('Країну не знайдено');
    }
    if (!city || city.countryId !== country.id) {
      throw new BadRequestException('Місто не належить країні');
    }
    if (!district || district.cityId !== city.id) {
      throw new BadRequestException('Район не належить місту');
    }

    const branch = await this.prisma.branch.create({
      data: {
        countryId: dto.countryId,
        cityId: dto.cityId,
        districtId: dto.districtId,
        name: dto.name.trim(),
        code: dto.code?.trim().toUpperCase(),
        addressLine: dto.addressLine?.trim(),
      },
    });

    await this.safeAudit({
      actorId,
      action: 'ORG_BRANCH_CREATED',
      entityType: 'BRANCH',
      entityId: branch.id,
      meta: {
        countryId: dto.countryId,
        cityId: dto.cityId,
        districtId: dto.districtId,
      },
    });

    return { branch };
  }

  async updateEntity(entity: string, id: string, dto: UpdateOrgEntityDto, actorId?: string) {
    switch (entity) {
      case 'countries': {
        const country = await this.prisma.country.update({
          where: { id },
          data: {
            name: dto.name,
            code: dto.code?.trim().toUpperCase(),
            isActive: dto.isActive,
          },
        });
        await this.safeAudit({
          actorId,
          action: 'ORG_COUNTRY_UPDATED',
          entityType: 'COUNTRY',
          entityId: country.id,
        });
        return { country };
      }
      case 'cities': {
        const city = await this.prisma.city.update({
          where: { id },
          data: {
            name: dto.name,
            isActive: dto.isActive,
          },
        });
        await this.safeAudit({
          actorId,
          action: 'ORG_CITY_UPDATED',
          entityType: 'CITY',
          entityId: city.id,
        });
        return { city };
      }
      case 'districts': {
        const district = await this.prisma.district.update({
          where: { id },
          data: {
            name: dto.name,
            isActive: dto.isActive,
          },
        });
        await this.safeAudit({
          actorId,
          action: 'ORG_DISTRICT_UPDATED',
          entityType: 'DISTRICT',
          entityId: district.id,
        });
        return { district };
      }
      case 'branches': {
        const branch = await this.prisma.branch.update({
          where: { id },
          data: {
            name: dto.name,
            code: dto.code?.trim().toUpperCase(),
            addressLine: dto.addressLine,
            isActive: dto.isActive,
          },
        });
        await this.safeAudit({
          actorId,
          action: 'ORG_BRANCH_UPDATED',
          entityType: 'BRANCH',
          entityId: branch.id,
        });
        return { branch };
      }
      default:
        throw new BadRequestException('Невірний тип сутності для оновлення');
    }
  }

  async deleteEntity(entity: string, id: string, actorId?: string) {
    let entityType = entity.toUpperCase();
    switch (entity) {
      case 'countries': {
        entityType = 'COUNTRY';
        const linked = await this.prisma.city.count({ where: { countryId: id } });
        if (linked > 0) {
          throw new BadRequestException('Неможливо видалити країну з дочірніми містами');
        }
        await this.prisma.country.delete({ where: { id } });
        break;
      }
      case 'cities': {
        entityType = 'CITY';
        const linked = await this.prisma.district.count({ where: { cityId: id } });
        if (linked > 0) {
          throw new BadRequestException('Неможливо видалити місто з дочірніми районами');
        }
        await this.prisma.city.delete({ where: { id } });
        break;
      }
      case 'districts': {
        entityType = 'DISTRICT';
        const linked = await this.prisma.branch.count({ where: { districtId: id } });
        if (linked > 0) {
          throw new BadRequestException('Неможливо видалити район з дочірніми відділеннями');
        }
        await this.prisma.district.delete({ where: { id } });
        break;
      }
      case 'branches': {
        entityType = 'BRANCH';
        const [workplaces, tickets] = await Promise.all([
          this.prisma.workplace.count({ where: { branchId: id } }),
          this.prisma.ticket.count({ where: { branchId: id } }),
        ]);
        if (workplaces > 0 || tickets > 0) {
          throw new BadRequestException('Неможливо видалити відділення з робочими місцями або талонами');
        }
        await this.prisma.branch.delete({ where: { id } });
        break;
      }
      default:
        throw new BadRequestException('Невірний тип сутності для видалення');
    }

    await this.safeAudit({
      actorId,
      action: 'ORG_ENTITY_DELETED',
      entityType,
      entityId: id,
    });

    return { success: true };
  }

  private async ensureCountry(countryId: string) {
    const country = await this.prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
    if (!country) {
      throw new NotFoundException('Країну не знайдено');
    }
  }

  private async ensureCity(cityId: string) {
    const city = await this.prisma.city.findUnique({ where: { id: cityId }, select: { id: true } });
    if (!city) {
      throw new NotFoundException('Місто не знайдено');
    }
  }

  private async safeAudit(input: AuditLogInput) {
    try {
      await this.auditService.logAction(input);
    } catch {
      // Do not fail org structure command when audit table is temporarily unavailable.
    }
  }
}
