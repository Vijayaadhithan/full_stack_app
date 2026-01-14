import React from "react";
import { Link } from "wouter";
import { ArrowLeft, FileText } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import doorstepLogo from "@/assets/doorstep-ds-logo.png";

export default function TermsOfService() {
    return (
        <div className="min-h-screen bg-slate-950 text-white font-sans">
            {/* Background */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-0 left-0 w-full h-[400px] bg-gradient-to-b from-blue-500/10 to-transparent" />
                <div className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
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
                            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-blue-500/10 text-blue-400 mb-6">
                                <FileText className="h-8 w-8" />
                            </div>
                            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
                            <p className="text-slate-400">Last updated: January 2026</p>
                        </div>

                        {/* Content */}
                        <div className="prose prose-invert prose-slate max-w-none">
                            <div className="space-y-8">
                                <Section title="1. Acceptance of Terms">
                                    <p>By accessing or using DoorStepTN's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.</p>
                                    <p>These terms apply to all users of the platform, including customers, service providers, and shop owners.</p>
                                </Section>

                                <Section title="2. Description of Service">
                                    <p>DoorStepTN is a marketplace platform that connects:</p>
                                    <ul>
                                        <li>Customers with local service providers for home repairs, beauty services, and other professional services</li>
                                        <li>Customers with local shops for purchasing products</li>
                                        <li>Service providers and shops with potential customers in their area</li>
                                    </ul>
                                    <p>We act as an intermediary and do not directly provide services or sell products.</p>
                                </Section>

                                <Section title="3. User Accounts">
                                    <p>To use certain features, you must create an account. You agree to:</p>
                                    <ul>
                                        <li>Provide accurate and complete information during registration</li>
                                        <li>Keep your account credentials secure and confidential</li>
                                        <li>Notify us immediately of any unauthorized use of your account</li>
                                        <li>Be responsible for all activities that occur under your account</li>
                                    </ul>
                                </Section>

                                <Section title="4. User Conduct">
                                    <p>When using our platform, you agree not to:</p>
                                    <ul>
                                        <li>Violate any applicable laws or regulations</li>
                                        <li>Infringe on the rights of others</li>
                                        <li>Post false, misleading, or fraudulent content</li>
                                        <li>Harass, abuse, or harm other users</li>
                                        <li>Attempt to gain unauthorized access to our systems</li>
                                        <li>Use the platform for any illegal or unauthorized purpose</li>
                                    </ul>
                                </Section>

                                <Section title="5. Service Providers and Shops">
                                    <p>If you register as a service provider or shop owner:</p>
                                    <ul>
                                        <li>You must provide accurate information about your services/products</li>
                                        <li>You are responsible for the quality of services/products you provide</li>
                                        <li>You must maintain all necessary licenses and permits</li>
                                        <li>You agree to our verification process</li>
                                        <li>You must respond to customer inquiries in a timely manner</li>
                                    </ul>
                                </Section>

                                <Section title="6. Payments and Fees">
                                    <p>Regarding payments:</p>
                                    <ul>
                                        <li>All prices are displayed in Indian Rupees (INR)</li>
                                        <li>We may charge service fees for transactions</li>
                                        <li>Payment processing is handled by secure third-party providers</li>
                                        <li>Refund policies vary by service provider and shop</li>
                                    </ul>
                                </Section>

                                <Section title="7. Reviews and Ratings">
                                    <p>Our review system:</p>
                                    <ul>
                                        <li>Only verified customers can leave reviews</li>
                                        <li>Reviews must be honest and based on actual experiences</li>
                                        <li>We reserve the right to remove reviews that violate our guidelines</li>
                                        <li>Fake or incentivized reviews are prohibited</li>
                                    </ul>
                                </Section>

                                <Section title="8. Intellectual Property">
                                    <p>All content on DoorStepTN, including logos, designs, and text, is our intellectual property or that of our licensors. You may not use, copy, or distribute this content without permission.</p>
                                </Section>

                                <Section title="9. Limitation of Liability">
                                    <p>DoorStepTN is a platform connecting users. We are not responsible for:</p>
                                    <ul>
                                        <li>The quality of services provided by service providers</li>
                                        <li>The quality of products sold by shops</li>
                                        <li>Disputes between users</li>
                                        <li>Any damages arising from the use of our platform</li>
                                    </ul>
                                    <p>Our liability is limited to the maximum extent permitted by law.</p>
                                </Section>

                                <Section title="10. Indemnification">
                                    <p>You agree to indemnify and hold harmless DoorStepTN, its owners, employees, and affiliates from any claims, damages, or expenses arising from your use of the platform or violation of these terms.</p>
                                </Section>

                                <Section title="11. Termination">
                                    <p>We may suspend or terminate your account at any time for:</p>
                                    <ul>
                                        <li>Violation of these Terms of Service</li>
                                        <li>Fraudulent or illegal activity</li>
                                        <li>Non-payment of fees</li>
                                        <li>Any reason at our discretion with or without notice</li>
                                    </ul>
                                </Section>

                                <Section title="12. Changes to Terms">
                                    <p>We may modify these Terms of Service at any time. Continued use of the platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or in-app notification.</p>
                                </Section>

                                <Section title="13. Governing Law">
                                    <p>These Terms of Service are governed by the laws of India. Any disputes will be resolved in the courts of Tamil Nadu, India.</p>
                                </Section>

                                <Section title="14. Contact Information">
                                    <p>If you have any questions about these Terms of Service, please contact us at:</p>
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
