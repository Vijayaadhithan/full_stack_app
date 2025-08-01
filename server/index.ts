import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes"; // Changed from ./routes/index
//import { setupVite, serveStatic, log } from "./vite";
import { storage as dbStorage } from "./storage";
import { config } from "dotenv";
import logger from "./logger";
import path from "path";
import cors from "cors";
import multer, { MulterError } from "multer";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
// Import your email service here
//import { sendEmail } from "./emailService";
import { startBookingExpirationJob } from "./jobs/bookingExpirationJob";
import { startPaymentReminderJob } from "./jobs/paymentReminderJob";

config();
// Read allowed CORS origins from environment variable (comma separated)
// Allow requests from production frontend and local development
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5173",
].filter(Boolean) as string[];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
app.use(express.json());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Health check
 *     responses:
 *       200:
 *         description: Basic service info
 */
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: Date.now(),
  });
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, "../uploads/"));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type"));
    }
  },
});

/**
 * @openapi
 * /api/upload:
 *   post:
 *     summary: Upload a file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload successful
 */
app.post("/api/upload", (req, res) => {
  upload.single("file")(req, res, (err: any) => {
    if (err) {
      const message =
        err instanceof MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "File too large"
          : err.message;
      return res.status(400).json({ message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    res.json({
      filename: req.file.filename,
      path: `/uploads/${req.file.filename}`,
    });
  });
});

/**
 * @openapi
 * /api/users/upload-qr:
 *   post:
 *     summary: Upload provider QR code
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               qr:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Upload successful
 */
app.post("/api/users/upload-qr", (req, res) => {
  upload.single("qr")(req, res, (err: any) => {
    if (err) {
      const message =
        err instanceof MulterError && err.code === "LIMIT_FILE_SIZE"
          ? "File too large"
          : err.message;
      return res.status(400).json({ message });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
  });
});

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Initialize scheduled jobs
export async function startServer(port?: number) {
  // Initialize scheduled jobs
  if (process.env.NODE_ENV !== "test") {
    startBookingExpirationJob(dbStorage);
    startPaymentReminderJob(dbStorage);
  }

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  const PORT = port ?? parseInt(process.env.PORT || "5000", 10);

  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
      resolve();
    });
  });
return server;
}

if (process.env.NODE_ENV !== "test") {
  startServer();
}
