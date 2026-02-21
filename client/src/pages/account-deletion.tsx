import React from "react";
import { Link } from "wouter";
import { ArrowLeft, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";

export default function AccountDeletionPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-orange-500/10 to-transparent" />
        <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-orange-600/10 blur-[120px]" />
      </div>

      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="h-9 w-9 overflow-hidden rounded-xl border border-white/10 bg-white/5 p-0.5">
              <img src={doorstepLogo} alt="DoorStepTN" className="h-full w-full rounded-lg object-cover" />
            </div>
            <span className="text-lg font-bold text-white">DoorStepTN</span>
          </Link>
          <Button asChild variant="ghost" className="text-slate-400 hover:text-white">
            <Link href="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Link>
          </Button>
        </div>
      </motion.nav>

      <main className="relative z-10 pt-24 pb-16 px-6">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-center mb-16">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-orange-500/10 text-orange-400 mb-6">
                <Trash2 className="h-8 w-8" />
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Account Deletion</h1>
              <p className="text-slate-400">Last updated: February 20, 2026</p>
            </div>

            <div className="prose prose-invert prose-slate max-w-none">
              <div className="space-y-8">
                <Section title="1. Delete Your Account In-App (Recommended)">
                  <ol>
                    <li>Open the DoorStepTN Android app and sign in.</li>
                    <li>Go to your profile screen.</li>
                    <li>Tap <strong>Delete Account</strong> in the Danger Zone section.</li>
                    <li>Confirm deletion.</li>
                  </ol>
                  <p>This permanently deletes your account and associated data from our active systems.</p>
                </Section>

                <Section title="2. Request Deletion Without Login (Web/Email)">
                  <p>
                    If you cannot access the app, send your deletion request to either email below from
                    the phone number or email linked to your account:
                  </p>
                  <ul>
                    <li>Email: vjaadhi2799@gmail.com</li>
                    <li>Email: vigneshwaran2513@gmail.com</li>
                  </ul>
                  <p>Use subject: <strong>DoorStepTN Account Deletion Request</strong>.</p>
                </Section>

                <Section title="3. Data Deleted">
                  <p>When deletion completes, we remove your account profile and associated operational data such as:</p>
                  <ul>
                    <li>Profile details (name, contact details, address, saved location)</li>
                    <li>Orders, bookings, carts, wishlists, reviews, and notifications linked to your account</li>
                    <li>Shop/provider data created under your account, where applicable</li>
                  </ul>
                </Section>

                <Section title="4. Data Retention">
                  <p>
                    We may retain limited records where legally required (for example, fraud prevention,
                    dispute handling, tax, or regulatory compliance), after which they are deleted according
                    to retention obligations.
                  </p>
                </Section>

                <Section title="5. Processing Timeline">
                  <p>In-app deletion is immediate in our active systems. Email/web requests are typically processed within 7 business days.</p>
                </Section>

                <Section title="6. Related Policy">
                  <p>
                    Read our full privacy policy here:{" "}
                    <Link href="/privacy-policy" className="text-orange-300 hover:text-orange-200">
                      Privacy Policy
                    </Link>
                  </p>
                </Section>
              </div>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="p-6 rounded-2xl bg-white/[0.02] border border-white/5"
    >
      <h2 className="text-xl font-bold text-white mb-4">{title}</h2>
      <div className="text-slate-400 space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:space-y-2 [&_p]:leading-relaxed">
        {children}
      </div>
    </motion.div>
  );
}
