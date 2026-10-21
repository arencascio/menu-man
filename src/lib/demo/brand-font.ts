import localFont from "next/font/local";

export const superTacosBrandFont = localFont({
  src: "../../../public/fonts/titan-one/TitanOne-Regular.ttf",
  variable: "--font-super-tacos-brand", preload: false,
  weight: "400", style: "normal", display: "swap", adjustFontFallback: "Arial",
});
