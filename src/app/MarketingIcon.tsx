import Image from "next/image";
import utensils from "../../img/icons/utensils.svg";
import dollar from "../../img/icons/dollar-sign.svg";
import moon from "../../img/icons/moon.svg";
import map from "../../img/icons/map-pinned.svg";
import cart from "../../img/icons/shopping-cart.svg";
import smile from "../../img/icons/face-slightly-smiling.svg";
import message from "../../img/icons/message-circle-question-mark.svg";
import globe from "../../img/icons/globe-code.svg";
import history from "../../img/icons/rotate-cw-clock.svg";
import phone from "../../img/icons/smartphone.svg";
import menu from "../../img/icons/square-menu.svg";
import sparkles from "../../img/icons/sparkles.svg";
import heart from "../../img/icons/heart-handshake.svg";
import platter from "../../img/icons/hand-platter.svg";
import store from "../../img/icons/store.svg";
import list from "../../img/icons/list-restart.svg";
import calendar from "../../img/icons/calendar-check.svg";
import chart from "../../img/icons/chart-pie.svg";
import truck from "../../img/icons/truck.svg";
import chef from "../../img/icons/chef-hat.svg";
import check from "../../img/icons/check.svg";
import chevron from "../../img/icons/chevron-down.svg";

const icons = { utensils, dollar, moon, map, cart, smile, message, globe, history, phone, menu, sparkles, heart, platter, store, list, calendar, chart, truck, chef, check, chevron };
export type MarketingIconName = keyof typeof icons;

export default function MarketingIcon({ name, size = 28, className }: { name: MarketingIconName; size?: number; className?: string }) {
  return <Image src={icons[name]} width={size} height={size} alt="" aria-hidden="true" data-marketing-icon={name} className={className} />;
}
