import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes"; // Changed from ./routes/index
import { setupVite, serveStatic, log } from "./vite";
import { storage as dbStorage } from "./storage";
import { config } from "dotenv";
import path from "path";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./swagger";
// Import your email service here
import { sendEmail } from "./emailService";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());
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

const upload = multer({ storage: storage });

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
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  res.json({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
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
app.post("/api/users/upload-qr", upload.single("qr"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  const url = `/uploads/${req.file.filename}`;
  res.json({ url });
});

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Set up scheduled task to process expired bookings
const BOOKING_EXPIRATION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
const PAYMENT_REMINDER_DAYS = parseInt(process.env.PAYMENT_REMINDER_DAYS || '3');
const PAYMENT_DISPUTE_DAYS = parseInt(process.env.PAYMENT_DISPUTE_DAYS || '7');

function setupScheduledTasks() {
  // Process expired bookings every 24 hours
  setInterval(async () => {
    try {
      console.log("Running scheduled task: Processing expired bookings");
      await dbStorage.processExpiredBookings();
      console.log("Completed processing expired bookings");
    } catch (error) {
      console.error("Error processing expired bookings:", error);
    }
  }, BOOKING_EXPIRATION_CHECK_INTERVAL);

  // Daily check for payment reminders and disputes
  setInterval(async () => {
    try {
      const now = new Date();
      const reminderCutoff = new Date(now.getTime() - PAYMENT_REMINDER_DAYS * 24 * 60 * 60 * 1000);
      const disputeCutoff = new Date(now.getTime() - PAYMENT_DISPUTE_DAYS * 24 * 60 * 60 * 1000);

      const awaiting = await dbStorage.getBookingsByStatus('awaiting_payment');

      for (const b of awaiting) {
        const updatedAt = (b as any).updatedAt ? new Date((b as any).updatedAt) : new Date();
        if (updatedAt < disputeCutoff) {
          await dbStorage.updateBooking(b.id, { status: 'disputed', disputeReason: 'Payment confirmation overdue.' });
        } else if (updatedAt < reminderCutoff) {
          const provider = await dbStorage.getService(b.serviceId!).then(s => s ? dbStorage.getUser(s.providerId!) : null);
          if (provider && (provider as any).email) {
            // Replace with your actual email content generator or define emailService accordingly
            const mail = {
              to: provider.name,
              subject: 'Payment Pending',
              text: `Booking #${b.id} is awaiting your payment confirmation.`
            };
            mail.to = provider.email;
            await sendEmail(mail);
          }
        }
      }
    } catch (err) {
      console.error('Error running payment reminder task:', err);
    }
  }, BOOKING_EXPIRATION_CHECK_INTERVAL);

  // Also run once at startup
  dbStorage.processExpiredBookings()
    .then(() => console.log("Initial expired bookings processing completed"))
    .catch(error => console.error("Error in initial expired bookings processing:", error));
}

// Start the scheduled tasks
setupScheduledTasks();

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
      console.log(`Server is running on port ${PORT}`);
    });
  } else {
    // In development, use Vite's dev server
    await setupVite(app, server);
    
    server.listen({
      port: PORT,
      host: "0.0.0.0", // Changed from 127.0.0.1
      reusePort: true,
    }, () => {
      log(`Server running on port ${PORT}`);
    });
  }
})();