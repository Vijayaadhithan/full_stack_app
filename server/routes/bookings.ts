import { Router } from "express";

// Router for booking-related endpoints
export const bookingsRouter = Router();

/**
 * Basic test route for the bookings module. Real booking routes are
 * implemented in `routes.ts`. The test route is namespaced under `/test`
 * so it doesn't conflict with the real `/api/bookings` endpoint used by
 * the application.
 */
bookingsRouter.get("/test", (_req, res) => {
  res.json({ message: "bookings route" });
});

export default bookingsRouter;