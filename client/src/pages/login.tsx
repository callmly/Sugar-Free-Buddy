import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrationAllowed, setRegistrationAllowed] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/auth/registration-allowed")
      .then((r) => r.json())
      .then((data) => setRegistrationAllowed(data.allowed))
      .catch(() => setRegistrationAllowed(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isLogin && !/^\d{4,6}$/.test(password)) {
      toast({
        title: "Klaida",
        description: "PIN kodas turi būti 4-6 skaitmenų",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Authentication failed");
      }

      setLocation("/");
    } catch (error: any) {
      toast({
        title: "Klaida",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 to-purple-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center" data-testid="text-title">
            Be saldumynų
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin ? "Prisijunkite prie savo paskyros" : "Sukurkite naują paskyrą"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off" data-lpignore="true" data-1p-ignore>
            <input type="text" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
            <input type="password" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
            <div className="space-y-2">
              <Label htmlFor="nc_user_field">Vartotojo vardas</Label>
              <Input
                id="nc_user_field"
                name="nc_user_field"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                data-testid="input-username"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc_pin_field">PIN kodas</Label>
              <Input
                id="nc_pin_field"
                name="nc_pin_field"
                type="tel"
                inputMode="numeric"
                pattern="\d{4,6}"
                maxLength={6}
                value={password}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setPassword(val);
                }}
                required
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                placeholder={!isLogin && registrationAllowed ? "4-6 skaitmenų" : ""}
                data-testid="input-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-submit">
              {loading ? "Kraunasi..." : isLogin ? "Prisijungti" : "Registruotis"}
            </Button>
          </form>
          {registrationAllowed && (
            <div className="mt-4 text-center text-sm">
              {isLogin ? "Neturite paskyros?" : "Jau turite paskyrą?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
                data-testid="button-toggle-mode"
              >
                {isLogin ? "Registruotis" : "Prisijungti"}
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
