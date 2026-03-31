"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import {
  CreditCard,
  DollarSign,
  CheckCircle2,
  ArrowLeft,
  ArrowRight,
  Loader2,
  Tent,
  Package,
  FileSpreadsheet,
  Minus,
  Plus,
  Wallet,
  Building2,
  Bitcoin,
  Copy,
  ExternalLink,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ── Constants ──────────────────────────────────────────────────────

const DUES_TIERS = [
  { amount: 1200, label: "$1,200", description: "Reduced" },
  { amount: 1650, label: "$1,650", description: "Standard" },
  { amount: 2000, label: "$2,000", description: "Full" },
  { amount: 2500, label: "$2,500", description: "Supporter" },
  { amount: 5000, label: "$5,000", description: "Patron" },
  { amount: 10000, label: "$10,000", description: "Benefactor" },
];

const PAYMENT_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

const DEPOSIT_AMOUNT = 500; // TBD — placeholder

const STORAGE_ITEMS = [
  { key: "bins", label: "Storage Bins", price: 50, icon: Package, unit: "bin" },
  { key: "bikes", label: "Bikes", price: 75, icon: Package, unit: "bike" },
  { key: "ac", label: "AC Units", price: 100, icon: Package, unit: "unit" },
] as const;

const EQUIPMENT_ITEMS = [
  { name: "Shiftpod", description: "Premium tent with AC hookup", price: "TBD" },
  { name: "Kodiak Canvas Tent", description: "Heavy-duty canvas tent (10x14)", price: "TBD" },
  { name: "Hexayurt", description: "Pre-built hexayurt panel kit", price: "TBD" },
  { name: "Cot + Sleeping Pad", description: "Standard cot with foam pad", price: "TBD" },
];

// Placeholder crypto address
const CRYPTO_ADDRESS = "0x0000000000000000000000000000000000000000";

// ── Types ──────────────────────────────────────────────────────────

type View = "dashboard" | "dues" | "equipment" | "storage";
type PaymentType = "full" | "plan" | "deposit";
type PaymentMethod = "cc" | "bank" | "crypto";

interface StorageQuantities {
  bins: number;
  bikes: number;
  ac: number;
}

// ── Main Component ─────────────────────────────────────────────────

