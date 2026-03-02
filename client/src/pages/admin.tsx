import { useEffect, useState } from "react";
  import { useLocation } from "wouter";
  import { Button } from "@/components/ui/button";
  import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Textarea } from "@/components/ui/textarea";
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
  import { Checkbox } from "@/components/ui/checkbox";
  import { useToast } from "@/hooks/use-toast";

  type AdminSettings = {
    id: string;
    openaiApiKey: string | null;
    openaiModel: string;
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
    const [customInstructions, setCustomInstructions] = useState("");
    const [chatInstructions, setChatInstructions] = useState("");
    const [allowRegistration, setAllowRegistration] = useState(true);
    const [relapseTime, setRelapseTime] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
      fetchSettings();
    }, []);

    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (!res.ok) {
          if (res.status === 401) {
            setLocation("/login");
            return;
          }
          throw new Error("Failed to fetch settings");
        }
        const data = await res.json();
        setSettings(data);
        setOpenaiApiKey(data.openaiApiKey || "");
        setOpenaiModel(data.openaiModel || "gpt-4o-mini");
        setCustomInstructions(data.customInstructions || "");
        setChatInstructions(data.chatInstructions || "");
        setAllowRegistration(data.allowRegistration !== false);
        setRelapseTime(data.relapseTime ? new Date(data.relapseTime).toISOString().slice(0, 16) : "");
      } catch (error) {
        toast({
          title: "Klaida",
          description: "Nepavyko užkrauti nustatymų",
          variant: "destructive",
        });
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
            customInstructions: customInstructions || null,
            chatInstructions: chatInstructions || null,
            allowRegistration,
            relapseTime: relapseTime ? new Date(relapseTime).toISOString() : new Date().toISOString(),
          }),
        });

        if (!res.ok) throw new Error("Failed to save settings");

        const data = await res.json();
        setSettings(data);

        toast({
          title: "Sėkmė!",
          description: "Nustatymai išsaugoti",
        });
      } catch (error) {
        toast({
          title: "Klaida",
          description: "Nepavyko išsaugoti nustatymų",
          variant: "destructive",
        });
      } finally {
        setSaving(false);
      }
    };

    if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-lg">Kraunasi...</div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 p-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold">⚙️ Admin Panel</h1>
            <Button variant="outline" onClick={() => setLocation("/")}>
              Atgal
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>OpenAI Nustatymai</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveSettings} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="apiKey">OpenAI API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                  />
                  <p className="text-sm text-muted-foreground">
                    Įveskite savo OpenAI API raktą, kad aktyvuotumėte AI trenerį
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">OpenAI Modelis</Label>
                  <Select value={openaiModel} onValueChange={setOpenaiModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="!bg-white dark:!bg-gray-900 border border-gray-200 shadow-lg z-[100]">
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instructions">Savijautos instrukcijos</Label>
                  <Textarea
                    id="instructions"
                    value={customInstructions}
                    onChange={(e) => setCustomInstructions(e.target.value)}
                    placeholder="Tu esi palaikantis treneris..."
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Prompt'as naudojamas kai vartotojas pateikia dienos savijautą
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="chatInstructions">Pokalbių instrukcijos ("Treneri, ...")</Label>
                  <Textarea
                    id="chatInstructions"
                    value={chatInstructions}
                    onChange={(e) => setChatInstructions(e.target.value)}
                    placeholder="Tu esi palaikantis treneris, atsakantis į klausimus..."
                    rows={4}
                  />
                  <p className="text-sm text-muted-foreground">
                    Prompt'as naudojamas kai vartotojas kreipiasi "Treneri, ..." pokalbyje
                  </p>
                </div>

                <div className="flex items-center space-x-3 py-2">
                  <Checkbox
                    id="allowRegistration"
                    checked={allowRegistration}
                    onCheckedChange={(checked) => setAllowRegistration(checked as boolean)}
                    data-testid="checkbox-allow-registration"
                  />
                  <Label htmlFor="allowRegistration" className="cursor-pointer">
                    Leisti registruotis naujiems vartotojams
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="relapseTime">Paskutinio Relapse Laikas</Label>
                  <Input
                    id="relapseTime"
                    type="datetime-local"
                    value={relapseTime}
                    onChange={(e) => setRelapseTime(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Nustatykite laiką, nuo kurio pradėti skaičiuoti seriją
                  </p>
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving ? "Saugoma..." : "Išsaugoti Nustatymus"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="bg-yellow-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-yellow-800">ℹ️ Informacija</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                <strong>OpenAI API Key:</strong> Jūsų API raktas saugomas duomenų bazėje ir naudojamas tik AI treneriui.
              </p>
              <p>
                <strong>Relapse Time:</strong> Kai nustatote naują laiką, serija bus perskaičiuota nuo to momento.
              </p>
              <p>
                <strong>Custom Instructions:</strong> Galite pritaikyti AI trenerio elgesį pagal savo poreikius.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  