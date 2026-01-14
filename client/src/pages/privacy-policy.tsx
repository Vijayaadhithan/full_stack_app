import React from "react";
import { Link } from "wouter";
import { ArrowLeft, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";

export default function PrivacyPolicy() {
    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-purple-500/10 to-transparent" />
                <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-purple-600/10 blur-[120px]" />
            </div>

            {/* Navigation */}
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
                        {/* Header */}
                        <div className="text-center mb-16">
                            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-purple-500/10 text-purple-400 mb-6">
                                <Shield className="h-8 w-8" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
                            <p className="text-slate-400">Last updated: January 2026</p>
                        </div>

                        {/* Content */}
                        <div className="prose prose-invert prose-slate max-w-none">
                            <div className="space-y-8">
                                <Section title="1. Information We Collect">
                                    <p>At DoorStepTN, we collect information you provide directly to us, such as:</p>
                                    <ul>
                                        <li>Name, phone number, and email address when you create an account</li>
                                        <li>Address and location data to provide local services</li>
                                        <li>Payment information when you make purchases</li>
                                        <li>Communication data between you and service providers/shops</li>
                                        <li>Feedback and reviews you submit</li>
                                    </ul>
                                </Section>

                                <Section title="2. How We Use Your Information">
                                    <p>We use the information we collect to:</p>
                                    <ul>
                                        <li>Provide, maintain, and improve our services</li>
                                        <li>Connect you with local service providers and shops</li>
                                        <li>Process transactions and send related information</li>
                                        <li>Send you technical notices and support messages</li>
                                        <li>Respond to your comments and questions</li>
                                        <li>Personalize and improve your experience</li>
                                    </ul>
                                </Section>

                                <Section title="3. Information Sharing">
                                    <p>We may share your information in the following situations:</p>
                                    <ul>
                                        <li>With service providers and shops when you book services or make purchases</li>
                                        <li>With third-party vendors who assist in our operations</li>
                                        <li>When required by law or to protect our rights</li>
                                        <li>In connection with a merger or acquisition</li>
                                    </ul>
                                    <p>We never sell your personal information to third parties for marketing purposes.</p>
                                </Section>

                                <Section title="4. Data Security">
                                    <p>We implement appropriate security measures to protect your personal information, including:</p>
                                    <ul>
                                        <li>Encryption of sensitive data in transit and at rest</li>
                                        <li>Regular security assessments and updates</li>
                                        <li>Access controls and authentication mechanisms</li>
                                        <li>Secure data storage practices</li>
                                    </ul>
                                </Section>

                                <Section title="5. Your Rights">
                                    <p>You have the right to:</p>
                                    <ul>
                                        <li>Access and review your personal information</li>
                                        <li>Request correction of inaccurate data</li>
                                        <li>Request deletion of your account and data</li>
                                        <li>Opt-out of promotional communications</li>
                                        <li>Export your data in a portable format</li>
                                    </ul>
                                </Section>

                                <Section title="6. Cookies and Tracking">
                                    <p>We use cookies and similar tracking technologies to:</p>
                                    <ul>
                                        <li>Remember your preferences and login status</li>
                                        <li>Analyze usage patterns to improve our services</li>
                                        <li>Provide personalized content and recommendations</li>
                                    </ul>
                                </Section>

                                <Section title="7. Children's Privacy">
                                    <p>Our services are not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If we learn that we have collected such information, we will delete it promptly.</p>
                                </Section>

                                <Section title="8. Changes to This Policy">
                                    <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.</p>
                                </Section>

                                <Section title="9. Contact Us">
                                    <p>If you have any questions about this Privacy Policy, please contact us at:</p>
                                    <ul>
                                        <li>Email: vjaadhi2799@gmail.com</li>
                                        <li>Email: vigneshwaran2513@gmail.com</li>
                                        <li>Phone: +91 97895 46741</li>
                                        <li>Phone: +91 95097 53683</li>
                                    </ul>
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
            <div className="text-slate-400 space-y-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-2 [&_p]:leading-relaxed">
                {children}
            </div>
        </motion.div>
    );
}
