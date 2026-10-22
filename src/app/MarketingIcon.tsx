import Image from "next/image";

const icons = {
  utensils: "/img/icons/utensils.svg",
  dollar: "/img/icons/dollar-sign.svg",
  moon: "/img/icons/moon.svg",
  map: "/img/icons/map-pinned.svg",
  cart: "/img/icons/shopping-cart.svg",
  smile: "/img/icons/face-slightly-smiling.svg",
  message: "/img/icons/message-circle-question-mark.svg",
  globe: "/img/icons/globe-code.svg",
  history: "/img/icons/rotate-cw-clock.svg",
  phone: "/img/icons/smartphone.svg",
  menu: "/img/icons/square-menu.svg",
  sparkles: "/img/icons/sparkles.svg",
  heart: "/img/icons/heart-handshake.svg",
  platter: "/img/icons/hand-platter.svg",
  store: "/img/icons/store.svg",
  list: "/img/icons/list-restart.svg",
  calendar: "/img/icons/calendar-check.svg",
  chart: "/img/icons/chart-pie.svg",
  truck: "/img/icons/truck.svg",
  chef: "/img/icons/chef-hat.svg",
  check: "/img/icons/check.svg",
  chevron: "/img/icons/chevron-down.svg",
} as const;
export type MarketingIconName = keyof typeof icons;

export default function MarketingIcon({ name, size = 28, className }: { name: MarketingIconName; size?: number; className?: string }) {
  return <Image src={icons[name]} width={size} height={size} alt="" aria-hidden="true" data-marketing-icon={name} className={className} />;
}
