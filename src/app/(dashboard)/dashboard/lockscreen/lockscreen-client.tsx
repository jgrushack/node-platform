"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, Loader2, Share2, Smartphone } from "lucide-react";

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
        .select("first_name, playa_name, emergency_contact")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setName((data.playa_name || data.first_name || "").trim());
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

    const headingFam = resolveFamily("font-heading");
    const bodyFam = resolveFamily("font-sans");
    // Make sure the faces are actually loaded before drawing on canvas.
    try {
      await Promise.all([
        document.fonts.load(`700 90px ${headingFam}`),
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

    const displayName = name.trim().toUpperCase();
    const contactLine = contact.trim();
    const showContact = withContact && contactLine.length > 0;

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(255,255,255,0.96)";
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 3;

    if (displayName) {
      // Fit the name inside the dashed panel (match the poster's letterspacing)
      let size = showContact ? 96 : 110;
      const trySpacing = "letterSpacing" in ctx;
      for (; size >= 34; size -= 4) {
        ctx.font = `700 ${size}px ${headingFam}`;
        if (trySpacing)
          (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(size * 0.12)}px`;
        if (ctx.measureText(displayName).width <= BOX_W - 60) break;
      }
      const nameY = showContact ? BOX_CY - 32 : BOX_CY;
      ctx.fillText(displayName, BOX_CX, nameY);
    }

    if (showContact) {
      if ("letterSpacing" in ctx)
        (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = "2px";
      // Numbers stay in the body face — Neuropol digits are unreadable.
      let csize = 44;
      const line = `IN CASE OF EMERGENCY: ${contactLine}`;
      for (; csize >= 22; csize -= 2) {
        ctx.font = `600 ${csize}px ${bodyFam}`;
        if (ctx.measureText(line).width <= BOX_W - 60) break;
      }
      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.fillText(line, BOX_CX, BOX_CY + 52);
    }

    setDataUrl(canvas.toDataURL("image/jpeg", 0.92));
    setRendering(false);
  }, [name, contact, withContact]);

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
              <Input
                id="ls-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Playa name"
                maxLength={24}
                disabled={loading}
              />
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
