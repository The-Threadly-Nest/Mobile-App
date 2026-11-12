import { Injectable, type OnApplicationShutdown } from "@nestjs/common";
import { databasePool, identityPool, identityPrisma, prisma } from "../../lib/prisma";

@Injectable()
export class DatabaseService implements OnApplicationShutdown {
  readonly client = prisma;
  // Credential/verification, guarded platform administration, private media
  // manifests/cleanup and internal notifications use this connection.
  // Never expose it to clients or use it for ordinary tenant queries.
  readonly identityClient = identityPrisma;

  async onApplicationShutdown() {
    await this.client.$disconnect();
    await databasePool.end();
    if (identityPool !== databasePool) await identityPrisma.$disconnect();
    if (identityPool !== databasePool) await identityPool.end();
  }
}
