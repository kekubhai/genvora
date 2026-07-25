import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
} from "@nestjs/common";
import type { Response } from "express";
import { ScansService } from "./scans.service";

@Controller("sites/:siteId/scans")
export class ScansController {
  // Explicit @Inject — wrangler/esbuild does not emit design:paramtypes
  constructor(@Inject(ScansService) private readonly scansService: ScansService) {}

  @Post()
  async createScan(
    @Param("siteId") siteId: string,
    @Body() body: { url?: string },
    @Res() res: Response,
  ): Promise<void> {
    try {
      const url = body?.url;
      if (!url) {
        res.status(400).json({ error: "URL is required" });
        return;
      }

      const scan = await this.scansService.createScan(siteId, url);
      res.status(201).json(scan);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create scan";
      const status = message.startsWith("Site not found") ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }

  @Get()
  async getScans(@Param("siteId") siteId: string, @Res() res: Response): Promise<void> {
    try {
      const scans = await this.scansService.getScansBySite(siteId);
      res.status(200).json(scans);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list scans";
      res.status(500).json({ error: message });
    }
  }
}

@Controller("scans")
export class ScansDetailController {
  constructor(@Inject(ScansService) private readonly scansService: ScansService) {}

  @Get(":scanId")
  async getScan(@Param("scanId") scanId: string, @Res() res: Response): Promise<void> {
    try {
      const scan = await this.scansService.getScanById(scanId);
      if (!scan) {
        res.status(404).json({ error: "Scan not found" });
        return;
      }
      res.status(200).json(scan);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get scan";
      res.status(500).json({ error: message });
    }
  }

  @Get(":scanId/snapshot")
  async getSnapshot(@Param("scanId") scanId: string, @Res() res: Response): Promise<void> {
    try {
      const urls = await this.scansService.getSnapshotUrls(scanId);
      if (!urls) {
        res.status(404).json({ error: "Scan not found or no snapshots available" });
        return;
      }
      res.status(200).json(urls);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get snapshot";
      res.status(500).json({ error: message });
    }
  }
}
