import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { X } from "lucide-react";

const translations = {
  en: {
    next: "Next",
    skip: "Skip",
    done: "Got it!",
    steps: [
      {
        title: "Welcome to our Platform",
        description: "We'll help you get started with a quick tour.",
      },
      {
        title: "Browse Services",
        description: "Find and book services from trusted providers in your area.",
      },
      {
        title: "Shop Products",
        description: "Browse and purchase products from local shops.",
      },
      {
        title: "Track Orders",
        description: "Keep track of your bookings and orders in one place.",
      },
    ],
  },
  hi: {
    next: "आगे",
    skip: "छोड़ें",
    done: "समझ गया!",
    steps: [
      {
        title: "हमारे प्लेटफॉर्म में आपका स्वागत है",
        description: "हम आपको एक त्वरित टूर के साथ शुरू करने में मदद करेंगे।",
      },
      {
        title: "सेवाएं ब्राउज़ करें",
        description: "अपने क्षेत्र में विश्वसनीय प्रदाताओं से सेवाएं खोजें और बुक करें।",
      },
      {
        title: "उत्पाद खरीदें",
        description: "स्थानीय दुकानों से उत्पाद ब्राउज़ करें और खरीदें।",
      },
      {
        title: "ऑर्डर ट्रैक करें",
        description: "अपनी बुकिंग और ऑर्डर को एक जगह पर ट्रैक करें।",
      },
    ],
  },
  ta: {
    next: "அடுத்து",
    skip: "தவிர்",
    done: "புரிந்தது!",
    steps: [
      {
        title: "எங்கள் தளத்திற்கு வரவேற்கிறோம்",
        description: "ஒரு விரைவான சுற்றுப்பயணத்துடன் நீங்கள் தொடங்க உதவுவோம்.",
      },
      {
        title: "சேவைகளை உலாவுங்கள்",
        description: "உங்கள் பகுதியில் உள்ள நம்பகமான வழங்குநர்களிடமிருந்து சேவைகளைக் கண்டறிந்து முன்பதிவு செய்யுங்கள்.",
      },
      {
        title: "பொருட்களை வாங்குங்கள்",
        description: "உள்ளூர் கடைகளில் இருந்து பொருட்களை உலாவி வாங்குங்கள்.",
      },
      {
        title: "ஆர்டர்களை கண்காணிக்கவும்",
        description: "உங்கள் முன்பதிவுகள் மற்றும் ஆர்டர்களை ஒரே இடத்தில் கண்காணிக்கவும்.",
      },
    ],
  },
};

interface TutorialProps {
  language?: "en" | "hi" | "ta";
  onComplete: () => void;
}

export function Tutorial({ language = "en", onComplete }: TutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const t = translations[language];
  const isLastStep = currentStep === t.steps.length - 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
    >
      <Card className="w-full max-w-lg relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={onComplete}
        >
          <X className="h-4 w-4" />
        </Button>
        <CardContent className="pt-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-bold">
                {t.steps[currentStep].title}
              </h2>
              <p className="text-muted-foreground">
                {t.steps[currentStep].description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8">
            <Button variant="ghost" onClick={onComplete}>
              {t.skip}
            </Button>
            <div className="space-x-2">
              {!isLastStep ? (
                <Button onClick={() => setCurrentStep(s => s + 1)}>
                  {t.next}
                </Button>
              ) : (
                <Button onClick={onComplete}>
                  {t.done}
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-center mt-4 space-x-1">
            {t.steps.map((_, i) => (
              <motion.div
                key={i}
                className={`h-1 w-8 rounded-full ${
                  i === currentStep ? "bg-primary" : "bg-border"
                }`}
                animate={{
                  backgroundColor: i === currentStep ? "hsl(var(--primary))" : "hsl(var(--border))"
                }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
