import { Express } from "express";
import { createServer, type Server } from "http";
import { registerPromotionRoutes } from "./promotions";

export async function registerRoutes(app: Express): Promise<Server> {
  // Create HTTP server
  const server = createServer(app);
  
  // Register promotion routes
  registerPromotionRoutes(app);
  
  return server;
}