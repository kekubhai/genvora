import { Body, Controller, Get, Inject, Param, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import { SitesService } from "./sites.service";

@Controller("sites")
export class SitesController {
  // Explicit @Inject — wrangler/esbuild does not emit design:paramtypes
  constructor(@Inject(SitesService) private readonly sitesService: SitesService) {}

  @Get()
  async list(@Res() res: Response): Promise<void> {
    try {
      const sites = await this.sitesService.listSites();
      res.status(200).json(sites);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list sites";
      res.status(500).json({ error: message });
    }
  }

  @Get(":siteId")
  async get(@Param("siteId") siteId: string, @Res() res: Response): Promise<void> {
    try {
      const site = await this.sitesService.getSite(siteId);
      res.status(200).json(site);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get site";
      res.status(message === "Site not found" ? 404 : 500).json({ error: message });
    }
  }

  @Post()
  async create(
    @Body() body: { domain?: string; url?: string; organizationId?: string },
    @Res() res: Response,
  ): Promise<void> {
    try {
      const domainOrUrl = body?.domain ?? body?.url;
      if (!domainOrUrl) {
        res.status(400).json({ error: "domain or url is required" });
        return;
      }

      const site = await this.sitesService.upsertSite(domainOrUrl, body?.organizationId);
      res.status(201).json(site);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create site";
      res.status(500).json({ error: message });
    }
  }
}
