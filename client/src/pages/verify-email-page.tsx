import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

export default function VerifyEmailPage() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"verifying" | "success" | "error">(
    "verifying",
  );
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const userId = params.get("userId");

    if (!token || !userId) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    async function verify() {
      try {
        const res = await apiRequest(
          "GET",
          `/api/verify-email?token=${encodeURIComponent(token as string)}&userId=${encodeURIComponent(
            userId as string,
          )}`,
        );
        const text = await res.text();
        if (res.ok) {
          setStatus("success");
          setMessage(text || "Email verified successfully.");
        } else {
          setStatus("error");
          setMessage(text || "Verification failed.");
        }
      } catch (err) {
        setStatus("error");
        setMessage("An error occurred while verifying your email.");
      }
    }

    verify();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "verifying" ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>{message}</span>
            </div>
          ) : (
            <div>
              <p className={status === "success" ? "text-green-600" : "text-red-600"}>{message}</p>
              <Button className="mt-4 w-full" onClick={() => navigate("/auth")}>Go to Login</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}