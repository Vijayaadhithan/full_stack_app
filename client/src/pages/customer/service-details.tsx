import React, { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  useTransform,
} from "framer-motion";
import { Loader2, MapPin, Star, Clock, Sparkles } from "lucide-react";
import Meta from "@/components/meta";
import { ServiceDetail } from "@shared/api-contract";
import { apiClient } from "@/lib/apiClient";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type SectionKey = "overview" | "reviews" | "faq";
const MotionButton = motion(Button);

export default function ServiceDetails() {
  const { id } = useParams<{ id: string }>();
  console.log("Service ID from params:", id);

  const {
    data: service,
    isLoading,
    isError,
    error,
    isSuccess,
  } = useQuery<ServiceDetail, Error>({
    queryKey: [`/api/services/${id}`],
    queryFn: () =>
      apiClient.get("/api/services/:id", {
        params: { id: Number(id) },
      }),
    enabled: !!id,
    retry: false,
  });

  const { scrollY, scrollYProgress } = useScroll();
  const [activeSection, setActiveSection] =
    useState<SectionKey>("overview");
  const [showBookingBar, setShowBookingBar] = useState(false);
  const overviewRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isError && error) {
      console.error("Error fetching service:", error);
      console.error("Query key:", [`/api/services/${id}`]);
    }
  }, [isError, error, id]);

  useEffect(() => {
    if (isSuccess && service) {
      console.log("Successfully fetched service:", service);
    }
  }, [isSuccess, service]);

  useMotionValueEvent(scrollY, "change", (current) => {
    setShowBookingBar(current > 260);
    const sections: { key: SectionKey; ref: React.RefObject<HTMLDivElement> }[] =
      [
        { key: "overview", ref: overviewRef },
        { key: "reviews", ref: reviewsRef },
        { key: "faq", ref: faqRef },
      ];
    const threshold =
      typeof window !== "undefined" ? window.innerHeight * 0.4 : 320;
    const visible = sections
      .map((entry) => {
        const rect = entry.ref.current?.getBoundingClientRect();
        return { key: entry.key, top: rect?.top ?? Number.POSITIVE_INFINITY };
      })
      .filter((entry) => entry.top < threshold)
      .sort((a, b) => b.top - a.top)?.[0]?.key;
    if (visible) {
      setActiveSection((prev) => (prev === visible ? prev : visible));
    }
  });

  const heroMedia = service?.images?.[0];
  const isVideoHero =
    typeof heroMedia === "string" &&
    /\.(mp4|webm|mov)$/i.test(heroMedia.split("?")[0] ?? "");
  const heroFallback =
    heroMedia ||
    "https://images.unsplash.com/photo-1489515217757-5fd1be406fef?auto=format&fit=crop&w=1400&q=80";
  const heroTranslate = useTransform(scrollY, [0, 320], [0, -140]);
  const heroBlur = useTransform(scrollY, [0, 240], ["blur(0px)", "blur(10px)"]);
  const heroOpacity = useTransform(scrollY, [0, 240], [1, 0.75]);
  const faqItems = useMemo(
    () => [
      {
        question: "Can I reschedule this service?",
        answer:
          "Yes, rescheduling is supported up to 6 hours before the slot. Your provider will confirm instantly.",
      },
      {
        question: "Do I need to provide materials?",
        answer:
          "Providers bring their own kit unless otherwise noted in the service description.",
      },
      {
        question: "Is on-site support available?",
        answer:
          "For customer-location services, the provider will travel to you with navigation help built in.",
      },
    ],
    [],
  );

  const handleTabChange = (value: string) => {
    const refMap: Record<SectionKey, React.RefObject<HTMLDivElement>> = {
      overview: overviewRef,
      reviews: reviewsRef,
      faq: faqRef,
    };
    const target = refMap[value as SectionKey]?.current;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setActiveSection(value as SectionKey);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <Meta title="Loading Service..." />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!service) {
    return (
      <DashboardLayout>
        <Meta title="Service Not Found" />
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <h2 className="text-2xl font-bold mb-4">Service not found</h2>
          <Link href="/customer/browse-services">
            <Button>Back to Services</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const providerName = service.provider?.name ?? "Provider";
  const providerInitial = providerName.charAt(0).toUpperCase();

  return (
    <DashboardLayout>
      <Meta
        title={`${service.name} - Service`}
        description={`Learn about ${service.name} offered by ${providerName}.`}
        schema={{
          "@context": "https://schema.org",
          "@type": "Service",
          name: service.name,
          description: service.description,
          provider: {
            "@type": "Person",
            name: providerName,
          },
        }}
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative space-y-8 pb-12"
      >
        <motion.div
          className="fixed left-0 right-0 top-[64px] z-40 h-1 origin-left bg-gradient-to-r from-primary via-emerald-400 to-sky-400"
          style={{ scaleX: scrollYProgress }}
        />

        <div className="relative overflow-hidden rounded-3xl border bg-background/70 shadow-xl">
          <motion.div
            className="absolute inset-0"
            style={{
              y: heroTranslate,
              filter: heroBlur,
              opacity: heroOpacity,
            }}
          >
            {isVideoHero ? (
              <video
                src={heroFallback}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
              />
            ) : (
              <img
                src={heroFallback}
                alt={service.name}
                className="h-full w-full object-cover"
              />
            )}
          </motion.div>
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/50 to-background" />
          <div className="relative z-10 space-y-5 px-4 py-10 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-center gap-3 text-white">
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold shadow-sm backdrop-blur">
                {service.category}
              </span>
              <div className="flex items-center gap-1 text-sm">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                <span>
                  {service.rating?.toFixed(1) ?? "New"} •{" "}
                  {service.reviews?.length ?? 0} reviews
                </span>
              </div>
            </div>
            <div className="space-y-3 text-white">
              <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
                {service.name}
              </h1>
              <p className="max-w-3xl text-base text-white/80 sm:text-lg">
                {service.description}
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-white/90">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm backdrop-blur">
                <Clock className="h-4 w-4" />
                {service.duration} mins
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-2 text-sm backdrop-blur">
                <MapPin className="h-4 w-4" />
                {service.addressStreet
                  ? `${service.addressCity ?? ""} ${service.addressState ?? ""}`.trim() ||
                    "On-site"
                  : "Location shared after booking"}
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-white/70">Starting at</p>
                <p className="text-3xl font-bold text-white">₹{service.price}</p>
              </div>
              <Link href={`/customer/book-service/${id}`}>
                <MotionButton
                  size="lg"
                  whileTap={{ scale: 0.95 }}
                  className="w-full sm:w-auto"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Book instantly
                </MotionButton>
              </Link>
            </div>
          </div>
        </div>

        <div className="sticky top-[76px] z-30">
          <Tabs value={activeSection} onValueChange={handleTabChange}>
            <TabsList className="grid w-full grid-cols-3 bg-muted/80 backdrop-blur supports-[backdrop-filter]:bg-muted/60">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="reviews">Reviews</TabsTrigger>
              <TabsTrigger value="faq">FAQ</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-8">
          <section
            ref={overviewRef}
            id="overview"
            className="scroll-mt-28 space-y-4"
          >
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    Overview
                  </CardTitle>
                  <CardDescription>
                    Everything you need to know before booking.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      {service.provider?.profilePicture ? (
                        <img
                          src={service.provider.profilePicture}
                          alt={providerName}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl">{providerInitial}</span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium">{providerName}</p>
                      <p className="text-sm text-muted-foreground">
                        {service.provider?.phone || "Phone shared on booking"}
                      </p>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Service duration
                      </p>
                      <p className="text-base font-semibold">
                        {service.duration} minutes
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">Price</p>
                      <p className="text-base font-semibold">₹{service.price}</p>
                    </div>
                    <div className="rounded-xl border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Location
                      </p>
                      <p className="text-sm font-semibold">
                        {service.addressStreet
                          ? `${service.addressStreet}, ${service.addressCity ?? ""}, ${service.addressState ?? ""} ${service.addressPostalCode ?? ""}, ${service.addressCountry ?? ""}`
                          : "Location shared after booking"}
                      </p>
                    </div>
                    <div className="rounded-xl border bg-muted/40 p-3">
                      <p className="text-xs text-muted-foreground">
                        Availability
                      </p>
                      <p className="text-sm font-semibold">
                        {service.workingHours
                          ? "Working hours on file"
                          : "Flexible schedule"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="shadow-sm">
                <CardHeader>
                  <CardTitle>What to expect</CardTitle>
                  <CardDescription>
                    A quick snapshot of the appointment flow.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm text-muted-foreground">
                  <div className="rounded-lg bg-primary/5 p-3 text-primary">
                    Instant confirmation once you tap book — no phone calls.
                  </div>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      Provider arrives prepared with the essentials.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      Real-time status updates inside your bookings timeline.
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
                      Secure payments with receipts stored in your history.
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </section>

          <section
            ref={reviewsRef}
            id="reviews"
            className="scroll-mt-28 space-y-4"
          >
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
                  Ratings & Reviews
                </CardTitle>
                <CardDescription>
                  {service.rating && service.reviews?.length
                    ? `${service.rating.toFixed(1)} out of 5 • ${service.reviews.length} review${
                        service.reviews.length !== 1 ? "s" : ""
                      }`
                    : "No reviews yet"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!service.reviews?.length ? (
                  <p className="text-sm text-muted-foreground">
                    Customers haven’t reviewed this service yet.
                  </p>
                ) : (
                  service.reviews.map((review) => (
                    <div
                      key={review.id}
                      className="rounded-lg border p-4 space-y-2 bg-muted/30"
                    >
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <Star
                              key={index}
                              className={`h-4 w-4 ${
                                index < review.rating
                                  ? "fill-yellow-400 text-yellow-500"
                                  : "text-muted-foreground"
                              }`}
                            />
                          ))}
                        </div>
                        {review.createdAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {review.review ? (
                        <p className="text-sm text-muted-foreground">
                          {review.review}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          No written feedback provided.
                        </p>
                      )}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </section>

          <section ref={faqRef} id="faq" className="scroll-mt-28 space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle>FAQ</CardTitle>
                <CardDescription>
                  Answers to common booking questions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {faqItems.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-lg border bg-muted/30 p-3"
                  >
                    <p className="font-semibold">{item.question}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.answer}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </section>
        </div>

        <AnimatePresence>
          {showBookingBar && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-4 left-4 right-4 z-40 md:hidden"
            >
              <Card className="border-primary/30 shadow-2xl backdrop-blur">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">From</p>
                    <p className="text-xl font-bold">₹{service.price}</p>
                  </div>
                  <Link href={`/customer/book-service/${id}`}>
                    <MotionButton whileTap={{ scale: 0.95 }} size="lg">
                      Book Now
                    </MotionButton>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </DashboardLayout>
  );
}
