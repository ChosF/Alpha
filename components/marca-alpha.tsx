type TonoMarca = "azul" | "navy" | "blanco";

const MARCAS: Record<TonoMarca, { color: string; archivo: string }> = {
  azul: { color: "#0066ff", archivo: "/alpha-mark-blue.png" },
  navy: { color: "#194270", archivo: "/alpha-mark-navy.png" },
  blanco: { color: "#ffffff", archivo: "/alpha-mark-white.png" },
};

/**
 * Lockup oficial que usa la landing: "Alph" en Kollektif y la marca alfa
 * aprobada, colocados sobre la misma reticula 4.65 x 1.45.
 */
export function MarcaAlpha({
  className = "",
  tono = "navy",
}: {
  className?: string;
  tono?: TonoMarca;
}) {
  const marca = MARCAS[tono];

  return (
    <svg
      className={className}
      viewBox="0 0 4.65 1.45"
      role="img"
      aria-label="Alpha"
      style={{ color: marca.color }}
    >
      <text
        x="0"
        y="1.17"
        fontFamily="Kollektif"
        fontSize="1.4104"
        fontWeight="400"
        fill="currentColor"
        textLength="2.46"
        lengthAdjust="spacingAndGlyphs"
      >
        Alph
      </text>
      <image
        href={marca.archivo}
        x="2.56"
        y="0"
        width="2.09"
        height="1.44"
        preserveAspectRatio="none"
      />
    </svg>
  );
}
