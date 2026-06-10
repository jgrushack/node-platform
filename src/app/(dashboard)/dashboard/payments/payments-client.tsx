"use client";

import { useState, useEffect, Children, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
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
  Wallet,
  Pencil,
  Plus,
  Minus,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { StorageSurveyModal } from "@/components/dashboard/storage-survey-modal";
import {
  getStorageSurvey,
  type GetStorageSurveyResult,
} from "@/lib/actions/storage-survey";
import {
  createStoragePaymentCheckout,
  createEquipmentPaymentCheckout,
  getDuesStatus,
  type DuesStatusResult,
} from "@/lib/actions/payments";
import {
  getEquipmentCatalog,
  reserveEquipment,
  type GetEquipmentCatalogResult,
  type CatalogItem,
  type EquipmentSelection,
} from "@/lib/actions/equipment";

// ── Constants ──────────────────────────────────────────────────────

const DUES_TIERS = [
  { amount: 500, label: "$500", description: "" },
  { amount: 1200, label: "$1,200", description: "Reduced" },
  { amount: 1500, label: "$1,500", description: "Reduced" },
  { amount: 1900, label: "$1,900", description: "Full dues" },
  { amount: 2400, label: "$2,400", description: "Donor" },
  { amount: 8000, label: "$8,000", description: "Benefactor" },
];

const PAYMENT_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

// ── Types ──────────────────────────────────────────────────────────

type View = "dashboard" | "dues" | "equipment";
type PaymentType = "full" | "plan";

// Narrowed success arms of the status reads (drop the {error} variant).
type DuesStatus = Extract<DuesStatusResult, { exists: boolean }>;
type StorageStatus = Extract<GetStorageSurveyResult, { hasInvoice: boolean }>;
type EquipmentStatus = Extract<GetEquipmentCatalogResult, { hasInvoice: boolean }>;

// ── Main Component ─────────────────────────────────────────────────

export function PaymentsClient() {
  const [view, setView] = useState<View>("dashboard");
  const [balance, setBalance] = useState<number | null>(null);
  const [hasTicketInvoice, setHasTicketInvoice] = useState(false);
  const [hasProcessing, setHasProcessing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dues, setDues] = useState<DuesStatus | null>(null);
  const [storage, setStorage] = useState<StorageStatus | null>(null);
  const [equipment, setEquipment] = useState<EquipmentStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [showStorageEdit, setShowStorageEdit] = useState(false);

  async function refreshBalance() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data: invoices } = await supabase
      .from("invoices")
      .select("amount_cents, amount_paid_cents, status, description")
      .eq("profile_id", user.id)
      .not("status", "in", '("cancelled","refunded")');

    setHasProcessing((invoices ?? []).some((inv) => inv.status === "processing"));

    if (invoices && invoices.length > 0) {
      const total = invoices.reduce(
        (acc, inv) => acc + (inv.amount_cents - inv.amount_paid_cents),
        0
      );
      setBalance(total / 100);
      setHasTicketInvoice(
        invoices.some((inv) =>
          (inv.description ?? "").toLowerCase().includes("main sale ticket")
        )
      );
    } else {
      setBalance(0);
    }
    setLoading(false);
  }

  async function refreshStatuses() {
    const [d, s, e] = await Promise.all([
      getDuesStatus(),
      getStorageSurvey(),
      getEquipmentCatalog(),
    ]);
    setDues("error" in d ? null : d);
    setStorage("error" in s ? null : s);
    setEquipment("error" in e ? null : e);
    setStatusLoading(false);
  }

  useEffect(() => {
    void (async () => {
      await refreshBalance();
      await refreshStatuses();
    })();
  }, []);

  // Returning from Stripe-hosted Checkout: surface the result + clean the URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clean = () =>
      window.history.replaceState({}, "", "/dashboard/payments");
    if (
      params.get("dues_cancel") ||
      params.get("storage_cancel") ||
      params.get("equipment_cancel")
    ) {
      toast.info("Checkout canceled — no charge made.");
      clean();
      return;
    }
    if (params.get("dues_session")) {
      (async () => {
        const s = await getDuesStatus();
        if (!("error" in s) && s.status === "processing") {
          toast.success(
            "Bank payment initiated — it clears in 3–5 business days."
          );
        } else {
          toast.success("Payment received — your balance will update shortly.");
        }
        clean();
        // Webhook has usually credited the invoice by the time we land here;
        // re-read so the balance + section cards reflect the new state.
        await refreshBalance();
        await refreshStatuses();
      })();
    } else if (params.get("storage_session")) {
      clean();
      void (async () => {
        const s = await getStorageSurvey();
        if (!("error" in s) && s.status === "processing") {
          toast.success("Bank payment initiated — it clears in 3–5 business days.");
        } else {
          toast.success(
            "Storage payment received — your balance will update shortly."
          );
        }
        await refreshBalance();
        await refreshStatuses();
      })();
    } else if (params.get("equipment_session")) {
      clean();
      void (async () => {
        const e = await getEquipmentCatalog();
        if (!("error" in e) && e.status === "processing") {
          toast.success("Bank payment initiated — it clears in 3–5 business days.");
        } else {
          toast.success(
            "Equipment payment received — your balance will update shortly."
          );
        }
        await refreshBalance();
        await refreshStatuses();
      })();
    }
  }, []);

  async function handlePayStorage() {
    const res = await createStoragePaymentCheckout();
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    window.location.href = res.url;
  }

  async function handlePayEquipment() {
    const res = await createEquipmentPaymentCheckout();
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    window.location.href = res.url;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AnimatePresence mode="wait">
        {view === "dashboard" && (
          <DashboardView
            key="dashboard"
            balance={balance}
            hasTicketInvoice={hasTicketInvoice}
            pending={hasProcessing}
            loading={loading}
            statusLoading={statusLoading}
            dues={dues}
            storage={storage}
            equipment={equipment}
            onNavigate={setView}
            onPayStorage={handlePayStorage}
            onPayEquipment={handlePayEquipment}
            onEditStorage={() => setShowStorageEdit(true)}
          />
        )}
        {view === "dues" && (
          <DuesFlow
            key="dues"
            existing={dues}
            onBack={() => setView("dashboard")}
          />
        )}
        {view === "equipment" && (
          <EquipmentView
            key="equipment"
            onBack={() => {
              setView("dashboard");
              void refreshBalance();
              void refreshStatuses();
            }}
          />
        )}
      </AnimatePresence>

      {/* Storage items — add/edit via the shared survey modal. key remounts
          on open so it re-reads the latest fetched items. */}
      <StorageSurveyModal
        key={`storage-edit-${showStorageEdit}`}
        open={showStorageEdit}
        mode="edit"
        initialItems={storage?.items ?? null}
        onSubmitted={() => {
          setShowStorageEdit(false);
          refreshBalance();
          refreshStatuses();
        }}
        onDismiss={() => setShowStorageEdit(false)}
      />
    </div>
  );
}

