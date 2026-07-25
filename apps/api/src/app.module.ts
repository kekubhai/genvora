import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { RedisModule } from "./redis/redis.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ScansModule } from "./scans/scans.module";
import { SitesModule } from "./sites/sites.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    SitesModule,
    ScansModule,
  ],
})
export class AppModule {}
