"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "~/lib/auth";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Badge } from "~/components/ui/badge";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ArrowRight,
  AlertCircle,
  Phone,
  MessageCircle,
} from "lucide-react";

function LoginPageInner() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"email" | "phone">("email");
  const { signIn, signInWithGoogle, signInWithPhone, verifyOTP, user } =
    useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive OAuth errors from URL params during render (no state/effect needed)
  const urlError = (() => {
    const errorParam = searchParams.get("error");
    if (!errorParam) return null;
    switch (errorParam) {
      case "oauth_error": {
        const messageParam = searchParams.get("message");
        return messageParam
          ? decodeURIComponent(messageParam)
          : "OAuth authentication failed. Please try again.";
      }
      case "session_error":
        return "Session creation failed. Please try again.";
      case "unexpected_error":
        return "An unexpected error occurred. Please try again.";
      default:
        return "Authentication failed. Please try again.";
    }
  })();
  const displayError = error ?? urlError;

  // Redirect authenticated users to dashboard (side effects belong in effects,
  // never in render).
  useEffect(() => {
    if (user) {
      router.push("/dashboard");
    }
  }, [user, router]);

  // Show loading while auth is initializing
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await signIn(email, password);

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      // Auth context will handle redirect
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError(null);

    const { error } = await signInWithGoogle();

    if (error) {
      setError(error.message);
      setGoogleLoading(false);
    }
    // Don't set loading to false here as the redirect will happen
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpSent) {
      // Send OTP
      setOtpLoading(true);
      setError(null);

      const { error } = await signInWithPhone(phone);

      if (error) {
        setError(error.message);
        setOtpLoading(false);
      } else {
        setOtpSent(true);
        setOtpLoading(false);
      }
    } else {
      // Verify OTP
      setOtpLoading(true);
      setError(null);

      const { error } = await verifyOTP(phone, otp);

      if (error) {
        setError(error.message);
        setOtpLoading(false);
      } else {
        // Auth context will handle redirect
        setOtpLoading(false);
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="space-y-4 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-muted-foreground">
              Sign in to your CricScore account
            </p>
          </div>
        </div>

        {/* Login Form */}
        <Card>
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-center text-2xl text-foreground">
              Sign in
            </CardTitle>
            <CardDescription className="text-center text-muted-foreground">
              Choose your preferred sign-in method
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Error Display */}
            {displayError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Google Sign In */}
            <Button
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              variant="outline"
              className="h-11 w-full"
            >
              {googleLoading ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-current"></div>
                  Signing in with Google...
                </>
              ) : (
                <>
                  <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </Button>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border"></span>
              </div>
              <div className="relative flex justify-center text-xs font-medium text-muted-foreground">
                <span className="bg-card px-2.5">or</span>
              </div>
            </div>

            {/* Login Method Toggle */}
            <div className="flex rounded-lg bg-muted/30 p-1">
              <button
                type="button"
                onClick={() => {
                  setLoginMethod("email");
                  setError(null);
                  setOtpSent(false);
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  loginMethod === "email"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Mail className="mr-2 inline h-4 w-4" />
                Email
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginMethod("phone");
                  setError(null);
                  setOtpSent(false);
                }}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  loginMethod === "phone"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Phone className="mr-2 inline h-4 w-4" />
                Phone
              </button>
            </div>

            {/* Email Login Form */}
            {loginMethod === "email" && (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {/* Email Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-sm font-medium text-foreground"
                  >
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="form-input pl-10"
                      required
                    />
                  </div>
                </div>

                {/* Password Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-sm font-medium text-foreground"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input pl-10 pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 transform text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Forgot Password Link */}
                <div className="flex justify-end">
                  <Link
                    href="/auth/forgot-password"
                    className="text-sm font-medium text-cricket-primary transition-colors hover:text-cricket-primary/80"
                  >
                    Forgot your password?
                  </Link>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 w-full"
                >
                  {loading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign in with Email
                      <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Phone Login Form */}
            {loginMethod === "phone" && (
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                {/* Phone Field */}
                <div className="space-y-2">
                  <Label
                    htmlFor="phone"
                    className="text-sm font-medium text-foreground"
                  >
                    Phone number
                  </Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="form-input pl-10"
                      required
                      disabled={otpSent}
                    />
                  </div>
                  {!otpSent && (
                    <p className="text-xs text-muted-foreground">
                      We'll send you a verification code via SMS
                    </p>
                  )}
                </div>

                {/* OTP Field (only shown after phone number is submitted) */}
                {otpSent && (
                  <div className="space-y-2">
                    <Label
                      htmlFor="otp"
                      className="text-sm font-medium text-foreground"
                    >
                      Verification code
                    </Label>
                    <div className="relative">
                      <MessageCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                      <Input
                        id="otp"
                        type="text"
                        placeholder="Enter 6-digit code"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="form-input pl-10"
                        maxLength={6}
                        required
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Didn't receive the code?
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpSent(false);
                          setOtp("");
                        }}
                        className="text-xs font-medium text-cricket-primary transition-colors hover:text-cricket-primary/80"
                      >
                        Try again
                      </button>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={otpLoading}
                  className="h-11 w-full"
                >
                  {otpLoading ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                      {otpSent ? "Verifying..." : "Sending code..."}
                    </>
                  ) : (
                    <>
                      {otpSent ? (
                        <>
                          Verify & Sign in
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </>
                      ) : (
                        <>
                          Send verification code
                          <MessageCircle className="ml-2 h-4 w-4 transition-transform group-hover:scale-110" />
                        </>
                      )}
                    </>
                  )}
                </Button>
              </form>
            )}

            {/* Error Alert */}
            {displayError && (
              <Alert className="border-destructive/20 bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-destructive">
                  {error}
                </AlertDescription>
              </Alert>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border"></span>
              </div>
              <div className="relative flex justify-center text-xs font-medium text-muted-foreground">
                <span className="bg-card px-2.5">New to CricScore?</span>
              </div>
            </div>

            {/* Sign Up Link */}
            <div className="space-y-3 text-center">
              <Button
                asChild
                variant="outline"
                className="btn-secondary w-full"
              >
                <Link
                  href="/auth/signup"
                  className="flex items-center justify-center gap-2"
                >
                  Create account
                  <Badge className="border-cricket-secondary/20 bg-cricket-secondary/10 px-2 py-0.5 text-xs text-cricket-secondary">
                    Free
                  </Badge>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-muted-foreground">
            By signing in, you agree to our{" "}
            <Link
              href="#"
              className="text-cricket-primary transition-colors hover:text-cricket-primary/80"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="text-cricket-primary transition-colors hover:text-cricket-primary/80"
            >
              Privacy Policy
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
