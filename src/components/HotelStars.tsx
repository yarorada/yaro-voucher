interface HotelStarsProps {
  stars: number | null | undefined;
  className?: string;
}

export function HotelStars({ stars, className = "" }: HotelStarsProps) {
  if (!stars || stars < 1 || stars > 5) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-400 ${className}`} title={`${stars} hvězdičky`}>
      {Array.from({ length: stars }).map((_, i) => (
        <span key={i} className="text-amber-400">★</span>
      ))}
    </span>
  );
}
