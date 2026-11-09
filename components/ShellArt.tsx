/**
 * Hero centerpiece: an abstract terrapin shell (original artwork). Hexagonal scutes in graphite with
 * gold rim light and grain, floating slowly. Decorative only.
 */
const hex = (cx: number, cy: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i + Math.PI / 6;
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");

export function ShellArt({ className = "" }: { className?: string }) {
  const C = 300;
  const r = 64;
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [C + r * 1.78 * Math.cos(a), C + r * 1.78 * Math.sin(a) * 0.86] as const;
  });
  const rim = Array.from({ length: 12 }, (_, i) => {
    const a = (Math.PI / 6) * i + Math.PI / 12;
    return [C + 238 * Math.cos(a), C + 205 * Math.sin(a)] as const;
  });

  return (
    <svg viewBox="0 0 600 600" className={className} aria-hidden>
      <defs>
        <radialGradient id="dome" cx="42%" cy="34%" r="70%">
          <stop offset="0%" stopColor="#5b5d68" />
          <stop offset="45%" stopColor="#2b2c34" />
          <stop offset="100%" stopColor="#0d0e12" />
        </radialGradient>
        <radialGradient id="scute" cx="38%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#8a8c98" />
          <stop offset="55%" stopColor="#34353f" />
          <stop offset="100%" stopColor="#15161b" />
        </radialGradient>
        <linearGradient id="rimlight" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd200" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#ffd200" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#e21833" stopOpacity="0.5" />
        </linearGradient>
        <radialGradient id="curve" cx="45%" cy="40%" r="62%">
          <stop offset="0%" stopColor="#000" stopOpacity="0" />
          <stop offset="70%" stopColor="#000" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000" stopOpacity="0.85" />
        </radialGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="2" seed="7" />
          <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.35 0" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <clipPath id="shell">
          <ellipse cx={C} cy={C} rx="250" ry="215" />
        </clipPath>
      </defs>

      {/* Glow and shadow */}
      <ellipse cx={C} cy={C + 205} rx="190" ry="26" fill="#000" opacity="0.55" filter="url(#soft)" />
      <ellipse cx={C - 60} cy={C - 70} rx="170" ry="120" fill="#ffd200" opacity="0.06" filter="url(#soft)" />

      {/* Shell body */}
      <ellipse cx={C} cy={C} rx="250" ry="215" fill="url(#dome)" />
      <g clipPath="url(#shell)">
        {rim.map(([x, y], i) => (
          <polygon key={`r${i}`} points={hex(x, y, 70)} fill="url(#scute)" stroke="#0b0b0f" strokeWidth="5" opacity="0.85" />
        ))}
        {ring.map(([x, y], i) => (
          <polygon key={`g${i}`} points={hex(x, y, 66)} fill="url(#scute)" stroke="#0b0b0f" strokeWidth="6" />
        ))}
        <polygon points={hex(C, C, 70)} fill="url(#scute)" stroke="#0b0b0f" strokeWidth="6" />
        {/* Curvature: edges fall into shadow, a soft specular highlight up-left */}
        <ellipse cx={C} cy={C} rx="250" ry="215" fill="url(#curve)" />
        <ellipse cx={C - 70} cy={C - 85} rx="120" ry="70" fill="#fff" opacity="0.10" filter="url(#soft)" />
        {/* Grain over everything */}
        <rect width="600" height="600" filter="url(#grain)" opacity="0.5" />
      </g>
      {/* Rim light */}
      <ellipse cx={C} cy={C} rx="250" ry="215" fill="none" stroke="url(#rimlight)" strokeWidth="2.5" />
    </svg>
  );
}
