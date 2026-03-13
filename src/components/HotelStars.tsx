interface HotelStarsProps {
  stars: number | null | undefined;
  className?: string;
  size?: "sm" | "md";
}

export function HotelStars({ stars, className = "", size = "sm" }: HotelStarsProps) {
  if (!stars || stars < 1 || stars > 5) return null;
  const textSize = size === "md" ? "text-base" : "text-xs";
  return (
    <span
      className={`inline-flex items-center gap-0 leading-none ${textSize} ${className}`}
      title={`${stars} hvězd${stars === 1 ? "a" : stars < 5 ? "y" : ""}`}
    >
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} style={{ color: "#f59e0b" }}>★</span>
      ))}
    </span>
  );
}
