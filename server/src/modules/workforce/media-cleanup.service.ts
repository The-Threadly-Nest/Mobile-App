import { Inject, Injectable, Logger, type OnModuleInit, type OnModuleDestroy } from "@nestjs/common";
import { DatabaseService } from "../../core/database/database.service";
import { deleteStoragePrefix } from "../../lib/s3";

@Injectable()
export class MediaCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger("MediaCleanup");
  private timer?: ReturnType<typeof setInterval>;
  private busy = false;
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}
  onModuleInit() {
    void this.drain();
    this.timer = setInterval(() => void this.drain(), 30000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async drain() {
    if (this.busy) return;
    this.busy = true;
    try {
      // Claim one job atomically, so replicas cannot process it simultaneously.
      const jobs = await this.database.identityClient.$queryRaw<Array<{ id: string; prefix: string; createdAt: Date; attempts: number }>>`
        UPDATE media_cleanup_jobs SET "nextAttemptAt" = NOW() + INTERVAL '5 minutes', attempts = attempts + 1
        WHERE id = (SELECT id FROM media_cleanup_jobs WHERE "nextAttemptAt" <= NOW() ORDER BY "nextAttemptAt" LIMIT 1 FOR UPDATE SKIP LOCKED)
        RETURNING id, prefix, "createdAt", attempts`;
      for (const job of jobs) {
        try {
          await deleteStoragePrefix(job.prefix);
          // Sweep again after all outstanding 5-minute upload URLs expire.
          if (Date.now() - job.createdAt.getTime() >= 15 * 60000) {
            await this.database.identityClient.$executeRaw`DELETE FROM media_cleanup_jobs WHERE id = ${job.id}`;
          } else {
            await this.database.identityClient.$executeRaw`UPDATE media_cleanup_jobs SET "nextAttemptAt" = "createdAt" + INTERVAL '15 minutes' WHERE id = ${job.id}`;
          }
        } catch {
          this.logger.warn(`Uploaded-file cleanup is pending for job ${job.id}; it will retry automatically.`);
        }
      }
    } catch {
      this.logger.warn("Uploaded-file cleanup is unavailable. Check the cleanup migration and private storage settings.");
    } finally { this.busy = false; }
  }
}
