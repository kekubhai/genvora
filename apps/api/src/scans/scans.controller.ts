import { Controller, Get, Post, Param, Body, NotFoundException, Res } from "@nestjs/common";
import type { Response } from "express";
import { ScansService } from "./scans.service";
import { TASK_QUEUES } from "@repo/shared-types";

@Controller("sites/:siteId/scans")
export class ScansController {
  constructor(private readonly scansService: ScansService) {}

  @Post()
  async createScan(
    @Param("siteId") siteId: string,
    @Body() body: { url: string },
    @Res() res: Response
  ): Promise<void> {
    const { url } = body;

    if (!url) {
      res.status(400).json({ error: "URL is required" });
      return;
    }

    const scan = await this.scansService.createScan(siteId, url);
    res.status(201).json(scan);
  }

  @Get()
  async getScans(@Param("siteId") siteId: string, @Res() res: Response): Promise<void> {
    const scans = await this.scansService.getScansBySite(siteId);
    res.json(scans);
  }
}

@Controller("scans")
export class ScansDetailController {
  constructor(private readonly scansService: ScansService) {}

  @Get(":scanId")
  async getScan(@Param("scanId") scanId: string, @Res() res: Response): Promise<void> {
    const scan = await this.scansService.getScanById(scanId);

    if (!scan) {
      throw new NotFoundException("Scan not found");
    }

    res.json(scan);
  }

  @Get(":scanId/snapshot")
  async getSnapshot(@Param("scanId") scanId: string, @Res() res: Response): Promise<void> {
    const urls = await this.scansService.getSnapshotUrls(scanId);

    if (!urls) {
      throw new NotFoundException("Scan not found or no snapshots available");
    }

    res.json(urls);
  }
}