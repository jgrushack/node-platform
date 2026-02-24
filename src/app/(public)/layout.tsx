import { FloatingDock } from "@/components/navigation/floating-dock";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <FloatingDock />
      {/* Bottom padding so content doesn't hide behind dock */}
      <div className="h-24" />
    </>
  );
}
