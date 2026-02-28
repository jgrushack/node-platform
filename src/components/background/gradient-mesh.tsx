export function GradientMesh() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-950 via-blue-900 to-blue-950" />

      {/* Blob 1 — Pink glow top-right */}
      <div
        className="absolute -top-[10%] right-[-10%] h-[40vh] w-[40vh] rounded-full opacity-30 sm:h-[60vh] sm:w-[60vh] sm:-top-1/4 sm:-right-1/4"
        style={{
          background: "radial-gradient(circle, #F90077 0%, transparent 70%)",
          animation: "blob-float-1 20s ease-in-out infinite",
          willChange: "transform",
        }}
      />

      {/* Blob 2 — Amber glow center-left */}
      <div
        className="absolute top-1/3 left-[-10%] h-[35vh] w-[35vh] rounded-full opacity-20 sm:h-[50vh] sm:w-[50vh] sm:-left-1/4"
        style={{
          background: "radial-gradient(circle, #FFB800 0%, transparent 70%)",
          animation: "blob-float-2 25s ease-in-out infinite",
          willChange: "transform",
        }}
      />

      {/* Blob 3 — Orange glow bottom-center */}
      <div
        className="absolute -bottom-[10%] left-1/4 h-[35vh] w-[35vh] rounded-full opacity-20 sm:h-[55vh] sm:w-[55vh] sm:left-1/3 sm:-bottom-1/4"
        style={{
          background: "radial-gradient(circle, #FF6B2C 0%, transparent 70%)",
          animation: "blob-float-3 22s ease-in-out infinite",
          willChange: "transform",
        }}
      />

      {/* Blob 4 — Pink soft glow bottom-right (hidden on small mobile for perf) */}
      <div
        className="absolute bottom-1/4 right-[-5%] hidden h-[45vh] w-[45vh] rounded-full opacity-15 sm:block"
        style={{
          background: "radial-gradient(circle, #FF73A5 0%, transparent 70%)",
          animation: "blob-float-4 28s ease-in-out infinite",
          willChange: "transform",
        }}
      />

      {/* Subtle grain overlay */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
}
