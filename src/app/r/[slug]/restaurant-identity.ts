import type { RestaurantBrandLockupPresentation } from "./RestaurantBrandLockup";
import armandosLogo from "../../../../img/armandosLogo_shadow.png";

export const restaurantIdentities: Readonly<Partial<Record<string, {
  markUrl: string;
  artworkMark: true;
  brandLockup?: RestaurantBrandLockupPresentation;
}>>> = {
  armandos: {
    markUrl: "/img/pepper.svg",
    artworkMark: true,
    brandLockup: {
      image: armandosLogo,
    },
  },
};
