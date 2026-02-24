"use client";

import { useState, useRef, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  CheckCircle,
  User,
  Flame,
  Heart,
  ClipboardList,
  Send,
  Video,
  Camera,
  Square,
  Play,
  RotateCcw,
  Loader2,
} from "lucide-react";
import {
  submitApplication,
  uploadApplicationVideo,
} from "@/lib/actions/applications";

const steps = [
  { label: "Welcome", icon: Sparkles },
  { label: "Personal", icon: User },
  { label: "Experience", icon: Flame },
  { label: "Contribution", icon: Heart },
  { label: "Video", icon: Video },
  { label: "Review", icon: ClipboardList },
  { label: "Confirm", icon: Send },
];

const TEN_PRINCIPLES = [
  "Radical Inclusion",
  "Gifting",
  "Decommodification",
  "Radical Self-reliance",
  "Radical Self-expression",
  "Communal Effort",
  "Civic Responsibility",
  "Leaving No Trace",
  "Participation",
  "Immediacy"
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 200 : -200,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -200 : 200,
    opacity: 0,
  }),
};

export default function ApplyPage() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(0);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    playaName: "",
    yearsAttended: "",
    previousCamps: "",
    virginExpectations: "",
    favoritePrinciple: "",
    principleReason: "",
    skills: "",
    referredBy: "",
    videoFile: null as File | null,
    agreeTerms: false,
  });

  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  function next() {
    setDirection(1);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  }

  function prev() {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  }

  function update(field: string, value: any) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSubmit() {
    setSubmitError(null);
    startTransition(async () => {
      // Submit application data
      const result = await submitApplication({
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        playaName: form.playaName,
        yearsAttended: form.yearsAttended,
        previousCamps: form.previousCamps,
        favoritePrinciple: form.favoritePrinciple,
        principleReason: form.principleReason,
        skills: form.skills,
        referredBy: form.referredBy,
      });

      if ("error" in result) {
        setSubmitError(result.error);
        return;
      }

      // Upload video if present (non-blocking — application already saved)
      if (form.videoFile) {
        const videoFormData = new FormData();
        videoFormData.append("video", form.videoFile);
        const videoResult = await uploadApplicationVideo(
          result.id,
          videoFormData
        );
        if ("error" in videoResult) {
          toast.warning("Application saved, but video upload failed. Our team will follow up.");
        }
      }

      // Advance to confirmation step
      setDirection(1);
      setStep(steps.length - 1);
    });
  }

  const progress = ((step + 1) / steps.length) * 100;

  return (
    <main className="min-h-screen px-6 py-24">
      <div className="mx-auto max-w-xl">
        {/* Progress */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-sand-400">
              Step {step + 1} of {steps.length}
            </span>
            <span className="text-pink-400">{steps[step].label}</span>
          </div>
          <Progress value={progress} className="h-2 bg-blue-900/50" />
          {/* Step indicators */}
          <div className="mt-4 flex justify-between">
            {steps.map((s, i) => (
              <div
                key={s.label}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors ${i <= step
                  ? "bg-pink-500/20 text-pink-400"
                  : "bg-blue-900/30 text-sand-500"
                  }`}
              >
                <s.icon className="h-3.5 w-3.5" />
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="glass-card relative min-h-[400px] overflow-hidden rounded-2xl p-8">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {step === 0 && <WelcomeStep />}
              {step === 1 && <PersonalStep form={form} update={update} />}
              {step === 2 && <ExperienceStep form={form} update={update} />}
              {step === 3 && <ContributionStep form={form} update={update} />}
              {step === 4 && <VideoStep form={form} update={update} />}
              {step === 5 && <ReviewStep form={form} />}
              {step === 6 && <ConfirmStep />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error message */}
        {submitError && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
            {submitError}
          </div>
        )}

        {/* Navigation */}
        <div className="mt-6 flex justify-between">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={step === 0 || step === steps.length - 1 || isPending}
            className="text-sand-300 hover:text-sand-100"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          {step < steps.length - 1 && (
            <Button
              onClick={step === steps.length - 2 ? handleSubmit : next}
              disabled={isPending}
              className="rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : step === steps.length - 2 ? (
                "Submit"
              ) : (
                <>
                  Continue
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function WelcomeStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <Sparkles className="mb-4 h-12 w-12 text-pink-400" />
      <h2 className="text-3xl font-bold text-gradient-warm">
        Join <span className="font-brand">NODE</span>
      </h2>
      <p className="mt-4 max-w-md text-sand-300 leading-relaxed">
        We&apos;re thrilled that you want to join our camp! This quick 5-minute
        application helps us get to know you, whether you&apos;re a dusty veteran
        or heading to the playa for the very first time. Let&apos;s see what we
        can build together.
      </p>
      <div className="mt-8 space-y-2 text-left text-sm text-sand-400">
        <p>What we&apos;ll ask:</p>
        <ul className="list-inside list-disc space-y-1">
          <li>Basic personal information</li>
          <li>Your Burning Man experience</li>
          <li>How you want to contribute</li>
        </ul>
      </div>
    </div>
  );
}

function PersonalStep({
  form,
  update,
}: {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-sand-100">Personal Info</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-sand-300">First Name</Label>
          <Input
            value={form.firstName as string}
            onChange={(e) => update("firstName", e.target.value)}
            placeholder="Jane"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sand-300">Last Name</Label>
          <Input
            value={form.lastName as string}
            onChange={(e) => update("lastName", e.target.value)}
            placeholder="Doe"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label className="text-sand-300">Email</Label>
        <Input
          type="email"
          value={form.email as string}
          onChange={(e) => update("email", e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sand-300">Phone</Label>
        <Input
          type="tel"
          value={form.phone as string}
          onChange={(e) => update("phone", e.target.value)}
          placeholder="+1 (555) 000-0000"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sand-300">Playa Name (optional)</Label>
        <Input
          value={form.playaName as string}
          onChange={(e) => update("playaName", e.target.value)}
          placeholder="Your playa name"
        />
      </div>
    </div>
  );
}

function ExperienceStep({
  form,
  update,
}: {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-sand-100">
        Burning Man Experience
      </h2>
      <div className="space-y-2">
        <Label className="text-sand-300">
          How many years have you attended?
        </Label>
        <RadioGroup
          value={form.yearsAttended as string}
          onValueChange={(v) => update("yearsAttended", v)}
          className="space-y-2"
        >
          {["0 (Virgin)", "1-2", "3-5", "6+"].map((opt) => (
            <div key={opt} className="flex items-center space-x-3">
              <RadioGroupItem value={opt} id={opt} />
              <Label htmlFor={opt} className="text-sand-300">
                {opt}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>
      {form.yearsAttended && form.yearsAttended !== "0 (Virgin)" ? (
        <div className="space-y-2">
          <Label className="text-sand-300">
            Previous camps or communities
          </Label>
          <Textarea
            value={form.previousCamps as string}
            onChange={(e) => update("previousCamps", e.target.value)}
            placeholder="Tell us about any camps you've been part of and why you don't want to go back..."
            className="min-h-[100px]"
          />
        </div>
      ) : form.yearsAttended === "0 (Virgin)" ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sand-300">
              Which of the 10 Principles resonates with you the most?
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
              {TEN_PRINCIPLES.map(principle => (
                <Label
                  key={principle}
                  className={`flex items-center p-3 rounded-lg border transition-colors cursor-pointer ${form.favoritePrinciple === principle
                    ? "border-pink-500 bg-pink-500/10 text-pink-400"
                    : "border-blue-900/30 bg-blue-900/10 text-sand-300 hover:bg-blue-900/20"
                    }`}
                >
                  <input
                    type="radio"
                    name="favoritePrinciple"
                    className="hidden"
                    checked={form.favoritePrinciple === principle}
                    onChange={() => update("favoritePrinciple", principle)}
                  />
                  {principle}
                </Label>
              ))}
            </div>
          </div>

          {form.favoritePrinciple && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-4">
              <Label className="text-sand-300">
                Why did you choose {form.favoritePrinciple}?
              </Label>
              <Textarea
                value={form.principleReason as string}
                onChange={(e) => update("principleReason", e.target.value)}
                placeholder="Share your thoughts..."
                className="min-h-[100px]"
              />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ContributionStep({
  form,
  update,
}: {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}) {
  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-sand-100">Your Contribution</h2>
      <div className="space-y-2">
        <Label className="text-sand-300">What specific hard skills do you bring?</Label>
        <Textarea
          value={form.skills as string}
          onChange={(e) => update("skills", e.target.value)}
          placeholder="Construction, cooking, DJing, large-scale art, medical, heavy machinery..."
          className="min-h-[80px]"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-sand-300">Who from NODE referred you?</Label>
        <Input
          value={form.referredBy as string}
          onChange={(e) => update("referredBy", e.target.value)}
          placeholder="Name of your camp connection"
        />
      </div>
    </div>
  );
}

function VideoStep({
  form,
  update,
}: {
  form: Record<string, any>;
  update: (field: string, value: any) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], "node-application-video.webm", {
          type: "video/webm",
        });
        update("videoFile", file);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera or microphone. Please check your permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const cancelRecording = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setIsRecording(false);
    setShowRecorder(false);
  };

  const resetVideo = () => {
    update("videoFile", null);
  };

  return (
    <div className="space-y-5">
      <div className="text-center">
        <Video className="mx-auto mb-4 h-12 w-12 text-pink-400" />
        <h2 className="text-2xl font-bold text-sand-100">Video Submission</h2>
        <p className="mt-2 text-sand-300 text-sm">
          We want to get to know the real you! Please upload or record a short video (1-2 minutes) introducing yourself.
        </p>
      </div>
      <div className="space-y-4 rounded-xl border border-blue-900/30 bg-blue-900/10 p-6">
        <div className="space-y-2 text-sm text-sand-200">
          <p className="font-semibold text-pink-400">What to include:</p>
          <ul className="list-inside list-disc space-y-1 ml-2">
            <li>Who are you and where are you from?</li>
            <li>Why do you want to join NODE?</li>
            <li>How do you see yourself contributing to the camp?</li>
            <li>Show us your personality!</li>
          </ul>
        </div>

        <div className="mt-6 border-2 border-dashed border-blue-900/50 rounded-lg overflow-hidden transition-colors">
          {form.videoFile ? (
            <div className="p-4 flex flex-col items-center space-y-4 bg-blue-950/30">
              <video
                src={URL.createObjectURL(form.videoFile)}
                controls
                className="w-full max-w-sm rounded-lg border border-blue-900/50"
              />
              <div className="flex items-center gap-3 w-full max-w-sm">
                <div className="flex-1 p-3 bg-blue-950/80 rounded-md flex items-center justify-between">
                  <span className="text-sm text-sand-200 truncate pr-4">
                    {(form.videoFile as File).name}
                  </span>
                  <span className="text-xs text-green-400 font-medium whitespace-nowrap">Ready</span>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 border-blue-800 hover:bg-red-500/10 hover:text-red-400"
                  onClick={resetVideo}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : showRecorder ? (
            <div className="p-4 flex flex-col items-center space-y-4 bg-blue-950/30">
              <div className="relative w-full max-w-sm aspect-video bg-black rounded-lg overflow-hidden border border-blue-900/50">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                {isRecording && (
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-2 py-1 rounded-full bg-black/50 backdrop-blur text-xs font-medium text-red-500">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    Recording
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {!isRecording ? (
                  <>
                    <Button
                      variant="ghost"
                      className="text-sand-400 hover:text-sand-200"
                      onClick={cancelRecording}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={startRecording}
                      className="bg-red-500 text-white hover:bg-red-600 rounded-full h-12 w-12 p-0 flex items-center justify-center glow-red"
                    >
                      <Camera className="h-5 w-5" />
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={stopRecording}
                    className="bg-red-500 text-white hover:bg-red-600 rounded-md h-10 px-6 font-medium animate-pulse"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="p-8 flex flex-col md:flex-row items-center justify-center gap-4 hover:bg-blue-900/10">
              <Button
                variant="outline"
                className="w-full md:w-auto border-blue-800 bg-blue-950/50 hover:bg-pink-500/20 hover:text-pink-400 hover:border-pink-500/50 h-16 px-6"
                onClick={() => setShowRecorder(true)}
              >
                <Camera className="mr-3 h-5 w-5" />
                Record Now
              </Button>

              <div className="text-sand-500 text-sm font-medium">OR</div>

              <div className="relative w-full md:w-auto">
                <Input
                  type="file"
                  accept="video/*"
                  className="hidden"
                  id="video-upload"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) update("videoFile", file);
                  }}
                />
                <Label
                  htmlFor="video-upload"
                  className="flex items-center justify-center w-full md:w-auto h-16 px-6 font-medium text-sm rounded-md border border-blue-800 bg-blue-950/50 cursor-pointer hover:bg-pink-500/20 hover:text-pink-400 hover:border-pink-500/50 transition-colors"
                >
                  <Video className="mr-3 h-5 w-5" />
                  Upload Video
                </Label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewStep({ form }: { form: Record<string, any> }) {
  const fields = [
    { label: "Name", value: `${form.firstName} ${form.lastName}` },
    { label: "Email", value: form.email },
    { label: "Phone", value: form.phone },
    { label: "Playa Name", value: form.playaName || "—" },
    { label: "Years Attended", value: form.yearsAttended || "—" },
    ...(form.yearsAttended === "0 (Virgin)"
      ? [
        {
          label: "Favorite Principle",
          value: form.favoritePrinciple || "—",
        },
        {
          label: "Reason",
          value: form.principleReason || "—",
        }
      ]
      : [{ label: "Previous Camps", value: form.previousCamps || "—" }]),
    { label: "Skills", value: form.skills || "—" },
    { label: "Referred By", value: form.referredBy || "—" },
    { label: "Video", value: form.videoFile ? "Uploaded" : "—" },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-bold text-sand-100">Review</h2>
      <p className="text-sm text-sand-400">
        Please review your application before submitting.
      </p>
      <div className="space-y-3">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-xs font-medium text-pink-400">{f.label}</p>
            <p className="mt-0.5 text-sm text-sand-200">
              {f.value as string}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfirmStep() {
  return (
    <div className="flex flex-col items-center text-center">
      <CheckCircle className="mb-4 h-16 w-16 text-pink-400" />
      <h2 className="text-3xl font-bold text-gradient-warm">
        Application Submitted!
      </h2>
      <p className="mt-4 text-sand-300">
        Thank you for applying to NODE. We&apos;ll review your application
        and get back to you within 2 weeks.
      </p>
      <p className="mt-6 text-sm text-sand-500">
        Keep an eye on your email for updates.
      </p>
    </div>
  );
}
