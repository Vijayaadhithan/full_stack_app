import type { Request, RequestHandler } from "express";
import { Router } from "express";

// Router for booking-related endpoints
export const bookingsRouter = Router();

type AuthedRequest = Request & {
  isAuthenticated?: () => boolean;
  user?: { isSuspended?: boolean } | undefined;
};

const requireAuth: RequestHandler = (req, res, next) => {
  const request = req as AuthedRequest;
  if (!request.isAuthenticated?.()) {
    return res.status(401).send("Unauthorized");
  }
  if (request.user?.isSuspended) {
    return res.status(403).json({ message: "Account suspended" });
  }
  next();
};

bookingsRouter.use(requireAuth);

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
