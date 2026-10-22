import CinematicPhoneShowcase from "./CinematicPhoneShowcase";
import { marketingPhoneReels } from "./marketing-phone-reels";

export default function MarketingPhoneShowcase() {
  return <CinematicPhoneShowcase reels={marketingPhoneReels} demoHref="/r/super-tacos" />;
}