// ── Section Card ───────────────────────────────────────────────────

function SectionCard({
  icon,
  iconBg,
  title,
  statusLine,
  paid,
  loading,
  children,
}: {
  icon: ReactNode;
  iconBg: string;
  title: string;
  statusLine: string;
  paid?: boolean;
  loading?: boolean;
  children?: ReactNode;
}) {
  return (
    <Card className="glass-card border-0">
      <CardContent className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}
          >
            {icon}
          </div>
          <div>
            <p className="font-semibold text-sand-100">{title}</p>
            <p
              className={`flex items-center gap-1 text-xs ${
                paid ? "text-emerald-300" : "text-sand-400"
              }`}
            >
              {paid && <CheckCircle2 className="h-3.5 w-3.5" />}
              {loading ? "…" : statusLine}
            </p>
          </div>
        </div>
        {!loading && Children.toArray(children).some(Boolean) && (
          <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Dashboard View ─────────────────────────────────────────────────

function DashboardView({
  balance,
  hasTicketInvoice,
  pending,
  loading,
  statusLoading,
  dues,
  storage,
  equipment,
  onNavigate,
  onPayStorage,
  onPayEquipment,
  onEditStorage,
}: {
  balance: number | null;
  hasTicketInvoice: boolean;
  pending: boolean;
  loading: boolean;
  statusLoading: boolean;
  dues: DuesStatus | null;
  storage: StorageStatus | null;
  equipment: EquipmentStatus | null;
  onNavigate: (view: View) => void;
  onPayStorage: () => void;
  onPayEquipment: () => void;
  onEditStorage: () => void;
}) {
  const fmt = (cents: number) =>
    (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    });

  const formattedBalance =
    balance !== null
      ? balance.toLocaleString("en-US", {
          style: "currency",
          currency: "USD",
          minimumFractionDigits: 2,
        })
      : null;

  // ── Camp Dues state ──
  const duesExists = !!dues && dues.exists && dues.amountCents > 0;
  const duesOwedCents = duesExists
    ? Math.max(0, (dues?.amountCents ?? 0) - (dues?.amountPaidCents ?? 0))
    : 0;
  const duesProcessing = dues?.status === "processing";
  // "Managed" = the dues invoice already has money OR a live payment plan on it.
  // Either way it can't be re-run through DuesFlow (the server guard rejects it),
  // so we show it read-only rather than dead-ending at Stripe.
  const duesManaged = (dues?.amountPaidCents ?? 0) > 0 || !!dues?.hasSubscription;
  const duesPaid = duesExists && duesOwedCents === 0 && !duesProcessing;
  const onPlan = !!dues && dues.totalInstallments > 1;

  let duesStatusLine: string;
  if (!duesExists) {
    duesStatusLine = "Not started — pick a contribution level";
  } else if (duesProcessing) {
    duesStatusLine = "Bank payment pending — clears in 3–5 business days";
  } else if (duesPaid) {
    duesStatusLine = "Paid in full";
  } else if (onPlan) {
    duesStatusLine = `Payment plan · ${dues?.installmentNumber ?? 0} of ${dues?.totalInstallments ?? 0} paid · ${fmt(duesOwedCents)} left`;
  } else {
    duesStatusLine = `${fmt(duesOwedCents)} due`;
  }

  // ── Storage state ──
  const hasStorage = !!storage && storage.hasInvoice;
  const storageProcessing = storage?.status === "processing";
  const storageOwedCents = hasStorage
    ? Math.max(0, (storage?.amountCents ?? 0) - (storage?.amountPaidCents ?? 0))
    : 0;
  const storagePaid = hasStorage && storageOwedCents === 0;
  const storageEditable = !!storage && storage.editable;

  let storageStatusLine: string;
  if (!hasStorage) {
    storageStatusLine = "No items in NODE storage";
  } else if (storageProcessing) {
    storageStatusLine = "Bank payment pending — clears in 3–5 business days";
  } else if (storagePaid) {
    storageStatusLine = "Paid in full";
  } else {
    storageStatusLine = `${fmt(storageOwedCents)} due`;
  }

  // ── Equipment state ──
  const hasEquipment = !!equipment && equipment.hasInvoice;
  const equipmentProcessing = equipment?.status === "processing";
  const equipmentOwedCents = hasEquipment
    ? Math.max(0, (equipment?.amountCents ?? 0) - (equipment?.amountPaidCents ?? 0))
    : 0;
  const equipmentPaid = hasEquipment && equipmentOwedCents === 0;

  let equipmentStatusLine: string;
  if (!hasEquipment) {
    equipmentStatusLine = "Nothing reserved";
  } else if (equipmentProcessing) {
    equipmentStatusLine = "Bank payment pending — clears in 3–5 business days";
  } else if (equipmentPaid) {
    equipmentStatusLine = "Paid in full";
  } else {
    equipmentStatusLine = `${fmt(equipmentOwedCents)} due`;
  }

  // ── Smart "Make a payment" routing ──
  // A dues invoice with money already on it (paid in full OR mid-plan) can't be
  // re-paid through DuesFlow — the server guard rejects it — so it isn't payable.
  const duesPayable = duesOwedCents > 0 && !duesProcessing && !duesManaged;
  const storagePayable = storageOwedCents > 0 && !storageProcessing;
  const equipmentPayable = equipmentOwedCents > 0 && !equipmentProcessing;
  const canPay =
    !statusLoading && (duesPayable || storagePayable || equipmentPayable);
  const makePayment = () => {
    if (duesPayable) onNavigate("dues");
    else if (storagePayable) onPayStorage();
    else if (equipmentPayable) onPayEquipment();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-4"
    >
      <div>
        <h1 className="text-3xl font-bold text-sand-100">Payments</h1>
        <p className="mt-1 text-sand-400">
          Manage your NODE 2026 dues and payments.
        </p>
      </div>

      {/* Balance Summary */}
      <Card className="glass-card border-0">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-sand-400">
                Total Balance
              </p>
              <p className="mt-1 text-2xl font-bold text-sand-100">
                {loading ? "…" : formattedBalance ?? "$0.00"}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-sand-600" />
          </div>
          {hasTicketInvoice && (
            <p className="mt-4 border-t border-blue-900/30 pt-3 text-xs text-sand-400">
              Includes 1 main sale ticket at $675 + taxes &amp; fees.
            </p>
          )}
          {pending && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
              Bank payment pending — clears in 3–5 business days
            </p>
          )}
          {canPay && (
            <Button
              className="mt-4 w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              onClick={makePayment}
            >
              <Wallet className="mr-2 h-4 w-4" />
              Make a payment
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Camp Dues */}
      <SectionCard
        icon={<CreditCard className="h-5 w-5 text-pink-400" />}
        iconBg="bg-pink-500/15"
        title="Camp Dues"
        statusLine={duesStatusLine}
        paid={duesPaid}
        loading={statusLoading}
      >
        <Button
          variant="outline"
          className="rounded-full border-pink-500/30 text-pink-200 hover:bg-pink-500/10"
          onClick={() => onNavigate("dues")}
        >
          {duesManaged ? "View dues" : duesExists ? "Manage dues" : "Pay dues"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </SectionCard>

      {/* Storage */}
      <SectionCard
        icon={<Package className="h-5 w-5 text-blue-400" />}
        iconBg="bg-blue-500/15"
        title="Storage"
        statusLine={storageStatusLine}
        paid={storagePaid}
        loading={statusLoading}
      >
        {storagePayable && (
          <Button
            className="rounded-full bg-blue-500 text-white hover:bg-blue-600"
            onClick={onPayStorage}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Pay {fmt(storageOwedCents)}
          </Button>
        )}
        {!hasStorage ? (
          <Button
            variant="outline"
            className="rounded-full border-blue-500/30 text-blue-200 hover:bg-blue-500/10"
            onClick={onEditStorage}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Add items
          </Button>
        ) : storageEditable ? (
          <Button
            variant="outline"
            className="rounded-full border-blue-500/30 text-blue-200 hover:bg-blue-500/10"
            onClick={onEditStorage}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit items
          </Button>
        ) : null}
      </SectionCard>

      {/* Rent Equipment */}
      <SectionCard
        icon={<Tent className="h-5 w-5 text-amber" />}
        iconBg="bg-amber/15"
        title="Rent Equipment"
        statusLine={equipmentStatusLine}
        paid={equipmentPaid}
        loading={statusLoading}
      >
        {equipmentPayable && (
          <Button
            className="rounded-full bg-amber text-blue-950 hover:bg-amber/90"
            onClick={onPayEquipment}
          >
            <Wallet className="mr-2 h-4 w-4" />
            Pay {fmt(equipmentOwedCents)}
          </Button>
        )}
        <Button
          variant="outline"
          className="rounded-full border-amber/30 text-amber hover:bg-amber/10"
          onClick={() => onNavigate("equipment")}
        >
          {hasEquipment
            ? equipment?.editable
              ? "Edit rentals"
              : "View rentals"
            : "Browse"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </SectionCard>

      <p className="pt-2 text-center text-xs text-sand-500">
        2026 camp budget — coming soon.
      </p>
    </motion.div>
  );
}

// ── Pay Dues Flow ──────────────────────────────────────────────────

function DuesFlow({
  onBack,
  existing,
}: {
  onBack: () => void;
  existing: DuesStatus | null;
}) {
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null);
  const [frequency, setFrequency] = useState<string>("monthly");
  const [processing, setProcessing] = useState(false);

  const totalSteps = 3;

  async function handlePaymentSubmit() {
    if (!selectedTier || !paymentType) {
      toast.error("Pick a tier and payment type first.");
      return;
    }
    setProcessing(true);
    const { createDuesCheckout } = await import("@/lib/actions/payments");
    const res = await createDuesCheckout({
      tierDollars: selectedTier,
      paymentType,
      frequency:
        paymentType === "plan"
          ? (frequency as "weekly" | "biweekly" | "monthly")
          : undefined,
    });
    if ("error" in res) {
      toast.error(res.error);
      setProcessing(false);
      return;
    }
    // Hand off to Stripe-hosted Checkout (payment method chosen there).
    window.location.href = res.url;
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

  // A dues invoice that already has money on it (paid in full or mid-plan) can't
  // be re-paid through this wizard — createDuesCheckout's money guard rejects it.
  // Show a read-only summary instead of dead-ending the member at Stripe.
  const locked =
    !!existing && (existing.amountPaidCents > 0 || existing.hasSubscription);
  if (locked) {
    const money = (c: number) =>
      (c / 100).toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 0,
      });
    const tierCents = existing?.amountCents ?? 0;
    const paidCents = existing?.amountPaidCents ?? 0;
    const remainingCents = Math.max(0, tierCents - paidCents);
    const planned = (existing?.totalInstallments ?? 0) > 1;
    const fullyPaid = remainingCents === 0;
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
            aria-label="Back to payments"
            className="text-sand-400 hover:text-sand-200"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-sand-100">Your Dues</h1>
            <p className="text-xs text-sand-400">2026 camp dues</p>
          </div>
        </div>

        <Card className="glass-card border-0">
          <CardContent className="space-y-2 py-5">
            <div className="flex justify-between text-sm">
              <span className="text-sand-400">Dues tier</span>
              <span className="text-sand-200">{money(tierCents)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-sand-400">Paid so far</span>
              <span className="text-sand-200">{money(paidCents)}</span>
            </div>
            {planned && (
              <div className="flex justify-between text-sm">
                <span className="text-sand-400">Plan progress</span>
                <span className="text-sand-200">
                  {existing?.installmentNumber ?? 0} of{" "}
                  {existing?.totalInstallments ?? 0} installments
                </span>
              </div>
            )}
            <Separator className="bg-pink-500/10 !my-2" />
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-sand-300">
                {fullyPaid ? "Status" : "Remaining"}
              </span>
              <span className={fullyPaid ? "text-emerald-300" : "text-sand-100"}>
                {fullyPaid ? "Paid in full" : money(remainingCents)}
              </span>
            </div>
          </CardContent>
        </Card>

        {planned && !fullyPaid && (
          <p className="text-xs text-sand-400">
            Your remaining installments are collected automatically on your saved
            payment method.
          </p>
        )}
        <p className="text-xs text-sand-500">
          Need to change your tier or plan? Contact an admin.
        </p>
      </motion.div>
    );
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
          aria-label={step === 1 ? "Back to payments" : "Previous step"}
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
            {/* Pay-what-you-can philosophy */}
            <div className="rounded-lg border border-pink-500/15 bg-pink-500/5 p-3 text-xs leading-relaxed text-sand-300">
              Everyone is expected to pay{" "}
              <strong className="text-sand-100">something</strong>. If you can&apos;t
              afford full dues, you&apos;re welcome to pay at a lower tier &mdash; but{" "}
              <strong className="text-sand-100">
                anything under $1,200 should be cleared with Jesse beforehand
              </strong>
              . This isn&apos;t an invitation to pay less because you feel like it. NODE
              wants everyone to experience Black Rock City, and whether you pay more or
              less, <strong className="text-sand-100">we&apos;re all equal</strong>.
            </div>

            <p className="text-sm text-sand-300">
              Choose your 2026 dues contribution.
            </p>
            <div className="grid gap-3">
              {DUES_TIERS.map((tier) => {
                const active = !customMode && selectedTier === tier.amount;
                return (
                  <Card
                    key={tier.amount}
                    className={`glass-card border-0 cursor-pointer transition-all ${
                      active
                        ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                        : "hover:ring-1 hover:ring-pink-500/20"
                    }`}
                    onClick={() => {
                      setCustomMode(false);
                      setSelectedTier(tier.amount);
                    }}
                  >
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <div
                          className={`h-4 w-4 rounded-full border-2 transition-colors ${
                            active ? "border-pink-500 bg-pink-500" : "border-sand-600"
                          }`}
                        />
                        <div>
                          <span className="font-semibold text-sand-100">
                            {tier.label}
                          </span>
                          {tier.description && (
                            <span className="ml-2 text-xs text-sand-400">
                              {tier.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Pay what you can — custom amount */}
              <Card
                className={`glass-card border-0 cursor-pointer transition-all ${
                  customMode
                    ? "ring-2 ring-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.15)]"
                    : "hover:ring-1 hover:ring-pink-500/20"
                }`}
                onClick={() => {
                  setCustomMode(true);
                  const n = parseInt(customAmount, 10) || 0;
                  setSelectedTier(n > 0 ? n : null);
                }}
              >
                <CardContent className="py-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-4 w-4 rounded-full border-2 transition-colors ${
                        customMode ? "border-pink-500 bg-pink-500" : "border-sand-600"
                      }`}
                    />
                    <div>
                      <p className="font-semibold text-sand-100">Pay what you can</p>
                      <p className="text-xs text-sand-400">Enter your own amount</p>
                    </div>
                  </div>
                  {customMode && (
                    <div className="ml-7 flex items-center gap-2">
                      <span className="text-sand-400">$</span>
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        value={customAmount}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => {
                          const v = e.target.value;
                          setCustomAmount(v);
                          const n = parseInt(v, 10) || 0;
                          setSelectedTier(n > 0 ? n : null);
                        }}
                        onBlur={() => {
                          // Normalize to whole dollars so the field matches the
                          // integer amount we actually charge.
                          const n = parseInt(customAmount, 10) || 0;
                          setCustomAmount(n > 0 ? String(n) : "");
                          setSelectedTier(n > 0 ? n : null);
                        }}
                        placeholder="Amount"
                        className="max-w-[140px]"
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {selectedTier !== null && selectedTier < 1200 && (
              <p className="text-xs text-amber-300">
                Amounts under $1,200 should be cleared with Jesse before paying.
              </p>
            )}

            <Button
              className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              disabled={!selectedTier || selectedTier <= 0}
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

        {/* Step 3: Review & continue to Stripe Checkout */}
        {step === 3 && (
          <motion.div
            key="review"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            <p className="text-sm text-sand-300">
              Review and continue to payment.
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
                  </span>
                </div>
                <Separator className="bg-pink-500/10 !my-2" />
                <div className="flex justify-between text-sm font-semibold">
                  <span className="text-sand-300">Due today</span>
                  <span className="text-sand-100">
                    ${(paymentType === "plan"
                      ? getInstallmentAmount() ?? 0
                      : selectedTier ?? 0
                    ).toLocaleString()}
                  </span>
                </div>
              </CardContent>
            </Card>

            <p className="text-xs text-sand-400">
              You&apos;ll choose how to pay &mdash; card, bank (ACH), or crypto &mdash;
              securely on the next screen.
            </p>

            <Button
              className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              disabled={processing}
              onClick={handlePaymentSubmit}
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Redirecting&hellip;
                </>
              ) : (
                <>
                  <Wallet className="mr-2 h-4 w-4" />
                  Continue to payment
                </>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Equipment View (live catalog) ──────────────────────────────────

function EquipmentView({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [customLabel, setCustomLabel] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [editable, setEditable] = useState(true);
  const [hasInvoice, setHasInvoice] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = await getEquipmentCatalog();
      if ("error" in res) {
        toast.error(res.error);
        setLoading(false);
        return;
      }
      setItems(res.items);
      const q: Record<string, number> = {};
      res.items.forEach((i) => {
        if (i.mine > 0) q[i.key] = i.mine;
      });
      setQty(q);
      if (res.custom.length > 0) {
        setCustomLabel(res.custom[0].label);
        setCustomPrice(String(Math.round(res.custom[0].unitPriceCents / 100)));
      }
      setEditable(res.editable);
      setHasInvoice(res.hasInvoice);
      setStatus(res.status);
      setLoading(false);
    })();
  }, []);

  const money = (cents: number) =>
    (cents / 100).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    });

  function setItemQty(key: string, next: number, max: number | null) {
    const clamped = Math.max(0, max === null ? next : Math.min(next, max));
    setQty((prev) => ({ ...prev, [key]: clamped }));
  }

  // Whole dollars only — keeps the field, total, and reload round-trip lossless.
  const customPriceCents = (parseInt(customPrice, 10) || 0) * 100;
  const customValid = customLabel.trim().length > 0 && customPriceCents > 0;

  const totalCents =
    items.reduce((s, i) => s + (qty[i.key] ?? 0) * i.priceCents, 0) +
    (customValid ? customPriceCents : 0);

  function buildSelections(): EquipmentSelection[] {
    const sel: EquipmentSelection[] = [];
    for (const i of items) {
      const q = qty[i.key] ?? 0;
      if (q > 0) sel.push({ key: i.key, quantity: q });
    }
    if (customValid)
      sel.push({
        key: null,
        quantity: 1,
        customLabel: customLabel.trim(),
        unitPriceCents: customPriceCents,
      });
    return sel;
  }

  async function handleReserve(thenPay: boolean) {
    setSubmitting(true);
    const res = await reserveEquipment(buildSelections());
    if ("error" in res) {
      toast.error(res.error);
      setSubmitting(false);
      return;
    }
    if (res.totalCents === 0) {
      toast.success("Your equipment reservation was cleared.");
      onBack();
      return;
    }
    if (thenPay) {
      const pay = await createEquipmentPaymentCheckout();
      if ("error" in pay) {
        toast.error(pay.error);
        setSubmitting(false);
        return;
      }
      window.location.assign(pay.url);
      return;
    }
    toast.success("Reservation saved — pay anytime from Payments.");
    onBack();
  }

  const tents = items.filter((i) => i.category === "tent");
  const addons = items.filter((i) => i.category === "addon");

  const header = (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Back to payments"
        className="text-sand-400 hover:text-sand-200"
        onClick={onBack}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <div>
        <h1 className="text-2xl font-bold text-sand-100">Rent Equipment</h1>
        <p className="text-xs text-sand-400">Tents &amp; gear from NODE&apos;s pool</p>
      </div>
    </div>
  );

  const wrapper = (children: ReactNode) => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-5"
    >
      {header}
      {children}
    </motion.div>
  );

  if (loading) {
    return wrapper(
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-sand-500" />
      </div>
    );
  }

  // Read-only once a payment exists / is in flight — changes go through an admin.
  if (!editable && hasInvoice) {
    const mineItems = items.filter((i) => i.mine > 0);
    return wrapper(
      <>
        <Card className="glass-card border-0">
          <CardContent className="space-y-2 py-5">
            {mineItems.map((i) => (
              <div key={i.key} className="flex justify-between text-sm">
                <span className="text-sand-300">
                  {i.label}
                  {i.mine > 1 ? ` ×${i.mine}` : ""}
                </span>
                <span className="text-sand-200">{money(i.mine * i.priceCents)}</span>
              </div>
            ))}
            {customValid && (
              <div className="flex justify-between text-sm">
                <span className="text-sand-300">{customLabel.trim()}</span>
                <span className="text-sand-200">{money(customPriceCents)}</span>
              </div>
            )}
            <Separator className="bg-amber/10 !my-2" />
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-sand-300">Total</span>
              <span className="text-sand-100">{money(totalCents)}</span>
            </div>
          </CardContent>
        </Card>
        <p className="text-xs text-sand-400">
          {status === "processing"
            ? "Bank payment pending — clears in 3–5 business days."
            : "Your rental is paid. Contact an admin to change it."}
        </p>
      </>
    );
  }

  const renderRow = (i: CatalogItem) => {
    const q = qty[i.key] ?? 0;
    const atMax = i.available !== null && q >= i.available;
    const disabledAll = i.soldOut && q === 0;
    return (
      <div key={i.key} className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-sand-100">
            {i.label}
            <span className="ml-1.5 text-sand-400">{money(i.priceCents)}</span>
          </p>
          {i.description && (
            <p className="text-xs text-sand-400">{i.description}</p>
          )}
          <p className="mt-0.5 text-[11px] text-sand-500">
            {i.available === null
              ? "Available"
              : i.available - q <= 0
                ? q > 0
                  ? "Max reached"
                  : "Sold out"
                : `${i.available - q} available`}
          </p>
        </div>
        {disabledAll ? (
          <Badge className="shrink-0 bg-red-500/15 text-red-300">Sold out</Badge>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              aria-label={`Remove one ${i.label}`}
              onClick={() => setItemQty(i.key, q - 1, i.available)}
              disabled={q === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-amber/30 text-sand-300 transition-colors hover:bg-amber/10 disabled:opacity-30"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span className="w-5 text-center text-sm font-semibold tabular-nums text-sand-100">
              {q}
            </span>
            <button
              type="button"
              aria-label={`Add one ${i.label}`}
              onClick={() => setItemQty(i.key, q + 1, i.available)}
              disabled={atMax}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-amber/30 text-sand-300 transition-colors hover:bg-amber/10 disabled:opacity-30"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  const reserveDisabled = submitting || (totalCents === 0 && !hasInvoice);

  return wrapper(
    <>
      <p className="text-sm text-sand-300">
        Reserve tents and gear from NODE&apos;s pool. Inventory is limited and
        first-come — your pick is held as soon as you reserve.
      </p>

      {/* Tents */}
      <Card className="glass-card border-0">
        <CardContent className="py-2">
          <p className="flex items-center gap-2 pt-3 text-xs font-semibold uppercase tracking-wider text-sand-400">
            <Tent className="h-3.5 w-3.5 text-amber" /> Tents
          </p>
          <div className="divide-y divide-white/5">{tents.map(renderRow)}</div>
        </CardContent>
      </Card>

      {/* Add-ons */}
      {addons.length > 0 && (
        <Card className="glass-card border-0">
          <CardContent className="py-2">
            <p className="flex items-center gap-2 pt-3 text-xs font-semibold uppercase tracking-wider text-sand-400">
              <Zap className="h-3.5 w-3.5 text-amber" /> Add-ons
            </p>
            <div className="divide-y divide-white/5">{addons.map(renderRow)}</div>
          </CardContent>
        </Card>
      )}

      {/* Custom / Other */}
      <Card className="glass-card border-0">
        <CardContent className="space-y-3 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber/15">
              <Plus className="h-4 w-4 text-amber" />
            </div>
            <div>
              <p className="text-sm font-medium text-sand-100">Something else</p>
              <p className="text-xs text-sand-400">
                Renting an item that isn&apos;t listed? Add it with a price.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
              placeholder="What is it?"
              maxLength={120}
              className="flex-1"
            />
            <div className="flex items-center gap-1">
              <span className="text-sand-400">$</span>
              <Input
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                onBlur={() => {
                  const n = parseInt(customPrice, 10) || 0;
                  setCustomPrice(n > 0 ? String(n) : "");
                }}
                placeholder="Price"
                className="max-w-[110px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Total + actions */}
      <Card className="glass-card border-0">
        <CardContent className="flex items-center justify-between py-4">
          <span className="text-sm font-medium text-sand-400">Total</span>
          <span className="text-lg font-semibold text-sand-100">
            {money(totalCents)}
          </span>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button
          className="w-full rounded-full bg-amber text-blue-950 hover:bg-amber/90"
          disabled={reserveDisabled}
          onClick={() => handleReserve(true)}
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Working&hellip;
            </>
          ) : totalCents > 0 ? (
            <>
              <Wallet className="mr-2 h-4 w-4" />
              Reserve &amp; pay {money(totalCents)}
            </>
          ) : hasInvoice ? (
            "Remove my reservation"
          ) : (
            "Select items to reserve"
          )}
        </Button>
        {totalCents > 0 && (
          <button
            type="button"
            disabled={submitting}
            onClick={() => handleReserve(false)}
            className="w-full text-center text-xs text-sand-500 underline hover:text-sand-300 disabled:opacity-50"
          >
            Reserve &amp; pay later
          </button>
        )}
      </div>
    </>
  );
}
