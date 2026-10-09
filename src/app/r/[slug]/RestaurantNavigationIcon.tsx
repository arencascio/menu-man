import RestaurantContactIcon from "./RestaurantContactIcon";

export type RestaurantNavigationIconName = "utensils" | "truck" | "mapPinned" | "navigation" | "directions" | "phone";

// Lucide paths; existing contact icons retain their current presentation.
const paths = {
  utensils: <><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><path d="M7 2v20" /><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" /></>,
  truck: <><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" /><path d="M15 18H9" /><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" /><circle cx="17" cy="18" r="2" /><circle cx="7" cy="18" r="2" /></>,
  mapPinned: <><path d="M18 8c0 3.613-3.869 7.429-5.393 8.795a1 1 0 0 1-1.214 0C9.87 15.429 6 11.613 6 8a6 6 0 0 1 12 0" /><path d="M4.474 15h-.197a1 1 0 0 0-.969.753l-1.097 4.35a1.5 1.5 0 0 0 1.444 1.898L20.344 22a1.5 1.5 0 0 0 1.446-1.897l-1.098-4.35a1 1 0 0 0-.969-.753h-.197" /><circle cx="12" cy="8" r="2" /></>,
  navigation: <path d="m3 11 19-9-9 19-2-8-8-2z" />,
};

export default function RestaurantNavigationIcon({ icon }: { icon: RestaurantNavigationIconName }) {
  if (icon === "directions" || icon === "phone") return <RestaurantContactIcon kind={icon} />;
  return (
    <svg aria-hidden="true" data-nav-icon={icon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      {paths[icon]}
    </svg>
  );
}
