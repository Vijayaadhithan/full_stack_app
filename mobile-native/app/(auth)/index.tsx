import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useAuth } from "../../hooks/use-auth";
import { LoginForm } from "../../components/auth/login-form";
import { RegisterFlow } from "../../components/auth/register-flow";
import { translations, SupportedLanguage } from "../../components/auth/translations";
import LogoMark from "../../components/branding/logo-mark";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { cn } from "../../lib/utils";

type AuthTab = "login" | "register";

export default function AuthScreen() {
    const { user, isFetching } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<AuthTab>("login");
    const [language, setLanguage] = useState<SupportedLanguage>("en");
    const t = translations[language];

    React.useEffect(() => {
        if (!isFetching && user) {
            // Redirect to dashboard based on role
            // For now just redirect to a generic dashboard or home
            router.replace("/(app)/dashboard");
        }
    }, [user, isFetching]);

    return (
        <SafeAreaView className="flex-1 bg-background">
            <Stack.Screen options={{ headerShown: false }} />
            <ScrollView contentContainerClassName="flex-grow justify-center p-4">
                <Card className="w-full max-w-md mx-auto">
                    <CardHeader className="space-y-4 items-center">
                        <LogoMark size={56} />
                        <CardTitle className="text-2xl text-center">{t.welcome}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <View className="flex-row w-full mb-6 bg-muted p-1 rounded-lg">
                            <TouchableOpacity
                                className={cn(
                                    "flex-1 py-2 rounded-md items-center",
                                    activeTab === "login" ? "bg-background shadow-sm" : ""
                                )}
                                onPress={() => setActiveTab("login")}
                            >
                                <Text
                                    className={cn(
                                        "text-sm font-medium",
                                        activeTab === "login" ? "text-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    {t.login}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={cn(
                                    "flex-1 py-2 rounded-md items-center",
                                    activeTab === "register" ? "bg-background shadow-sm" : ""
                                )}
                                onPress={() => setActiveTab("register")}
                            >
                                <Text
                                    className={cn(
                                        "text-sm font-medium",
                                        activeTab === "register" ? "text-foreground" : "text-muted-foreground"
                                    )}
                                >
                                    {t.register}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {activeTab === "login" ? (
                            <LoginForm t={t} />
                        ) : (
                            <RegisterFlow
                                t={t}
                                language={language}
                                onRegistrationSuccess={() => setActiveTab("login")}
                            />
                        )}
                    </CardContent>
                </Card>
            </ScrollView>
        </SafeAreaView>
    );
}
