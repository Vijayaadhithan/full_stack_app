import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes"; // Changed from ./routes/index
import { setupVite, serveStatic, log } from "./vite";
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
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : undefined;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

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
startBookingExpirationJob(dbStorage);
startPaymentReminderJob(dbStorage);

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  const PORT = process.env.PORT || 5000;

  if (process.env.NODE_ENV === "production") {
    // In production, serve the static files from the dist directory
    app.use(express.static(path.join(__dirname, "public")));

    // For any other request, send the index.html file
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "public", "index.html"));
    });

    server.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } else {
    // In development, use Vite's dev server
    await setupVite(app, server);

    server.listen(
      {
        port: PORT,
        host: "0.0.0.0", // Changed from 127.0.0.1
        reusePort: true,
      },
      () => {
        log(`Server running on port ${PORT}`);
      },
    );
  }
})();
