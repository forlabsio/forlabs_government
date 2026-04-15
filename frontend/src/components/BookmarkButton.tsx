"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Bookmark } from "lucide-react";
import { useState, useCallback } from "react";
import { FOUNDRY } from "@/lib/theme";

interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
}

const PARTICLE_COLORS = ["#60a5fa", "#2d72d2", "#a78bfa", "#34d399", "#fbbf24"];

interface BookmarkButtonProps {
  isBookmarked: boolean;
  loading?: boolean;
  onToggle: () => void;
  showLabel?: boolean;
}

export default function BookmarkButton({
  isBookmarked,
  loading = false,
  onToggle,
  showLabel = true,
}: BookmarkButtonProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const handleClick = useCallback(() => {
    if (loading) return;
    // Burst particles only when bookmarking (not unbookmarking)
    if (!isBookmarked) {
      const burst: Particle[] = Array.from({ length: 8 }, (_, i) => ({
        id: Date.now() + i,
        x: Math.cos((i * Math.PI * 2) / 8) * 28 + (Math.random() - 0.5) * 12,
        y: Math.sin((i * Math.PI * 2) / 8) * 28 + (Math.random() - 0.5) * 12,
        color: PARTICLE_COLORS[i % PARTICLE_COLORS.length],
      }));
      setParticles(burst);
      setTimeout(() => setParticles([]), 700);
    }
    onToggle();
  }, [isBookmarked, loading, onToggle]);

  return (
    <div style={{ position: "relative", display: "inline-flex", alignItems: "center" }}>
      {/* Particle burst */}
      <AnimatePresence>
        {particles.map((p) => (
          <motion.span
            key={p.id}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: p.x, y: p.y, scale: 0, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: p.color,
              pointerEvents: "none",
              zIndex: 10,
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={handleClick}
        disabled={loading}
        whileTap={{ scale: 0.88 }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          background: isBookmarked ? FOUNDRY.glow : "transparent",
          border: `1px solid ${isBookmarked ? FOUNDRY.primary : FOUNDRY.border}`,
          color: isBookmarked ? FOUNDRY.primary : FOUNDRY.muted,
          borderRadius: 8,
          padding: showLabel ? "10px 20px" : "10px",
          fontSize: 13,
          fontWeight: 500,
          cursor: loading ? "wait" : "pointer",
          transition: "border-color 0.15s, color 0.15s, background 0.15s",
          outline: "none",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Ripple glow on bookmark */}
        <AnimatePresence>
          {isBookmarked && (
            <motion.span
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 3, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: 8,
                background: `${FOUNDRY.primary}40`,
                pointerEvents: "none",
              }}
            />
          )}
        </AnimatePresence>

        {/* Icon with bounce */}
        <motion.span
          animate={
            isBookmarked
              ? { scale: [1, 1.4, 0.9, 1.1, 1], rotate: [0, -8, 8, -4, 0] }
              : { scale: 1, rotate: 0 }
          }
          transition={{ duration: 0.4, ease: "easeInOut" }}
          style={{ display: "inline-flex", alignItems: "center" }}
        >
          <Bookmark
            size={14}
            fill={isBookmarked ? FOUNDRY.primary : "none"}
            style={{
              filter: isBookmarked
                ? "drop-shadow(0 0 4px rgba(45,114,210,0.7))"
                : "none",
              transition: "filter 0.3s",
            }}
          />
        </motion.span>

        {showLabel && (
          <motion.span
            key={isBookmarked ? "saved" : "save"}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {isBookmarked ? "관심 사업 저장됨" : "관심 사업"}
          </motion.span>
        )}
      </motion.button>
    </div>
  );
}
