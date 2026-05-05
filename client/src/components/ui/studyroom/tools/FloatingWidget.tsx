import { Box } from "@chakra-ui/react";
import { useState, useRef, useEffect } from "react";
import type { ReactNode, PointerEvent as ReactPointerEvent } from "react";

type WidgetPos = { x: number; y: number };

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

interface FloatingWidgetProps {
  id: string;
  defaultPos?: WidgetPos;
  zIndex: number;
  onFocus: () => void;
  children: ReactNode;
}

export default function FloatingWidget({
  id,
  defaultPos = { x: 120, y: 120 },
  zIndex,
  onFocus,
  children,
}: FloatingWidgetProps) {
  const widgetRef = useRef<HTMLDivElement | null>(null);

  const storageKey = `cleverfox.widget.pos.${id}`;

  const [pos, setPos] = useState<WidgetPos>(() => {
    if (typeof window === "undefined") return defaultPos;
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return defaultPos;
      const parsed = JSON.parse(raw);
      return { x: parsed.x ?? defaultPos.x, y: parsed.y ?? defaultPos.y };
    } catch {
      return defaultPos;
    }
  });

  function clampToViewport(next: WidgetPos): WidgetPos {
    if (typeof window === "undefined") return next;
    const padding = 12;
    const rect = widgetRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 320;
    const height = rect?.height ?? 200;

    const maxX = Math.max(padding, window.innerWidth - width - padding);
    const maxY = Math.max(padding, window.innerHeight - height - padding);
    return {
      x: clamp(next.x, padding, maxX),
      y: clamp(next.y, padding, maxY),
    };
  }

  function onDragStart(e: ReactPointerEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement | null;
    if (target?.closest("button, a, input, textarea, select, [data-no-drag]")) {
      return;
    }

    if (e.pointerType === "mouse" && e.button !== 0) return;

    onFocus();

    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const start = { x: e.clientX, y: e.clientY };
    const base = pos;
    let newPos = base;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;
      newPos = clampToViewport({ x: base.x + dx, y: base.y + dy });

      // Update DOM directly to prevent React state re-render flickering
      if (widgetRef.current) {
        widgetRef.current.style.transform = `translate3d(${newPos.x}px, ${newPos.y}px, 0)`;
      }
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPos(newPos);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(pos));
  }, [pos, storageKey]);

  useEffect(() => {
    // Clamp to viewport on mount to avoid saving off-screen positions.
    // Use a small timeout to let the DOM paint first.
    const t = setTimeout(() => {
      setPos((prev) => clampToViewport(prev));
    }, 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <Box
      ref={widgetRef}
      position="absolute"
      zIndex={zIndex}
      onPointerDown={onDragStart}
      onPointerDownCapture={onFocus}
      style={{
        touchAction: "none",
        left: 0,
        top: 0,
        transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
        willChange: "transform",
      }}
      sx={{
        "&:has([data-fullscreen='true'])": {
          transform: "none !important",
        },
      }}
    >
      {children}
    </Box>
  );
}
