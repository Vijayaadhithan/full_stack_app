import { Router } from "express";

// Router for booking-related endpoints
export const bookingsRouter = Router();

/**
 * Basic test route for bookings module. Real booking routes will be
 * implemented here in the future.
 */
bookingsRouter.get("/", (_req, res) => {
  res.json({ message: "bookings route" });
});

export default bookingsRouter;