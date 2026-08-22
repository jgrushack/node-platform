"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Caveat } from "next/font/google";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, Loader2, Share2, Smartphone } from "lucide-react";

// Script option for the name (loaded only on this page).
const caveat = Caveat({ subsets: ["latin"], weight: "700" });

type FontKey = "node" | "clean" | "script";
type NameSource = "playa" | "real";

// Base art is 1124×1999. The dashed "your name here" panel sits at:
const ART_W = 1124;
const ART_H = 1999;
const BOX = { left: 130, right: 1005, top: 1165, bottom: 1335 };
const BOX_CX = (BOX.left + BOX.right) / 2;
const BOX_CY = (BOX.top + BOX.bottom) / 2;
const BOX_W = BOX.right - BOX.left;

/** Resolve the real font-family behind a CSS var class (next/font hashes names). */
function resolveFamily(className: string): string {
  const probe = document.createElement("span");
  probe.className = className;
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  document.body.appendChild(probe);
  const fam = getComputedStyle(probe).fontFamily;
  probe.remove();
  return fam;
}

export function LockscreenClient() {
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [fontKey, setFontKey] = useState<FontKey>("node");
  const [nameSource, setNameSource] = useState<NameSource>("playa");
  const [profileNames, setProfileNames] = useState<{ playa: string; real: string }>({ playa: "", real: "" });
  const [withContact, setWithContact] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rendering, setRendering] = useState(false);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Prefill from profile
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        setLoading(false);
        return;
      }
      supabase
        .from("profiles")
        .select("first_name, last_name, playa_name, emergency_contact")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            const playa = (data.playa_name || "").trim();
            const real = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
            setProfileNames({ playa, real });
            if (!playa) setNameSource("real");
            setName(playa || real);
            setContact((data.emergency_contact || "").trim());
          }
          setLoading(false);
        });
    });
  }, []);

  // Share support (iOS shows "Save Image" in the share sheet)
  useEffect(() => {
    const f = new File([""], "x.png", { type: "image/png" });
    setCanShare(
      typeof navigator !== "undefined" &&
        !!navigator.canShare &&
        navigator.canShare({ files: [f] })
    );
  }, []);

  // Load the base image once
  useEffect(() => {
    const img = new Image();
    img.src = "/lockscreen-2026.jpg";
    img.onload = () => {
      imgRef.current = img;
      setDataUrl((d) => d ?? null); // trigger nothing; render effect handles it
    };
  }, []);

  const render = useCallback(async () => {
    const img = imgRef.current;
    if (!img) return;
    setRendering(true);

    // Sci-Fied matches the NODE wordmark; Exo 2 is the clean option; Caveat the script.
    const bodyFam = resolveFamily("font-sans");
    const nameFam =
      fontKey === "node"
        ? resolveFamily("font-brand")
        : fontKey === "script"
          ? resolveFamily(caveat.className)
          : bodyFam;
    // Make sure the faces are actually loaded before drawing on canvas.
    try {
      await Promise.all([
        document.fonts.load(`700 90px ${nameFam}`),
        document.fonts.load(`600 40px ${bodyFam}`),
      ]);
    } catch {
      /* draw with fallbacks */
    }

    const canvas = document.createElement("canvas");
    canvas.width = ART_W;
    canvas.height = ART_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(img, 0, 0, ART_W, ART_H);

    // Script stays as typed (like a signature); the tech faces go uppercase.
    const displayName = fontKey === "script" ? name.trim() : name.trim().toUpperCase();
    const contactLine = contact.trim();
    const showContact = withContact && contactLine.length > 0;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;

    if (displayName) {
      // Fit the name inside the dashed panel with generous side padding —
      // it must never touch the dashes.
      const PAD = 120; // 60px clear air each side
      const trySpacing = "letterSpacing" in ctx;
      let size = fontKey === "script" ? 170 : 130;
      for (; size >= 24; size -= 2) {
        ctx.font = `700 ${size}px ${nameFam}`;
        if (trySpacing)
          (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
            fontKey === "script" ? "0px" : `${Math.round(size * 0.06)}px`;
        if (ctx.measureText(displayName).width <= BOX_W - PAD) break;
      }
      ctx.fillText(displayName, BOX_CX, BOX_CY);
    }

    if (showContact) {
      if ("letterSpacing" in ctx)
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "2px";
      // Bottom strip, clear of the name panel. Digits in the body face.
      let csize = 34;
      const line = `IN CASE OF EMERGENCY: ${contactLine.toUpperCase()}`;
      for (; csize >= 20; csize -= 2) {
        ctx.font = `600 ${csize}px ${bodyFam}`;
        if (ctx.measureText(line).width <= ART_W - 80) break;
      }
      ctx.fillStyle = "rgba(255,255,255,0.92)";
      ctx.fillText(line, ART_W / 2, ART_H - 52);
    }

    setDataUrl(canvas.toDataURL("image/jpeg", 0.92));
    setRendering(false);
  }, [name, contact, withContact, fontKey]);

  // Re-render preview when inputs change (debounced)
  useEffect(() => {
    if (loading) return;
    const t = setTimeout(render, 250);
    return () => clearTimeout(t);
  }, [render, loading]);

  async function handleShare() {
    if (!dataUrl) return;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], "node-2026-lockscreen.jpg", {
      type: "image/jpeg",
    });
    try {
      await navigator.share({ files: [file] });
    } catch {
      /* user cancelled */
    }
  }

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = "node-2026-lockscreen.jpg";
    a.click();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="flex items-center gap-2 font-heading text-2xl font-bold text-sand-100">
          <Smartphone className="h-6 w-6 text-pink-400" />
          Lock Screen
        </h1>
        <p className="mt-1 text-sm text-sand-400">
          Your phone gets lost at 3am. Your lock screen brings it home to 9
          &amp; G. Add your name, save it, set it as your wallpaper.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_320px]">
        {/* Preview */}
        <Card className="glass-card border-0">
          <CardContent className="flex items-center justify-center p-4">
            {dataUrl ? (
              // Plain <img> so iPhone long-press → "Save Image" works too.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={dataUrl}
                alt="Your NODE lock screen preview"
                className="max-h-[70vh] w-auto rounded-2xl shadow-2xl"
              />
            ) : (
              <div className="flex h-96 items-center justify-center text-sand-400">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Controls */}
        <Card className="glass-card h-fit border-0">
          <CardContent className="space-y-5 p-5">
            <div className="space-y-2">
              <Label htmlFor="ls-name" className="text-sand-300">
                Name on the lock screen
              </Label>
              <div className="flex gap-2">
                {(
                  [
                    { key: "playa", label: "Playa name" },
                    { key: "real", label: "Real name" },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => {
                      setNameSource(o.key);
                      setName(profileNames[o.key]);
                    }}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      nameSource === o.key
                        ? "bg-pink-500/20 text-pink-300 ring-1 ring-pink-400/40"
                        : "bg-white/5 text-sand-400 hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <Input
                id="ls-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                maxLength={24}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sand-300">Font</Label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "node", label: "NODE", cls: "font-brand" },
                    { key: "clean", label: "Clean", cls: "font-sans font-bold" },
                    { key: "script", label: "Script", cls: caveat.className },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    onClick={() => setFontKey(o.key)}
                    className={`rounded-lg px-2 py-2 text-sm transition-colors ${o.cls} ${
                      fontKey === o.key
                        ? "bg-pink-500/20 text-pink-200 ring-1 ring-pink-400/40"
                        : "bg-white/5 text-sand-300 hover:bg-white/10"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ls-ec" className="text-sand-300">
                Add emergency contact
              </Label>
              <Switch
                id="ls-ec"
                checked={withContact}
                onCheckedChange={setWithContact}
              />
            </div>

            {withContact && (
              <div className="space-y-2">
                <Label htmlFor="ls-contact" className="text-sand-300">
                  Emergency contact
                </Label>
                <Input
                  id="ls-contact"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="Jane · 555-123-4567"
                  maxLength={48}
                  disabled={loading}
                />
                <p className="text-xs text-sand-500">
                  Shown small under your name — worth it if your phone (or you)
                  wanders off.
                </p>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {canShare && (
                <Button
                  className="w-full bg-gradient-to-r from-pink-500 to-amber text-white"
                  onClick={handleShare}
                  disabled={!dataUrl || rendering}
                >
                  <Share2 className="mr-2 h-4 w-4" />
                  Save to Photos
                </Button>
              )}
              <Button
                variant={canShare ? "outline" : "default"}
                className="w-full"
                onClick={handleDownload}
                disabled={!dataUrl || rendering}
              >
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <p className="text-center text-xs text-sand-500">
                On iPhone you can also press and hold the preview, then Save
                Image. Set it: Settings → Wallpaper → Add New.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
