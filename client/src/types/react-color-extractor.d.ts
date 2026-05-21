declare module "react-color-extractor" {
  import type { FC } from "react";

  interface ColorExtractorProps {
    src: string;
    getColors: (colors: string[]) => void;
  }

  export const ColorExtractor: FC<ColorExtractorProps>;
}
