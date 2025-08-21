import { Router } from "express";

// Router for order-related endpoints
export const ordersRouter = Router();

/**
 * Basic test route for orders module. Real order routes will be
 * implemented here in the future.
 */
ordersRouter.get("/", (_req, res) => {
  res.json({ message: "orders route" });
});

export default ordersRouter;