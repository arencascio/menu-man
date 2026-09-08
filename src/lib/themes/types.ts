export type ThemePresetId = "classic-red";

export type ThemeTokens = {
  colors: {
    primary: string;
    accent: string;
    background: string;
    surface: string;
    text: string;
    mutedText: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  shape: {
    borderRadius: string;
    contentWidth: string;
  };
  density: {
    sectionGap: string;
    cardGap: string;
  };
};

export type ThemeOverrides = Partial<{
  primary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  mutedText: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: string;
  contentWidth: string;
  sectionGap: string;
  cardGap: string;
}>;
