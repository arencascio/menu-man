/** Decorative controls shared by the three Upper Crust homepage carousels. */
export default function RestaurantCarouselIcon({ name }: { name: "previous" | "next" | "pause" | "play" }) {
  return <svg aria-hidden="true" focusable="false" width="24" height="24" viewBox="0 0 24 24" fill="none">
    {name === "previous" || name === "next" ? <path d={name === "previous" ? "m15 18-6-6 6-6" : "m9 18 6-6-6-6"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /> :
      name === "pause" ? <g fill="currentColor"><rect x="5" y="4" width="5" height="16" rx="1"/><rect x="14" y="4" width="5" height="16" rx="1"/></g> :
        <path d="M7 4.5a1 1 0 0 1 1.5-.86l12 7.5a1 1 0 0 1 0 1.72l-12 7.5a1 1 0 0 1-1.5-.86Z" fill="currentColor" />}
  </svg>;
}
