import React from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { View, Text, TouchableOpacity } from "react-native";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { useAuth } from "../../hooks/use-auth";
import { AuthTranslations } from "./translations";
import { API_BASE_URL } from "../../lib/queryClient";
import * as Linking from "expo-linking";

const loginSchema = z.object({
    identifier: z.string().min(1, "Required"),
    password: z.string().min(1, "Required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

type LoginFormProps = {
    t: AuthTranslations;
};

export function LoginForm({ t }: LoginFormProps) {
    const { loginMutation } = useAuth();
    const { control, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
        resolver: zodResolver(loginSchema),
        defaultValues: { identifier: "", password: "" },
    });

    const onSubmit = (data: LoginFormData) => {
        loginMutation.mutate({
            username: data.identifier.trim(),
            password: data.password,
        });
    };

    return (
        <View className="space-y-4">
            <View className="space-y-1">
                <Label>{t.identifierLabel}</Label>
                <Controller
                    control={control}
                    name="identifier"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            autoCapitalize="none"
                            autoComplete="username"
                        />
                    )}
                />
                {errors.identifier && (
                    <Text className="text-red-500 text-sm">{errors.identifier.message}</Text>
                )}
            </View>

            <View className="space-y-1">
                <Label>{t.password}</Label>
                <Controller
                    control={control}
                    name="password"
                    render={({ field: { onChange, onBlur, value } }) => (
                        <Input
                            onBlur={onBlur}
                            onChangeText={onChange}
                            value={value}
                            secureTextEntry
                            autoCapitalize="none"
                            autoComplete="password"
                        />
                    )}
                />
                {errors.password && (
                    <Text className="text-red-500 text-sm">{errors.password.message}</Text>
                )}
            </View>

            <View className="flex-row items-center justify-between">
                <TouchableOpacity>
                    <Text className="text-primary text-sm">{t.forgotPassword}</Text>
                </TouchableOpacity>
                <TouchableOpacity>
                    <Text className="text-primary text-sm">{t.sendMagicLink}</Text>
                </TouchableOpacity>
            </View>

            <Button
                onPress={handleSubmit(onSubmit)}
                disabled={loginMutation.isPending}
                className="w-full"
            >
                {loginMutation.isPending ? "Loading..." : t.login}
            </Button>

            <View className="relative my-4">
                <View className="absolute inset-0 flex-row items-center">
                    <View className="w-full border-t border-border" />
                </View>
                <View className="relative flex-row justify-center">
                    <Text className="bg-background px-2 text-xs uppercase text-muted-foreground">
                        Or continue with
                    </Text>
                </View>
            </View>

            <Button
                variant="outline"
                className="w-full"
                onPress={() => Linking.openURL(`${API_BASE_URL}/auth/google`)}
            >
                {t.continueWithGoogle}
            </Button>
        </View>
    );
}
