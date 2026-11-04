import { Inject, Injectable } from "@nestjs/common";
import { routeParam } from "../../core/http/route-param";
import type { SlotsInput } from "./slots.dto";
import { result, rejectRequest } from "../../core/http/endpoint-result";
import { DatabaseService } from "../../core/database/database.service";

import { getOwnFashionHouseId } from "../../core/auth/account-identity";

import { isUniqueConstraintError } from "../../lib/idempotency";
import { isAvailabilityConflictError, serializeSlot, slotsOverlap, zonedDateTimeToUtc } from "../../lib/availability";

// List Available Slots (Admin/Staff only)

// Create Available Slot (Admin/Staff only)

// Update Available Slot (Admin/Staff only)

// Delete Available Slot (Admin/Staff only)

@Injectable()
export class SlotsService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) { }

  async get(input: SlotsInput<"get">) {

    const fhId = getOwnFashionHouseId(input);
    const fashionHouse = await this.database.client.fashionHouse.findUniqueOrThrow({
      where: { id: fhId }, select: { timezone: true },
    });
    const slots = await this.database.client.availableSlot.findMany({
      where: { fashionHouseId: fhId, startsAt: { gt: new Date() } },
      orderBy: { startsAt: "asc" },
    });
    return slots.map((slot) => serializeSlot(slot, fashionHouse.timezone));

  }

  async post(input: SlotsInput<"post">) {
    try {
      const fhId = getOwnFashionHouseId(input);
      const { date, time } = input.body;
      const fashionHouse = await this.database.client.fashionHouse.findUniqueOrThrow({
        where: { id: fhId }, select: { timezone: true, slotDurationMinutes: true },
      });
      const durationMinutes = input.body.durationMinutes ?? fashionHouse.slotDurationMinutes;
      const startsAt = zonedDateTimeToUtc(date, time, fashionHouse.timezone);
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      if (startsAt <= new Date()) {
        return rejectRequest({ error: "Fitting slots must be scheduled in the future." }, 400);
      }

      const possibleConflicts = await this.database.client.availableSlot.findMany({
        where: {
          fashionHouseId: fhId,
          active: true,
          startsAt: {
            gte: new Date(startsAt.getTime() - 8 * 60 * 60_000),
            lt: new Date(startsAt.getTime() + durationMinutes * 60_000),
          },
        },
        select: { startsAt: true, durationMinutes: true },
      });
      if (possibleConflicts.some((slot) => slotsOverlap(startsAt, durationMinutes, slot))) {
        return rejectRequest({ error: "This fitting time overlaps another active slot." }, 409);
      }

      let slot;
      try {
        slot = await this.database.client.availableSlot.create({
          data: {
            fashionHouseId: fhId,
            date,
            time,
            startsAt,
            endsAt,
            durationMinutes,
            active: true,
            booked: false,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error) || isAvailabilityConflictError(error)) {
          return rejectRequest({ error: "This fitting time overlaps another active slot." }, 409);
        }
        throw error;
      }

      return result(serializeSlot(slot, fashionHouse.timezone), 201);
    } catch (err) {
      if (isUniqueConstraintError(err) || isAvailabilityConflictError(err)) {
        return rejectRequest({ error: "This fitting time overlaps another active slot." }, 409);
      }
      throw err;
    }
  }

  async patchById(input: SlotsInput<"patchById">) {
    try {
      const fhId = getOwnFashionHouseId(input);

      // Tenant Isolation: Verify slot belongs to this tenant
      const existing = await this.database.client.availableSlot.findFirst({
        where: { id: routeParam(input, "id"), fashionHouseId: fhId },
      });
      if (!existing) {
        return rejectRequest({ error: "Slot not found." }, 404);
      }

      const fashionHouse = await this.database.client.fashionHouse.findUniqueOrThrow({
        where: { id: fhId }, select: { timezone: true, slotDurationMinutes: true },
      });
      const { date, time, booked, active } = input.body;
      const targetDate = date ?? existing.date;
      const targetTime = time ?? existing.time;
      const durationMinutes = input.body.durationMinutes ?? existing.durationMinutes ?? fashionHouse.slotDurationMinutes;
      const startsAt = date !== undefined || time !== undefined || !existing.startsAt
        ? zonedDateTimeToUtc(targetDate, targetTime, fashionHouse.timezone)
        : existing.startsAt;
      const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);
      if (startsAt <= new Date()) {
        return rejectRequest({ error: "Fitting slots must be scheduled in the future." }, 400);
      }
      const linkedBooking = await this.database.client.booking.findUnique({
        where: { availableSlotId: existing.id },
        select: { id: true },
      });

      if (linkedBooking && (date !== undefined || time !== undefined || input.body.durationMinutes !== undefined || booked === false || active === false)) {
        return rejectRequest({
          error: "A booked fitting slot cannot be moved or reopened. Cancel the booking first.",
        }, 409);
      }

      if (date !== undefined || time !== undefined || input.body.durationMinutes !== undefined || active === true) {
        const possibleConflicts = await this.database.client.availableSlot.findMany({
          where: {
            fashionHouseId: fhId,
            active: true,
            startsAt: {
              gte: new Date(startsAt.getTime() - 8 * 60 * 60_000),
              lt: new Date(startsAt.getTime() + durationMinutes * 60_000),
            },
            NOT: { id: routeParam(input, "id") },
          },
          select: { startsAt: true, durationMinutes: true },
        });
        if (possibleConflicts.some((slot) => slotsOverlap(startsAt, durationMinutes, slot))) {
          return rejectRequest({ error: "This fitting time overlaps another active slot." }, 409);
        }
      }

      if (booked === true && !existing.booked) {
        const result = await this.database.client.availableSlot.updateMany({
          where: { id: routeParam(input, "id"), fashionHouseId: fhId, booked: false },
          data: {
            booked: true,
            ...(date !== undefined ? { date } : {}),
            ...(time !== undefined ? { time } : {}),
            startsAt,
            endsAt,
            durationMinutes,
            ...(active !== undefined ? { active } : {}),
          },
        });

        if (result.count === 0) {
          return rejectRequest({ error: "This slot was just booked by someone else. Please choose another." }, 409);
        }

        const updated = await this.database.client.availableSlot.findUnique({ where: { id: routeParam(input, "id") } });
        return updated ? serializeSlot(updated, fashionHouse.timezone) : updated;
      }

      let updated;
      try {
        updated = await this.database.client.availableSlot.update({
          where: { id: routeParam(input, "id"), fashionHouseId: fhId },
          data: {
            date: date !== undefined ? date : existing.date,
            time: time !== undefined ? time : existing.time,
            startsAt,
            endsAt,
            durationMinutes,
            active: active !== undefined ? active : existing.active,
            booked: booked !== undefined ? booked : existing.booked,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error) || isAvailabilityConflictError(error)) {
          return rejectRequest({ error: "This fitting time overlaps another active slot." }, 409);
        }
        throw error;
      }

      return serializeSlot(updated, fashionHouse.timezone);
    } catch (err) {
      if (isUniqueConstraintError(err) || isAvailabilityConflictError(err)) {
        return rejectRequest({ error: "This fitting time overlaps another active slot." }, 409);
      }
      throw err;
    }
  }

  async deleteById(input: SlotsInput<"deleteById">) {

    const fhId = getOwnFashionHouseId(input);

    // Tenant Isolation: Verify slot belongs to this tenant
    const existing = await this.database.client.availableSlot.findFirst({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
    });
    if (!existing) {
      return rejectRequest({ error: "Slot not found." }, 404);
    }

    const linkedBooking = await this.database.client.booking.findUnique({
      where: { availableSlotId: existing.id },
      select: { id: true },
    });
    if (linkedBooking) {
      return rejectRequest({ error: "A slot with a booking cannot be deleted. Cancel the booking first." }, 409);
    }

    await this.database.client.availableSlot.delete({
      where: { id: routeParam(input, "id"), fashionHouseId: fhId },
    });

    return result(undefined, 204);

  }

}