export function PaymentsClient() {
  const [view, setView] = useState<View>("dashboard");
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: invoices } = await supabase
        .from("invoices")
        .select("amount_cents, amount_paid_cents, status")
        .eq("profile_id", user.id)
        .not("status", "in", '("cancelled","refunded")');

      if (invoices && invoices.length > 0) {
        const total = invoices.reduce(
          (acc, inv) => acc + (inv.amount_cents - inv.amount_paid_cents),
          0
        );
        setBalance(total / 100);
      } else {
        setBalance(0);
      }
      setLoading(false);
    }
    fetchBalance();
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AnimatePresence mode="wait">
        {view === "dashboard" && (
          <DashboardView
            key="dashboard"
            balance={balance}
            loading={loading}
            onNavigate={setView}
          />
        )}
        {view === "dues" && (
          <DuesFlow key="dues" onBack={() => setView("dashboard")} />
        )}
        {view === "equipment" && (
          <EquipmentView key="equipment" onBack={() => setView("dashboard")} />
        )}
        {view === "storage" && (
          <StorageFlow key="storage" onBack={() => setView("dashboard")} />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────

function DashboardView({
  balance,
  loading,
  onNavigate,
}: {
  balance: number | null;
  loading: boolean;
  onNavigate: (view: View) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold text-sand-100">Payments</h1>
        <p className="mt-1 text-sand-400">Manage your NODE 2026 dues and payments.</p>
      </div>

      {/* Balance Summary */}
      <Card className="glass-card border-0">
        <CardContent className="flex items-center justify-between py-6">
          <div>
            <p className="text-xs uppercase tracking-wider text-sand-400">
              Total Balance
            </p>
            <p className="mt-1 text-lg font-bold text-sand-400">
              Coming Soon
            </p>
          </div>
          <DollarSign className="h-8 w-8 text-sand-600" />
        </CardContent>
      </Card>

      {/* Payment Options Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card
          className="glass-card border-0 cursor-pointer transition-all hover:ring-1 hover:ring-pink-500/30 hover:shadow-[0_0_20px_rgba(236,72,153,0.1)]"
          onClick={() => onNavigate("dues")}
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pink-500/15">
              <CreditCard className="h-5 w-5 text-pink-400" />
            </div>
            <div>
              <p className="font-semibold text-sand-100">Pay Dues</p>
              <p className="text-xs text-sand-400">2026 camp dues</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="glass-card border-0 cursor-pointer transition-all hover:ring-1 hover:ring-amber/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)]"
          onClick={() => onNavigate("equipment")}
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/15">
              <Tent className="h-5 w-5 text-amber" />
            </div>
            <div>
              <p className="font-semibold text-sand-100">Rent Equipment</p>
              <p className="text-xs text-sand-400">Tents & gear on playa</p>
            </div>
          </CardContent>
        </Card>

        <Card
          className="glass-card border-0 cursor-pointer transition-all hover:ring-1 hover:ring-blue-500/30 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]"
          onClick={() => onNavigate("storage")}
        >
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15">
              <Package className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sand-100">Pay for Storage</p>
              <p className="text-xs text-sand-400">Bins, bikes & AC units</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-0 cursor-pointer transition-all hover:ring-1 hover:ring-emerald-500/30 hover:shadow-[0_0_20px_rgba(16,185,129,0.1)]">
          <CardContent className="flex items-center gap-4 py-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-sand-100">2026 Budget</p>
              <p className="text-xs text-sand-400">View camp budget</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}

// ── Pay Dues Flow ──────────────────────────────────────────────────

function DuesFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [frequency, setFrequency] = useState<string>("monthly");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);

  const totalSteps = 4;

  function handlePaymentSubmit() {
    setProcessing(true);
    // Placeholder — will integrate Stripe/Mercury/crypto later
    setTimeout(() => {
      setProcessing(false);
      toast.success("Payment submitted! (Demo mode — no charge processed)");
      onBack();
    }, 2000);
  }

  function getPaymentAmount(): number {
    if (!selectedTier) return 0;
    if (paymentType === "full") return selectedTier;
    if (paymentType === "deposit") return DEPOSIT_AMOUNT;
    return selectedTier; // plan shows full amount, broken into installments
  }

  function getInstallmentAmount(): number | null {
    if (paymentType !== "plan" || !selectedTier) return null;
    const freq = frequency;
    // Rough installment calculation based on frequency until burn (late Aug)
    const now = new Date();
    const burnDate = new Date(2026, 7, 23); // Aug 23, 2026
    const msRemaining = burnDate.getTime() - now.getTime();
    const weeksRemaining = Math.max(1, Math.floor(msRemaining / (7 * 24 * 60 * 60 * 1000)));

    let numPayments: number;
    if (freq === "weekly") numPayments = weeksRemaining;
    else if (freq === "biweekly") numPayments = Math.max(1, Math.floor(weeksRemaining / 2));
    else numPayments = Math.max(1, Math.floor(weeksRemaining / 4.33));

    return Math.ceil(selectedTier / numPayments);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-sand-400 hover:text-sand-200"
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-sand-100">Pay Dues</h1>
          <p className="text-xs text-sand-400">
            Step {step} of {totalSteps}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }, (_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i < step ? "bg-pink-500" : "bg-sand-800"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Choose Tier */}
        {step === 1 && (
          <motion.div
            key="tier"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-sm text-sand-300">
              Choose your 2026 dues contribution level.
            </p>
            <div className="grid gap-3">
              {DUES_TIERS.map((tier) => (
                <Card
                  key={tier.amount}
                  className={`glass-card border-0 cursor-pointer transition-all ${
                    selectedTier === tier.amount
                      ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                      : "hover:ring-1 hover:ring-pink-500/20"
                  }`}
                  onClick={() => setSelectedTier(tier.amount)}
                >
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-4 w-4 rounded-full border-2 transition-colors ${
                          selectedTier === tier.amount
                            ? "border-pink-500 bg-pink-500"
                            : "border-sand-600"
                        }`}
                      />
                      <div>
                        <span className="font-semibold text-sand-100">
                          {tier.label}
                        </span>
                        <span className="ml-2 text-xs text-sand-400">
                          {tier.description}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Button
              className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              disabled={!selectedTier}
              onClick={() => setStep(2)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Payment Type */}
        {step === 2 && (
          <motion.div
            key="type"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-sm text-sand-300">
              How would you like to pay your{" "}
              <span className="text-sand-100 font-medium">
                ${selectedTier?.toLocaleString()}
              </span>{" "}
              dues?
            </p>
            <div className="grid gap-3">
              {/* Full Balance */}
              <Card
                className={`glass-card border-0 cursor-pointer transition-all ${
                  paymentType === "full"
                    ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                    : "hover:ring-1 hover:ring-pink-500/20"
                }`}
                onClick={() => setPaymentType("full")}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 transition-colors ${
                        paymentType === "full"
                          ? "border-pink-500 bg-pink-500"
                          : "border-sand-600"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-sand-100">
                        Pay in Full
                      </p>
                      <p className="text-xs text-sand-400">
                        ${selectedTier?.toLocaleString()} today
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payment Plan */}
              <Card
                className={`glass-card border-0 cursor-pointer transition-all ${
                  paymentType === "plan"
                    ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                    : "hover:ring-1 hover:ring-pink-500/20"
                }`}
                onClick={() => setPaymentType("plan")}
              >
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 transition-colors ${
                        paymentType === "plan"
                          ? "border-pink-500 bg-pink-500"
                          : "border-sand-600"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-sand-100">
                        Payment Plan
                      </p>
                      <p className="text-xs text-sand-400">
                        Split into recurring payments
                      </p>
                    </div>
                  </div>
                  {paymentType === "plan" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="ml-7 space-y-3"
                    >
                      <Label className="text-sand-300 text-xs">Frequency</Label>
                      <RadioGroup
                        value={frequency}
                        onValueChange={setFrequency}
                        className="flex gap-3"
                      >
                        {PAYMENT_FREQUENCIES.map((f) => (
                          <div key={f.value} className="flex items-center gap-1.5">
                            <RadioGroupItem
                              value={f.value}
                              id={`freq-${f.value}`}
                              className="border-sand-600 text-pink-500"
                            />
                            <Label
                              htmlFor={`freq-${f.value}`}
                              className="text-xs text-sand-300 cursor-pointer"
                            >
                              {f.label}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                      {getInstallmentAmount() && (
                        <p className="text-xs text-sand-400">
                          ≈{" "}
                          <span className="text-sand-200 font-medium">
                            ${getInstallmentAmount()?.toLocaleString()}
                          </span>{" "}
                          per payment
                        </p>
                      )}
                    </motion.div>
                  )}
                </CardContent>
              </Card>

              {/* Deposit */}
              <Card
                className={`glass-card border-0 cursor-pointer transition-all ${
                  paymentType === "deposit"
                    ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                    : "hover:ring-1 hover:ring-pink-500/20"
                }`}
                onClick={() => setPaymentType("deposit")}
              >
                <CardContent className="py-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 transition-colors ${
                        paymentType === "deposit"
                          ? "border-pink-500 bg-pink-500"
                          : "border-sand-600"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-sand-100">Deposit</p>
                      <p className="text-xs text-sand-400">
                        ${DEPOSIT_AMOUNT.toLocaleString()} deposit today,
                        remainder later
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Button
              className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              disabled={!paymentType}
              onClick={() => setStep(3)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Step 3: Payment Method */}
        {step === 3 && (
          <motion.div
            key="method"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-sm text-sand-300">
              How would you like to pay?
            </p>

            {/* Summary */}
            <Card className="glass-card border-0">
              <CardContent className="py-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-sand-400">Dues tier</span>
                  <span className="text-sand-200">${selectedTier?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-sand-400">Payment</span>
                  <span className="text-sand-200">
                    {paymentType === "full" && "Pay in full"}
                    {paymentType === "plan" && `Payment plan (${frequency})`}
                    {paymentType === "deposit" && "Deposit"}
                  </span>
                </div>
                <Separator className="bg-pink-500/10 !my-2" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-sand-300">Due today</span>
                  <span className="text-sand-100">
                    ${(paymentType === "deposit"
                      ? DEPOSIT_AMOUNT
                      : paymentType === "plan"
                        ? getInstallmentAmount() ?? 0
                        : selectedTier ?? 0
                    ).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-3">
              <Card
                className={`glass-card border-0 cursor-pointer transition-all ${
                  paymentMethod === "cc"
                    ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                    : "hover:ring-1 hover:ring-pink-500/20"
                }`}
                onClick={() => setPaymentMethod("cc")}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <div
                    className={`h-4 w-4 rounded-full border-2 transition-colors ${
                      paymentMethod === "cc"
                        ? "border-pink-500 bg-pink-500"
                        : "border-sand-600"
                    }`}
                  />
                  <CreditCard className="h-4 w-4 text-sand-400" />
                  <span className="font-medium text-sand-100">
                    Credit / Debit Card
                  </span>
                </CardContent>
              </Card>

              <Card
                className={`glass-card border-0 cursor-pointer transition-all ${
                  paymentMethod === "bank"
                    ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                    : "hover:ring-1 hover:ring-pink-500/20"
                }`}
                onClick={() => setPaymentMethod("bank")}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <div
                    className={`h-4 w-4 rounded-full border-2 transition-colors ${
                      paymentMethod === "bank"
                        ? "border-pink-500 bg-pink-500"
                        : "border-sand-600"
                    }`}
                  />
                  <Building2 className="h-4 w-4 text-sand-400" />
                  <span className="font-medium text-sand-100">
                    Bank Transfer
                  </span>
                  <Badge className="ml-auto bg-amber/15 text-amber text-[10px]">
                    Mercury
                  </Badge>
                </CardContent>
              </Card>

              <Card
                className={`glass-card border-0 cursor-pointer transition-all ${
                  paymentMethod === "crypto"
                    ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                    : "hover:ring-1 hover:ring-pink-500/20"
                }`}
                onClick={() => setPaymentMethod("crypto")}
              >
                <CardContent className="flex items-center gap-3 py-4">
                  <div
                    className={`h-4 w-4 rounded-full border-2 transition-colors ${
                      paymentMethod === "crypto"
                        ? "border-pink-500 bg-pink-500"
                        : "border-sand-600"
                    }`}
                  />
                  <Bitcoin className="h-4 w-4 text-sand-400" />
                  <span className="font-medium text-sand-100">Crypto</span>
                </CardContent>
              </Card>
            </div>

            <Button
              className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              disabled={!paymentMethod}
              onClick={() => setStep(4)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Step 4: Payment Page */}
        {step === 4 && (
          <motion.div
            key="pay"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-sm text-sand-300">
              Complete your payment.
            </p>

            {paymentMethod === "cc" && (
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sand-200 text-base">
                    <CreditCard className="h-4 w-4 text-pink-400" />
                    Card Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sand-300">Card Number</Label>
                    <Input placeholder="4242 4242 4242 4242" disabled />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sand-300">Expiry</Label>
                      <Input placeholder="MM / YY" disabled />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sand-300">CVC</Label>
                      <Input placeholder="123" disabled />
                    </div>
                  </div>
                  <p className="text-[10px] text-sand-500">
                    Stripe integration coming soon. No charges will be processed.
                  </p>
                </CardContent>
              </Card>
            )}

            {paymentMethod === "bank" && (
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sand-200 text-base">
                    <Building2 className="h-4 w-4 text-amber" />
                    Mercury Invoice
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-sand-300">
                    A Mercury invoice will be sent to your email with wire
                    transfer instructions.
                  </p>
                  <div className="rounded-lg bg-sand-900/50 p-4 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-sand-400">Amount</span>
                      <span className="text-sand-200 font-medium">
                        ${getPaymentAmount().toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-sand-400">Status</span>
                      <Badge className="bg-amber/15 text-amber text-[10px]">
                        Pending
                      </Badge>
                    </div>
                  </div>
                  <p className="text-[10px] text-sand-500">
                    Mercury integration coming soon.
                  </p>
                </CardContent>
              </Card>
            )}

            {paymentMethod === "crypto" && (
              <Card className="glass-card border-0">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sand-200 text-base">
                    <Bitcoin className="h-4 w-4 text-orange-400" />
                    Crypto Payment
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-sand-300">
                    Send exactly{" "}
                    <span className="font-medium text-sand-100">
                      ${getPaymentAmount().toLocaleString()}
                    </span>{" "}
                    equivalent to the following address:
                  </p>
                  <div className="flex items-center gap-2 rounded-lg bg-sand-900/50 p-3">
                    <code className="flex-1 text-xs text-sand-300 truncate font-mono">
                      {CRYPTO_ADDRESS}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 h-7 w-7 text-sand-400 hover:text-sand-200"
                      onClick={() => {
                        navigator.clipboard.writeText(CRYPTO_ADDRESS);
                        toast.success("Address copied!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-[10px] text-sand-500">
                    Crypto wallet address TBD. No payments accepted yet.
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Amount Summary */}
            <Card className="glass-card border-0">
              <CardContent className="py-4">
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-sand-300">Amount due</span>
                  <span className="text-lg text-sand-100">
                    ${(paymentType === "deposit"
                      ? DEPOSIT_AMOUNT
                      : paymentType === "plan"
                        ? getInstallmentAmount() ?? 0
                        : selectedTier ?? 0
                    ).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              disabled={processing}
              onClick={handlePaymentSubmit}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Submit Payment
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Equipment View (Placeholder) ───────────────────────────────────

function EquipmentView({ onBack }: { onBack: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-sand-400 hover:text-sand-200"
          onClick={onBack}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-sand-100">Rent Equipment</h1>
          <p className="text-xs text-sand-400">On-playa gear from NODE</p>
        </div>
      </div>

      <Card className="glass-card border-0">
        <CardHeader>
          <CardTitle className="text-sand-200">
            Available Equipment
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-sand-300">
            NODE has tents and gear available for rent on playa. Reserve yours
            to guarantee availability.
          </p>
          <Separator className="bg-pink-500/10" />
          {EQUIPMENT_ITEMS.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between py-2"
            >
              <div>
                <p className="text-sm font-medium text-sand-200">
                  {item.name}
                </p>
                <p className="text-xs text-sand-400">{item.description}</p>
              </div>
              <Badge className="bg-sand-800 text-sand-400 text-xs">
                {item.price}
              </Badge>
            </div>
          ))}
          <Separator className="bg-pink-500/10" />
          <p className="text-xs text-sand-500 text-center">
            Pricing and availability coming soon.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Storage Flow ───────────────────────────────────────────────────

function StorageFlow({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(1);
  const [quantities, setQuantities] = useState<StorageQuantities>({
    bins: 0,
    bikes: 0,
    ac: 0,
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [processing, setProcessing] = useState(false);

  const totalPrice = STORAGE_ITEMS.reduce(
    (sum, item) => sum + quantities[item.key] * item.price,
    0
  );

  function updateQuantity(key: keyof StorageQuantities, delta: number) {
    setQuantities((prev) => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta),
    }));
  }

  function handleSubmit() {
    setProcessing(true);
    setTimeout(() => {
      setProcessing(false);
      toast.success("Storage payment submitted! (Demo mode)");
      onBack();
    }, 2000);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-sand-400 hover:text-sand-200"
          onClick={step === 1 ? onBack : () => setStep(step - 1)}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-sand-100">
            Pay for Storage
          </h1>
          <p className="text-xs text-sand-400">
            Step {step} of {step <= 2 ? 3 : 3}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-colors ${
              s <= step ? "bg-blue-500" : "bg-sand-800"
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Choose quantities */}
        {step === 1 && (
          <motion.div
            key="qty"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-sm text-sand-300">
              Select items you need stored.
            </p>
            <Card className="glass-card border-0">
              <CardContent className="divide-y divide-sand-800/50 py-2">
                {STORAGE_ITEMS.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between py-4"
                  >
                    <div>
                      <p className="text-sm font-medium text-sand-200">
                        {item.label}
                      </p>
                      <p className="text-xs text-sand-400">
                        ${item.price} / {item.unit}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-sand-700 text-sand-400 hover:text-sand-200"
                        onClick={() => updateQuantity(item.key, -1)}
                        disabled={quantities[item.key] === 0}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium text-sand-200">
                        {quantities[item.key]}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 border-sand-700 text-sand-400 hover:text-sand-200"
                        onClick={() => updateQuantity(item.key, 1)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {totalPrice > 0 && (
              <Card className="glass-card border-0">
                <CardContent className="flex justify-between py-4">
                  <span className="text-sm font-semibold text-sand-300">
                    Total
                  </span>
                  <span className="text-lg font-bold text-sand-100">
                    ${totalPrice.toLocaleString()}
                  </span>
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full rounded-full bg-blue-500 text-white hover:bg-blue-600"
              disabled={totalPrice === 0}
              onClick={() => setStep(2)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Payment Method */}
        {step === 2 && (
          <motion.div
            key="method"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-sm text-sand-300">
              How would you like to pay{" "}
              <span className="font-medium text-sand-100">
                ${totalPrice.toLocaleString()}
              </span>
              ?
            </p>

            <div className="grid gap-3">
              {([
                { key: "cc" as const, icon: CreditCard, label: "Credit / Debit Card" },
                { key: "bank" as const, icon: Building2, label: "Bank Transfer" },
                { key: "crypto" as const, icon: Bitcoin, label: "Crypto" },
              ]).map((m) => (
                <Card
                  key={m.key}
                  className={`glass-card border-0 cursor-pointer transition-all ${
                    paymentMethod === m.key
                      ? "ring-2 ring-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                      : "hover:ring-1 hover:ring-blue-500/20"
                  }`}
                  onClick={() => setPaymentMethod(m.key)}
                >
                  <CardContent className="flex items-center gap-3 py-4">
                    <div
                      className={`h-4 w-4 rounded-full border-2 transition-colors ${
                        paymentMethod === m.key
                          ? "border-blue-500 bg-blue-500"
                          : "border-sand-600"
                      }`}
                    />
                    <m.icon className="h-4 w-4 text-sand-400" />
                    <span className="font-medium text-sand-100">{m.label}</span>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Button
              className="w-full rounded-full bg-blue-500 text-white hover:bg-blue-600"
              disabled={!paymentMethod}
              onClick={() => setStep(3)}
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {/* Step 3: Payment */}
        {step === 3 && (
          <motion.div
            key="pay"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {/* Summary */}
            <Card className="glass-card border-0">
              <CardContent className="py-4 space-y-2">
                {STORAGE_ITEMS.filter((item) => quantities[item.key] > 0).map(
                  (item) => (
                    <div
                      key={item.key}
                      className="flex justify-between text-sm"
                    >
                      <span className="text-sand-400">
                        {item.label} x{quantities[item.key]}
                      </span>
                      <span className="text-sand-200">
                        ${(quantities[item.key] * item.price).toLocaleString()}
                      </span>
                    </div>
                  )
                )}
                <Separator className="bg-pink-500/10 !my-2" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-sand-300">Total</span>
                  <span className="text-lg text-sand-100">
                    ${totalPrice.toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <p className="text-[10px] text-sand-500 text-center">
              Payment processing coming soon. No charges will be made.
            </p>

            <Button
              className="w-full rounded-full bg-blue-500 text-white hover:bg-blue-600"
              disabled={processing}
              onClick={handleSubmit}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Submit Payment
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
