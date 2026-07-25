import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { TASK_QUEUES, type AuditWorkflowInput } from "@repo/shared-types";

@Injectable()
export class ScansService {
  private readonly logger = new Logger(ScansService.name);
  private temporalClient: any = null;

  constructor(private readonly prisma: PrismaService) {
    // Lazy-init Temporal client — Temporal is optional (requires Docker)
    this.initTemporalClient();
  }

  private initTemporalClient(): void {
    const temporalAddress = process.env["TEMPORAL_ADDRESS"];
    if (!temporalAddress) {
      this.logger.warn(
        JSON.stringify({
          level: "warn",
          message: "TEMPORAL_ADDRESS not set — audit workflows disabled",
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    try {
      // Dynamic import for Temporal client (optional dependency)
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { Client } = require("@temporalio/client");
      this.temporalClient = new Client();
      this.logger.log("Connected to Temporal Server");
    } catch (err) {
      this.logger.warn(
        JSON.stringify({
          level: "warn",
          message: "Failed to connect to Temporal — audit workflows disabled",
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  async createScan(siteId: string, url: string) {
    // Create scan record in database
    const scan = await this.prisma.scan.create({
      data: {
        siteId,
        status: "queued",
      },
    });

    // Trigger Temporal workflow asynchronously
    this.triggerAuditWorkflow(scan.id, siteId, url).catch((error) => {
      console.error("Failed to trigger audit workflow:", error);
    });

    return scan;
  }

  async getScansBySite(siteId: string) {
    return this.prisma.scan.findMany({
      where: { siteId },
      include: {
        categoryScores: true,
        recommendations: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getScanById(scanId: string) {
    return this.prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        categoryScores: true,
        recommendations: true,
        site: { select: { id: true, domain: true } },
      },
    });
  }

  async getSnapshotUrls(scanId: string) {
    const scan = await this.prisma.scan.findUnique({
      where: { id: scanId },
      select: {
        rawHtmlUrl: true,
        screenshotUrl: true,
      },
    });

    if (!scan) {
      return null;
    }

    // Generate signed URLs for Supabase Storage
    // This would typically use Supabase's signed URL generation
    // For now, return the object paths
    return {
      rawHtmlUrl: scan.rawHtmlUrl,
      screenshotUrl: scan.screenshotUrl,
    };
  }

  private async triggerAuditWorkflow(scanId: string, siteId: string, url: string) {
    try {
      const workflowId = `audit-${scanId}`;
      const input: AuditWorkflowInput = { siteId, url };

      // Update scan status to running
      await this.prisma.scan.update({
        where: { id: scanId },
        data: { status: "running" },
      });

      // Execute workflow and handle result
      const result = await this.temporalClient.workflow.execute("AuditWorkflow", {
        taskQueue: TASK_QUEUES.AUDIT,
        workflowId,
        args: [input],
      });

      // Save results to database
      await this.saveScanResults(scanId, result);
    } catch (error) {
      console.error("Audit workflow failed:", error);
      
      // Update scan status to failed
      await this.prisma.scan.update({
        where: { id: scanId },
        data: { status: "failed" },
      });
    }
  }

  private async saveScanResults(
    scanId: string,
    result: {
      scanId: string;
      overallScore: number;
      categoryScores: Record<string, number>;
      recommendations: any[];
    }
  ) {
    // Update scan with results
    await this.prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "completed",
        overallScore: result.overallScore,
        completedAt: new Date(),
      },
    });

    // Save category scores
    for (const [category, score] of Object.entries(result.categoryScores)) {
      await this.prisma.categoryScore.create({
        data: {
          scanId,
          category,
          score,
          details: {},
        },
      });
    }

    // Save recommendations
    for (const rec of result.recommendations) {
      await this.prisma.recommendation.create({
        data: {
          scanId,
          severity: rec.severity,
          title: rec.title,
          description: rec.description,
          fixSnippet: rec.fixSnippet,
        },
      });
    }
  }
}