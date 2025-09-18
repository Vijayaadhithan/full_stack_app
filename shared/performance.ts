import { z } from "zod";

export const performanceMetricSchema = z.object({
  name: z.enum(["FCP", "LCP", "CLS", "FID", "TTFB"]),
  value: z.number(),
  rating: z.enum(["good", "needs-improvement", "poor"]),
  page: z.string(),
  timestamp: z.number(),
  details: z
    .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .optional(),
});

export type PerformanceMetric = z.infer<typeof performanceMetricSchema>;
