import type { Request, RequestHandler } from "express";
import { Router } from "express";

// Router for order-related endpoints
export const ordersRouter = Router();

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

ordersRouter.use(requireAuth);

/**
 * Basic test route for orders module. Real order routes will be
 * implemented here in the future.
 */
ordersRouter.get("/", (_req, res) => {
  res.json({ message: "orders route" });
});

export default ordersRouter;
