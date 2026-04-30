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
      {/* Bottom padding so content doesn't hide behind the floating dock — only needed on mobile (dock sits at bottom-6 on mobile, top-6 on desktop) */}
      <div className="h-24 md:hidden" />
    </>
  );
}
