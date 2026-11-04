import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { databasePool, identityPool, identityPrisma, prisma } from "../../lib/prisma";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client = prisma;
  // Only credential/verification, platform waitlist and internal notification
  // code may use the privileged identity connection. Never expose it to clients.
  readonly identityClient = identityPrisma;

  async onApplicationShutdown() {
    await this.client.$disconnect();
    await databasePool.end();
    if (identityPool !== databasePool) await identityPrisma.$disconnect();
    if (identityPool !== databasePool) await identityPool.end();
  }
}
