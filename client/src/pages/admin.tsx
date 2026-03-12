import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";

type AdminSettings = {
  id: string;
  openaiApiKey: string | null;
  openaiModel: string;
  anthropicApiKey: string | null;
  anthropicModel: string;
  aiProvider: string;
  customInstructions: string | null;
  chatInstructions: string | null;
  allowRegistration: boolean;
  relapseTime: string;
};

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [openaiApiKey, setOpenaiApiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini");
  const [anthropicApiKey, setAnthropicApiKey] = useState("");
  const [anthropicModel, setAnthropicModel] = useState("claude-3-5-sonnet-20241022");
  const [aiProvider, setAiProvider] = useState("openai");
  const [customInstructions, setCustomInstructions] = useState("");
  const [chatInstructions, setChatInstructions] = useState("");
  const [allowRegistration, setAllowRegistration] = useState(true);
  const [relapseTime, setRelapseTime] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) { setLocation("/login"); return; }
        throw new Error("Failed to fetch settings");
      }
      const data = await res.json();
      setSettings(data);
      setOpenaiApiKey(data.openaiApiKey || "");
      setOpenaiModel(data.openaiModel || "gpt-4o-mini");
      setAnthropicApiKey(data.anthropicApiKey || "");
      setAnthropicModel(data.anthropicModel || "claude-3-5-sonnet-20241022");
      setAiProvider(data.aiProvider || "openai");
      setCustomInstructions(data.customInstructions || "");
      setChatInstructions(data.chatInstructions || "");
      setAllowRegistration(data.allowRegistration !== false);
      setRelapseTime(data.relapseTime ? new Date(data.relapseTime).toISOString().slice(0, 16) : "");
    } catch {
      toast({ title: "Klaida", description: "Nepavyko užkrauti nustatymų", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openaiApiKey: openaiApiKey || null,
          openaiModel,
          anthropicApiKey: anthropicApiKey || null,
          anthropicModel,
          aiProvider,
          customInstructions: customInstructions || null,
          chatInstructions: chatInstructions || null,
          allowRegistration,
          relapseTime: relapseTime ? new Date(relapseTime).toISOString() : new Date().toISOString(),
        }),
      });
      if (res.status === 401 || res.status === 403) { setLocation("/login"); return; }
      if (!res.ok) throw new Error("Failed to save settings");
      const data = await res.json();
      setSettings(data);
      toast({ title: "Sėkmė!", description: "Nustatymai išsaugoti" });
    } catch {
      toast({ title: "Klaida", description: "Nepavyko išsaugoti nustatymų", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="text-[15px] text-[#8E8E93]">Kraunasi...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <div className="sticky top-0 z-50 ios-header px-4 py-3 flex items-center gap-2">
        <button
          onClick={() => setLocation("/")}
          className="w-8 h-8 flex items-center justify-center rounded-full active:bg-[#E5E5EA] transition-colors -ml-1"
        >
          <ArrowLeft className="h-5 w-5 text-[#007AFF]" />
        </button>
        <h1 className="text-[17px] font-semibold text-[#1C1C1E]">⚙️ Admin Panel</h1>
      </div>

      <form onSubmit={saveSettings} className="p-4 max-w-lg mx-auto space-y-6 pb-10">
        {/* AI Provider selector */}
        <div>
          <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider px-1 mb-2">AI tiekėjas</div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden flex">
            <button
              type="button"
              onClick={() => setAiProvider("openai")}
              className={`flex-1 py-3.5 text-[15px] font-semibold transition-colors ${
                aiProvider === "openai"
                  ? "bg-[#007AFF] text-white"
                  : "text-[#8E8E93] active:bg-[#F2F2F7]"
              }`}
            >
              OpenAI
            </button>
            <button
              type="button"
              onClick={() => setAiProvider("anthropic")}
              className={`flex-1 py-3.5 text-[15px] font-semibold transition-colors border-l border-[#E5E5EA] ${
                aiProvider === "anthropic"
                  ? "bg-[#CC785C] text-white"
                  : "text-[#8E8E93] active:bg-[#F2F2F7]"
              }`}
            >
              Anthropic
            </button>
          </div>
        </div>

        {/* OpenAI section */}
        {aiProvider === "openai" && (
        <div>
          <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider px-1 mb-2">OpenAI nustatymai</div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E5E5EA]">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">API Key</label>
              <input
                type="password"
                value={openaiApiKey}
                onChange={(e) => setOpenaiApiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full text-[17px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none bg-transparent"
              />
            </div>
            <div className="px-4 py-3.5">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">Modelis</label>
              <select
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                className="w-full text-[17px] text-[#1C1C1E] outline-none bg-transparent appearance-none"
              >
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o Mini</option>
                <option value="gpt-4-turbo">GPT-4 Turbo</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </div>
          </div>
        </div>
        )}

        {/* Anthropic section */}
        {aiProvider === "anthropic" && (
        <div>
          <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider px-1 mb-2">Anthropic nustatymai</div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E5E5EA]">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">API Key</label>
              <input
                type="password"
                value={anthropicApiKey}
                onChange={(e) => setAnthropicApiKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full text-[17px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none bg-transparent"
              />
            </div>
            <div className="px-4 py-3.5">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-2">Modelis</label>
              <select
                value={anthropicModel}
                onChange={(e) => setAnthropicModel(e.target.value)}
                className="w-full text-[17px] text-[#1C1C1E] outline-none bg-transparent appearance-none"
              >
                <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
              </select>
            </div>
          </div>
        </div>
        )}

        {/* Instructions section */}
        <div>
          <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider px-1 mb-2">Instrukcijos</div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3.5 border-b border-[#E5E5EA]">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">Savijautos instrukcijos</label>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="Tu esi palaikantis treneris..."
                rows={4}
                className="w-full text-[15px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none bg-transparent resize-none mt-1"
              />
              <p className="text-[12px] text-[#8E8E93] mt-1">Prompt'as naudojamas kai vartotojas pateikia dienos savijautą</p>
            </div>
            <div className="px-4 py-3.5">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">Pokalbių instrukcijos</label>
              <textarea
                value={chatInstructions}
                onChange={(e) => setChatInstructions(e.target.value)}
                placeholder="Tu esi palaikantis treneris, atsakantis į klausimus..."
                rows={4}
                className="w-full text-[15px] text-[#1C1C1E] placeholder-[#C7C7CC] outline-none bg-transparent resize-none mt-1"
              />
              <p className="text-[12px] text-[#8E8E93] mt-1">Prompt'as naudojamas kai vartotojas kreipiasi "Treneri, ..." pokalbyje</p>
            </div>
          </div>
        </div>

        {/* Settings section */}
        <div>
          <div className="text-[13px] font-semibold text-[#8E8E93] uppercase tracking-wider px-1 mb-2">Nustatymai</div>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <label className="flex items-center justify-between px-4 py-4 border-b border-[#E5E5EA] cursor-pointer active:bg-[#F2F2F7]">
              <span className="text-[17px] text-[#1C1C1E]">Leisti registruotis</span>
              <input
                type="checkbox"
                checked={allowRegistration}
                onChange={(e) => setAllowRegistration(e.target.checked)}
                className="w-5 h-5 accent-[#007AFF]"
                data-testid="checkbox-allow-registration"
              />
            </label>
            <div className="px-4 py-3.5">
              <label className="block text-[12px] font-semibold text-[#8E8E93] uppercase tracking-wider mb-1">Paskutinio Relapse Laikas</label>
              <input
                type="datetime-local"
                value={relapseTime}
                onChange={(e) => setRelapseTime(e.target.value)}
                className="w-full text-[17px] text-[#1C1C1E] outline-none bg-transparent"
              />
              <p className="text-[12px] text-[#8E8E93] mt-1">Nustatykite laiką, nuo kurio pradėti skaičiuoti seriją</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-4 rounded-2xl bg-[#007AFF] text-white text-[17px] font-semibold shadow-sm active:bg-[#0062CC] transition-colors disabled:opacity-50"
        >
          {saving ? "Saugoma..." : "Išsaugoti nustatymus"}
        </button>

        <div className="bg-[#FFF3CD] rounded-2xl p-4 space-y-2">
          <div className="text-[13px] font-semibold text-[#7D5A00] uppercase tracking-wider">ℹ️ Informacija</div>
          <p className="text-[13px] text-[#7D5A00]"><strong>API Key:</strong> Saugomas duomenų bazėje, naudojamas tik AI treneriui.</p>
          <p className="text-[13px] text-[#7D5A00]"><strong>Relapse Time:</strong> Naujas laikas perskaičiuoja seriją nuo to momento.</p>
          <p className="text-[13px] text-[#7D5A00]"><strong>Instrukcijos:</strong> Galite pritaikyti AI trenerio elgesį.</p>
        </div>
      </form>
    </div>
  );
}
