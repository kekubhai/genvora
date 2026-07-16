import { Module } from "@nestjs/common";
import { ScansController, ScansDetailController } from "./scans.controller";
import { ScansService } from "./scans.service";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [PrismaModule],
  controllers: [ScansController, ScansDetailController],
  providers: [ScansService],
  exports: [ScansService],
})
export class ScansModule {}