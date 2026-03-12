import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
      toast({ title: "Klaida", description: "PIN kodas turi būti 4-6 skaitmenų", variant: "destructive" });
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
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      setLocation("/");
    } catch (error: any) {
      toast({ title: "Klaida", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F2F2F7] px-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#007AFF] to-[#5856D6] flex items-center justify-center shadow-lg mb-4">
            <span className="text-3xl">🍬</span>
          </div>
          <h1 className="text-[28px] font-bold text-[#1C1C1E] tracking-tight" data-testid="text-title">Be saldumynų</h1>
          <p className="text-[15px] text-[#8E8E93] mt-1">
            {isLogin ? "Prisijunkite prie paskyros" : "Sukurkite naują paskyrą"}
          </p>
        </div>

        <form onSubmit={handleSubmit} autoComplete="off" data-lpignore="true" data-1p-ignore>
          <input type="text" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />
          <input type="password" style={{ display: "none" }} tabIndex={-1} aria-hidden="true" />

          <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-4">
            <div className="px-4 py-3.5 border-b border-[#E5E5EA]">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                Vartotojo vardas
              </label>
              <input
                id="nc_user_field"
                name="nc_user_field"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
                data-lpignore="true"
                data-1p-ignore
                placeholder="Vardas"
                className="w-full text-[17px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none bg-transparent"
                data-testid="input-username"
              />
            </div>
            <div className="px-4 py-3.5">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">
                PIN kodas
              </label>
              <input
                id="nc_pin_field"
                name="nc_pin_field"
                type="password"
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
                placeholder={!isLogin && registrationAllowed ? "4–6 skaitmenų" : "••••"}
                className="w-full text-[17px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none bg-transparent"
                data-testid="input-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-[#007AFF] text-white text-[17px] font-semibold shadow-sm active:bg-[#0062CC] transition-colors disabled:opacity-50"
            data-testid="button-submit"
          >
            {loading ? "Kraunasi..." : isLogin ? "Prisijungti" : "Registruotis"}
          </button>
        </form>

        {registrationAllowed && (
          <p className="text-center text-[15px] text-[#8E8E93] mt-6">
            {isLogin ? "Neturite paskyros? " : "Jau turite paskyrą? "}
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-[#007AFF] font-medium"
              data-testid="button-toggle-mode"
            >
              {isLogin ? "Registruotis" : "Prisijungti"}
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
