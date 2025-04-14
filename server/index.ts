import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { storage as dbStorage } from "./storage";
import { config } from "dotenv";
import path from "path";
import cors from "cors";
import multer from "multer";
import { fileURLToPath } from "url";

config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(cors());

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

// Handle file uploads
app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }
  res.json({
    filename: req.file.filename,
    path: `/uploads/${req.file.filename}`,
  });
});

// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Set up scheduled task to process expired bookings
const BOOKING_EXPIRATION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

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
    app.use(express.static(path.join(__dirname, "../client/dist")));

    // For any other request, send the index.html file
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../client/dist/index.html"));
    });

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } else {
    // In development, use Vite's dev server
    await setupVite(app, server);
    
    server.listen({
      port: PORT,
      host: "127.0.0.1",
      reusePort: true,
    }, () => {
      log(`Server running on port ${PORT}`);
    });
  }
})();