"use client";

import { useEffect, useState } from "react";
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react";

/**
 * Animated WebGL gradient background. Only mounted after hydration so the
 * Three.js / WebGL canvas never runs during SSR. Falls back to a CSS gradient
 * before mount (and on devices without WebGL).
 */
export function ShaderHero({ className }: { className?: string }) {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Give the WebGL canvas a beat to paint its first frame, then fade it in over
    // the CSS gradient so it eases in instead of popping/flashing on load.
    useEffect(() => {
        if (!mounted) return;
        const id = setTimeout(() => setVisible(true), 150);
        return () => clearTimeout(id);
    }, [mounted]);

    return (
        <div
            className={className}
            style={{
                position: "absolute",
                inset: 0,
                background:
                    "linear-gradient(135deg, #1a0b3d 0%, #3b0764 40%, #0b1b6b 100%)",
            }}
            aria-hidden
        >
            {mounted && (
                <ShaderGradientCanvas
                    style={{
                        position: "absolute",
                        inset: 0,
                        opacity: visible ? 1 : 0,
                        transition: "opacity 900ms ease-in-out",
                        pointerEvents: "none",
                    }}
                    // Stay mounted when the hero scrolls out of view, so returning to the
                    // top shows the gradient instantly instead of re-initializing (which
                    // caused a flash). Default lazyLoad unmounts the WebGL canvas off-screen.
                    lazyLoad={false}
                    pixelDensity={1}
                    fov={40}
                >
                    <ShaderGradient
                        control="props"
                        type="waterPlane"
                        animate="on"
                        uSpeed={0.1}
                        uStrength={1.6}
                        uDensity={1.4}
                        uFrequency={5.5}
                        color1="#6d28d9"
                        color2="#ec4899"
                        color3="#1e3a8a"
                        cDistance={3.6}
                        cPolarAngle={115}
                        cAzimuthAngle={180}
                        cameraZoom={1}
                        positionX={0}
                        positionY={0}
                        positionZ={0}
                        rotationX={50}
                        rotationY={0}
                        rotationZ={-60}
                        grain="off"
                        brightness={1.1}
                    />
                </ShaderGradientCanvas>
            )}
        </div>
    );
}
