import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { SitesService } from "./sites.service";

@Controller("sites")
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Get()
  async list(@Res() res: Response): Promise<void> {
    const sites = await this.sitesService.listSites();
    res.json(sites);
  }

  @Get(":siteId")
  async get(@Param("siteId") siteId: string, @Res() res: Response): Promise<void> {
    const site = await this.sitesService.getSite(siteId);
    res.json(site);
  }

  @Post()
  async create(
    @Body() body: { domain?: string; url?: string; organizationId?: string },
    @Res() res: Response,
  ): Promise<void> {
    const domainOrUrl = body.domain ?? body.url;
    if (!domainOrUrl) {
      res.status(400).json({ error: "domain or url is required" });
      return;
    }

    const site = await this.sitesService.upsertSite(domainOrUrl, body.organizationId);
    res.status(201).json(site);
  }
}
