"use client";

import { useBrand } from "@/hooks/use-brand";

/**
 * Animated geometric background pattern for hero sections
 */
export function GeometricBackground() {
  const brand = useBrand();
  
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Hexagonal grid pattern */}
      <svg className="absolute inset-0 w-full h-full opacity-5" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hexagons" width="100" height="86.6" patternUnits="userSpaceOnUse">
            <polygon 
              points="50,0 93.3,25 93.3,75 50,100 6.7,75 6.7,25" 
              fill="none" 
              stroke={brand.colors.primary}
              strokeWidth="0.5"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hexagons)" />
      </svg>
      
      {/* Floating hexagons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="absolute animate-float"
          style={{
            left: `${20 * i}%`,
            top: `${15 * i}%`,
            animationDelay: `${i * 0.5}s`,
            animationDuration: `${8 + i}s`,
          }}
        >
          <div
            className="w-24 h-24 opacity-10"
            style={{
              clipPath: "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)",
              backgroundColor: i === 2 ? brand.colors.accent : brand.colors.primary,
            }}
          />
        </div>
      ))}
      
      <style jsx>{`
        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(20px, -20px) rotate(5deg);
          }
          50% {
            transform: translate(-10px, -40px) rotate(-3deg);
          }
          75% {
            transform: translate(-30px, -20px) rotate(3deg);
          }
        }
        .animate-float {
          animation: float 10s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

