import { Router } from "express";
import { z } from "zod";
import { db, devices } from "../db/index.js";
import { eq, and } from "drizzle-orm";
import { validate } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";

export const deviceRouter = Router();

deviceRouter.use(requireAuth);

const registerDeviceSchema = z.object({
  fcmToken: z.string().min(10),
  platform: z.enum(["android", "ios", "web"]).default("android"),
});

deviceRouter.post(
  "/",
  validate({ body: registerDeviceSchema }),
  async (req, res, next) => {
    try {
      const { fcmToken, platform } = req.body;
      const userId = req.user!.id;

      const [existing] = await db
        .select()
        .from(devices)
        .where(and(eq(devices.userId, userId), eq(devices.fcmToken, fcmToken)))
        .limit(1);

      if (existing) {
        await db
          .update(devices)
          .set({ lastSeenAt: new Date() })
          .where(eq(devices.id, existing.id));

        return res.json({ message: "Device refreshed", id: existing.id });
      }

      const [newDevice] = await db
        .insert(devices)
        .values({
          userId,
          fcmToken,
          platform,
        })
        .returning();

      res.status(201).json({ message: "Device registered", id: newDevice.id });
    } catch (error) {
      next(error);
    }
  }
);
