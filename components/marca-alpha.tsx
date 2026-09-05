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
      style={{ color: marca.color, textTransform: "none" }}
    >
      <path
        d="M125 0H11L306 709H421L716 0H603L510 222H217ZM257 318H470L364 574ZM890 730V0H793V730ZM1000 -198V479H1077L1097 429Q1126 458 1163.5 474.0Q1201 490 1248 490Q1298 490 1340.5 470.5Q1383 451 1414.0 417.0Q1445 383 1462.5 337.0Q1480 291 1480 239Q1480 187 1462.5 141.0Q1445 95 1414.0 61.0Q1383 27 1340.5 7.5Q1298 -12 1248 -12Q1199 -12 1162.0 4.5Q1125 21 1097 52V-198ZM1240 402Q1211 402 1185.0 392.5Q1159 383 1139.5 362.5Q1120 342 1109.0 311.5Q1098 281 1098 239Q1098 194 1109.0 162.5Q1120 131 1139.5 111.5Q1159 92 1185.0 83.0Q1211 74 1240 74Q1269 74 1295.0 87.0Q1321 100 1340.0 122.5Q1359 145 1370.0 175.0Q1381 205 1381 239Q1381 273 1370.0 303.0Q1359 333 1340.0 355.0Q1321 377 1295.0 389.5Q1269 402 1240 402ZM1661 0H1564V730H1661V435Q1688 465 1717.5 477.5Q1747 490 1786 490Q1836 490 1875.5 470.5Q1915 451 1943.0 417.0Q1971 383 1985.5 337.0Q2000 291 2000 239V0H1902V239Q1902 273 1892.5 303.0Q1883 333 1866.5 355.0Q1850 377 1828.5 389.5Q1807 402 1782 402Q1761 402 1740.0 393.5Q1719 385 1701.5 366.0Q1684 347 1672.5 316.0Q1661 285 1661 241Z"
        transform="translate(0 1.17) scale(0.0014104 -0.0014104)"
        fill="currentColor"
      />
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
