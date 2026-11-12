import { Controller, Get, Post, Inject, UseGuards, Logger } from "@nestjs/common";
import { z } from "zod";
import { SessionGuard, PlatformAdminGuard } from "../../core/auth/access.guards";
import { DatabaseService } from "../../core/database/database.service";
import { RequestInput, type ValidatedInput } from "../../core/http/endpoint-input";
import { rejectRequest } from "../../core/http/endpoint-result";
import { randomUUID } from "crypto";
import { MediaCleanupService } from "./media-cleanup.service";
import { storedKeyFromUrl, getPublicFileUrl } from "../../lib/s3";
import { Prisma } from "../../generated/prisma/client";

const listInput = { query: z.object({ search: z.string().trim().max(254).default(""), page: z.coerce.number().int().min(1).max(100000).default(1) }) };
const deleteInput = { params: z.object({ id: z.string().uuid() }), body: z.object({ email: z.string().email(), confirmation: z.literal("DELETE") }) };

@Controller("api/platform/users")
@UseGuards(SessionGuard, PlatformAdminGuard)
export class PlatformUsersController {
  private readonly logger = new Logger("AccountManagement");
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService, @Inject(MediaCleanupService) private readonly cleanup: MediaCleanupService) {}

  @Get()
  async list(@RequestInput(listInput) input: ValidatedInput<typeof listInput>) {
    const { search, page } = input.query;
    const where = search ? { OR: [{ email: { contains: search, mode: "insensitive" as const } }, { name: { contains: search, mode: "insensitive" as const } }] } : {};
    const [users, total] = await this.database.identityClient.$transaction([
      this.database.identityClient.user.findMany({ where, skip: (page - 1) * 25, take: 25, orderBy: [{ createdAt: "desc" }, { id: "asc" }], select: { id: true, email: true, name: true, role: true, active: true, createdAt: true, fashionHouseOwned: { select: { shopName: true, _count: { select: { staff: true, orders: true, customers: true } } } } } }),
      this.database.identityClient.user.count({ where }),
    ]);
    return { users, total, page };
  }

  @Post(":id/delete")
  async remove(@RequestInput(deleteInput) input: ValidatedInput<typeof deleteInput>) {
    const id = input.params.id;
    if (id === input.authUserId) return rejectRequest({ error: "You cannot delete your own platform administrator account." }, 400);
    const deleted = await this.database.identityClient.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id }, include: { fashionHouseOwned: { select: { id: true } } } });
      if (!user || user.email !== input.body.email) return false;
      const protectedEmails = (process.env.PLATFORM_ADMIN_EMAILS || "").split(",").map(e => e.trim().toLowerCase());
      if (protectedEmails.includes(user.email.toLowerCase())) return false;
      const houseId = user.fashionHouseOwned?.id;
      const staff = houseId ? await tx.user.findMany({ where: { fashionHouseId: houseId, role: "staff" }, select: { id: true, email: true } }) : [];
      // Other customers' accounts survive house deletion; its linked staff do not.
      const ids = [id, ...staff.map(s => s.id)];
      if (staff.some(s => protectedEmails.includes(s.email.toLowerCase()))) return false;
      // Commit cleanup jobs with the deletion, never delete media before commit.
      // Staff uploads belong to the shared house; retain that prefix unless its
      // owner is being deleted, rather than erasing other staff/customer media.
      const prefixes = [...ids.flatMap(account => [`customers/${account}/`, `pending/customers/${account}/`]), ...(houseId ? [`houses/${houseId}/`, `pending/houses/${houseId}/`] : [])];
      const uploads = await tx.$queryRaw<Array<{ key: string }>>`SELECT key FROM uploaded_media WHERE "ownerId" IN (${Prisma.join(ids)})`;
      const [sketches, photos, messages] = await Promise.all([
        tx.moodBoardSketch.findMany({ where: { staffId: { in: ids } }, select: { imageUrl: true } }),
        tx.customerPreference.findMany({ where: { userId: { in: ids } }, select: { photoKey: true } }),
        tx.directMessage.findMany({ where: { senderId: { in: ids } }, select: { imageUrl: true, audioUrl: true } }),
      ]);
      const individualKeys = new Set([...uploads.map(u => u.key), ...[...sketches.map(s => s.imageUrl), ...photos.map(p => p.photoKey), ...messages.flatMap(m => [m.imageUrl, m.audioUrl])].flatMap(url => { const key = storedKeyFromUrl(url); return key ? [key] : []; })]);
      for (const key of individualKeys) {
        // A promoted sketch may still be a live house catalog image after its
        // creator leaves. Preserve that shared asset until the house is removed.
        if (!houseId && await tx.catalogItem.count({ where: { imageUrl: getPublicFileUrl(key) } })) continue;
        prefixes.push(`key:${key}`);
      }
      for (const prefix of prefixes) {
        await tx.$executeRaw`INSERT INTO media_cleanup_jobs (id, prefix) VALUES (${randomUUID()}, ${prefix})`;
      }
      if (houseId) {
        const catalog = await tx.catalogItem.findMany({ where: { fashionHouseId: houseId }, select: { id: true } });
        const removedIds = catalog.map(item => item.id);
        if (removedIds.length) {
          const preferences = await tx.customerPreference.findMany({ where: { savedCatalogIds: { hasSome: removedIds } }, select: { id: true, savedCatalogIds: true } });
          const removed = new Set(removedIds);
          for (const preference of preferences) await tx.customerPreference.update({ where: { id: preference.id }, data: { savedCatalogIds: preference.savedCatalogIds.filter(value => !removed.has(value)) } });
        }
      }
      const customers = await tx.customer.findMany({ where: { userId: { in: ids } }, select: { id: true } });
      const bookings = await tx.booking.findMany({ where: { customerId: { in: ids } }, select: { id: true, availableSlotId: true } });
      await tx.order.deleteMany({ where: { OR: [{ staffId: { in: ids } }, { customerId: { in: customers.map(c => c.id) } }, { bookingId: { in: bookings.map(b => b.id) } }, ...(houseId ? [{ fashionHouseId: houseId }] : [])] } });
      await tx.availableSlot.updateMany({ where: { id: { in: bookings.flatMap(b => b.availableSlotId ? [b.availableSlotId] : []) } }, data: { booked: false } });
      await tx.directMessageThreadState.deleteMany({ where: { OR: [{ userId: { in: ids } }, { customerId: { in: ids } }, ...(houseId ? [{ fashionHouseId: houseId }] : [])] } });
      await tx.customer.deleteMany({ where: { userId: { in: ids } } });
      await tx.waitlistEntry.deleteMany({ where: { email: { in: [user.email, ...staff.map(s => s.email)] } } });
      // Cascades remove bookings, messages, preferences, measurements, invoices,
      // sketches and the owned house. The transaction rolls back on any failure.
      await tx.user.deleteMany({ where: { id: { in: ids } } });
      return true;
    }, { timeout: 20000, isolationLevel: "Serializable" });
    if (!deleted) return rejectRequest({ error: "Account not found, confirmation did not match, or this is a protected platform account." }, 400);
    this.logger.log(`Platform administrator ${input.authUserId} permanently deleted account ${id}.`);
    void this.cleanup.drain();
    return { message: "Account deleted. Uploaded-file cleanup is queued and retries automatically." };
  }
}
