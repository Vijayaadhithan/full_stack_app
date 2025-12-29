import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, User, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function WorkerLoginPage() {
    const [workerNumber, setWorkerNumber] = useState("");
    const [pin, setPin] = useState("");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user, isFetching } = useAuth();

    // Redirect if already logged in
    useEffect(() => {
        if (!isFetching && user) {
            const targetPath = user.role === "worker" ? "/shop" : `/${user.role || "customer"}`;
            setLocation(targetPath);
        }
    }, [user, isFetching, setLocation]);

    const loginMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/auth/worker-login", {
                workerNumber,
                pin,
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || "Login failed");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/user"] });
            toast({ title: "Login successful", description: "Welcome back!" });
            setLocation("/shop");
        },
        onError: (error: Error) => {
            toast({
                title: "Login failed",
                description: error.message || "Invalid worker number or PIN",
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (workerNumber.length !== 10) {
            toast({
                title: "Invalid worker number",
                description: "Worker number must be exactly 10 digits",
                variant: "destructive",
            });
            return;
        }
        if (pin.length !== 4) {
            toast({
                title: "Invalid PIN",
                description: "PIN must be exactly 4 digits",
                variant: "destructive",
            });
            return;
        }
        loginMutation.mutate();
    };

    const handleWorkerNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 10);
        setWorkerNumber(value);
    };

    const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
        setPin(value);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <div className="w-full max-w-md">
                <Card className="border-0 shadow-2xl bg-slate-800/50 backdrop-blur-xl">
                    <CardHeader className="text-center space-y-4 pb-6">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-orange-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                            <User className="h-8 w-8 text-white" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold text-white">Worker Login</CardTitle>
                            <CardDescription className="text-slate-400 mt-1">
                                Enter your 10-digit worker number and 4-digit PIN
                            </CardDescription>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="workerNumber" className="text-slate-300 flex items-center gap-2">
                                    <User className="h-4 w-4" />
                                    Worker Number
                                </Label>
                                <Input
                                    id="workerNumber"
                                    type="tel"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="1234567890"
                                    value={workerNumber}
                                    onChange={handleWorkerNumberChange}
                                    maxLength={10}
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 text-center text-xl tracking-widest font-mono h-14"
                                    autoComplete="username"
                                />
                                <p className="text-xs text-slate-500 text-center">
                                    {workerNumber.length}/10 digits
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="pin" className="text-slate-300 flex items-center gap-2">
                                    <KeyRound className="h-4 w-4" />
                                    PIN
                                </Label>
                                <Input
                                    id="pin"
                                    type="password"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    placeholder="••••"
                                    value={pin}
                                    onChange={handlePinChange}
                                    maxLength={4}
                                    className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 text-center text-2xl tracking-[0.5em] font-mono h-14"
                                    autoComplete="current-password"
                                />
                                <p className="text-xs text-slate-500 text-center">
                                    {pin.length}/4 digits
                                </p>
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 bg-gradient-to-r from-orange-500 to-pink-500 hover:from-orange-600 hover:to-pink-600 text-white font-semibold text-lg shadow-lg"
                                disabled={loginMutation.isPending || workerNumber.length !== 10 || pin.length !== 4}
                            >
                                {loginMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Logging in...
                                    </>
                                ) : (
                                    "Login"
                                )}
                            </Button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-slate-700">
                            <Button
                                variant="ghost"
                                className="w-full text-slate-400 hover:text-white hover:bg-slate-700/50"
                                onClick={() => setLocation("/auth")}
                            >
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Back to main login
                            </Button>
                        </div>

                        <p className="mt-4 text-center text-sm text-slate-500">
                            Forgot your PIN? Contact your shop owner to reset it.
                        </p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
