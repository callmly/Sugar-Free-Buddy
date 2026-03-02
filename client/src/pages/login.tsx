import { useState } from "react";
  import { useLocation } from "wouter";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
  import { Checkbox } from "@/components/ui/checkbox";
  import { useToast } from "@/hooks/use-toast";

  export default function LoginPage() {
    const [, setLocation] = useLocation();
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);

      try {
        const endpoint = isLogin ? "/api/auth/login" : "/api/auth/register";
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password, rememberMe }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Authentication failed");
        }

        toast({
          title: "Sėkmė!",
          description: isLogin ? "Sėkmingai prisijungėte" : "Paskyra sukurta sėkmingai",
        });

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
            <CardTitle className="text-2xl font-bold text-center">
              🍬 No Sugar Challenge
            </CardTitle>
            <CardDescription className="text-center">
              {isLogin ? "Prisijunkite prie savo paskyros" : "Sukurkite naują paskyrą"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Vartotojo vardas</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">PIN kodas</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </div>
              {isLogin && (
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">
                    Prisiminti mane
                  </Label>
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Kraunasi..." : isLogin ? "Prisijungti" : "Registruotis"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              {isLogin ? "Neturite paskyros?" : "Jau turite paskyrą?"}{" "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin ? "Registruotis" : "Prisijungti"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  