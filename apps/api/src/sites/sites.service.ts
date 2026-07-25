import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

const DEMO_ORG_ID = "org_demo_1";

@Injectable()
export class SitesService {
  constructor(private readonly prisma: PrismaService) {}

  async listSites() {
    return this.prisma.site.findMany({
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            status: true,
            overallScore: true,
            createdAt: true,
            completedAt: true,
          },
        },
        _count: { select: { scans: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getSite(siteId: string) {
    const site = await this.prisma.site.findUnique({
      where: { id: siteId },
      include: {
        scans: {
          orderBy: { createdAt: "desc" },
          include: {
            categoryScores: true,
            recommendations: true,
          },
        },
      },
    });

    if (!site) {
      throw new NotFoundException("Site not found");
    }

    return site;
  }

  /**
   * Find-or-create a site by domain under the demo org (or a provided org).
   * Domain is stored without protocol; callers pass full URLs for scans.
   */
  async upsertSite(domainInput: string, organizationId?: string) {
    const domain = normalizeDomain(domainInput);
    const orgId = await this.ensureOrganization(organizationId);

    const existing = await this.prisma.site.findUnique({
      where: { domain },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.site.create({
      data: {
        domain,
        organizationId: orgId,
      },
    });
  }

  private async ensureOrganization(organizationId?: string): Promise<string> {
    if (organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (org) return org.id;
    }

    const demo = await this.prisma.organization.findUnique({
      where: { id: DEMO_ORG_ID },
    });
    if (demo) return demo.id;

    const created = await this.prisma.organization.create({
      data: {
        id: DEMO_ORG_ID,
        name: "Genvora Demo",
        slug: "genvora-demo",
        createdAt: new Date(),
      },
    });
    return created.id;
  }
}

function normalizeDomain(input: string): string {
  let value = input.trim().toLowerCase();
  try {
    if (!/^https?:\/\//i.test(value)) {
      value = `https://${value}`;
    }
    const url = new URL(value);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return value
      .replace(/^https?:\/\//i, "")
      .replace(/^www\./, "")
      .split("/")[0]!
      .split("?")[0]!;
  }
}
