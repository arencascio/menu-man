import type { RestaurantBrandLockupPresentation } from "./RestaurantBrandLockup";
export const restaurantIdentities: Readonly<Partial<Record<string, {
  markUrl: string;
  artworkMark?: true;
  brandLockup?: RestaurantBrandLockupPresentation;
}>>> = {
  armandos: {
    markUrl: "/img/pepper.svg",
    artworkMark: true,
    brandLockup: {
      image: "/img/armandos/armandosLogo_shadow.png",
      width: 1920,
      height: 326,
    },
  },
  "super-tacos": {
    markUrl: "/img/super-tacos/approved/supertacologo.svg",
  },
};
