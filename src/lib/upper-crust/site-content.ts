// Private presentation content only. No availability, ordering or payment authority.
export const upperCrustLinks = {
  directions: "https://www.google.com/maps/dir/?api=1&destination=3573+Main+St%2C+Riverside%2C+CA+92501",
  google: "https://www.google.com/maps/search/?api=1&query=The+Upper+Crust+Sandwich+Shoppe%2C+3573+Main+St%2C+Riverside%2C+CA",
  yelp: "https://www.yelp.com/biz/the-upper-crust-sandwich-shoppe-riverside",
  directory: "https://www.riversidedowntown.org/downtown-directory/restaurants/",
  phone: "tel:+19517843149",
  // Direct social destinations supplied by the user; content is not embedded or copied.
  facebook: "https://www.facebook.com/profile.php?id=100063626381227",
  instagram: "https://www.instagram.com/theuppercrustsandwichshoppe/?hl=en",
};

// Regular hours supplied by the user, not a live open/closed or holiday schedule.
export const upperCrustHours = [
  { day: "Monday", hours: "10 AM–5 PM" },
  { day: "Tuesday", hours: "10 AM–5 PM" },
  { day: "Wednesday", hours: "10 AM–5 PM" },
  { day: "Thursday", hours: "10 AM–5 PM" },
  { day: "Friday", hours: "10 AM–5 PM" },
  { day: "Saturday", hours: "10 AM–5 PM" },
  { day: "Sunday", hours: "11 AM–4 PM" },
] as const;

export function upperCrustToday(date = new Date()) {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "America/Los_Angeles" }).format(date);
  return upperCrustHours.find((entry) => entry.day === day)!;
}

export type UpperCrustPhoto = { src: string; alt: string; caption: string; width: number; height: number; sourceUrl?: string; sandwichName?: string };
const localPhoto = "/r/upper-crust/reference-media/";
// These photos come from the owner's supplied photo folder. The route is local-only.
export const upperCrustPhotos: UpperCrustPhoto[] = [
  { src: `${localPhoto}front-door.jpg`, alt: "The Upper Crust entrance and storefront sign", caption: "Front door", width: 750, height: 1000 },
  { src: `${localPhoto}hanging-sign.jpg`, alt: "The Upper Crust hanging sign and outdoor seating", caption: "Hanging sign", width: 750, height: 1000 },
  { src: `${localPhoto}patio.jpg`, alt: "Outdoor tables and the Upper Crust entrance", caption: "Outdoor seating", width: 750, height: 1000 },
  { src: `${localPhoto}dining.jpg`, alt: "Sandwiches on a table inside the restaurant", caption: "Sandwiches", width: 1000, height: 750 },
  { src: `${localPhoto}takeaway.jpg`, alt: "A sandwich and side on an outdoor table", caption: "Sandwich and side", width: 575, height: 1000 },
  { src: `${localPhoto}desserts.jpg`, alt: "Cookies and brownies in the display case", caption: "Cookies and brownies", width: 750, height: 1000 },
];
export const upperCrustStorefrontPhoto: UpperCrustPhoto = { src: `${localPhoto}front.jpg`, alt: "The Upper Crust storefront with green awning and seasonal lights", caption: "Storefront photograph", width: 750, height: 1000 };

const awningCarouselPhoto = (filename: string, label: string, width: number, height: number): UpperCrustPhoto => ({
  src: `/img/sandwich-shop/awning-carousel/${encodeURIComponent(filename)}`,
  alt: label,
  caption: label,
  width,
  height,
});

export const upperCrustAwningCarouselPhotos: UpperCrustPhoto[] = [
  awningCarouselPhoto("blt.jpg", "BLT", 901, 1000),
  awningCarouselPhoto("brownie.jpg", "Brownie", 750, 1000),
  awningCarouselPhoto("chicken salad.jpg", "Chicken salad sandwich", 750, 1000),
  awningCarouselPhoto("cobb salad.jpg", "Cobb salad", 750, 1000),
  awningCarouselPhoto("corned beef.jpg", "Corned beef sandwich", 750, 1000),
  awningCarouselPhoto("hawaiian sandwich.jpg", "Hawaiian sandwich", 1000, 750),
  awningCarouselPhoto("italian sub.jpg", "Italian sub", 750, 1000),
  awningCarouselPhoto("pastrami and corned beef.jpg", "Pastrami and corned beef sandwich", 750, 1000),
  awningCarouselPhoto("pastrami and roast beef.jpg", "Pastrami and roast beef sandwich", 750, 1000),
  awningCarouselPhoto("pastrami on sourdough with potato salad.jpg", "Pastrami on sourdough with potato salad", 1000, 750),
  awningCarouselPhoto("pastrami.jpg", "Pastrami sandwich", 1000, 750),
  awningCarouselPhoto("tuna on wheat with clam chowder.jpg", "Tuna on wheat with clam chowder", 750, 1000),
  awningCarouselPhoto("turkey and ham on a crossaint with poblano soup.jpg", "Turkey and ham sandwich with poblano soup", 693, 552),
  awningCarouselPhoto("Veggie sandwich and tomato florentine soup.jpg", "Veggie sandwich with tomato florentine soup", 750, 1000),
  awningCarouselPhoto("veggie sandwich with turkey.jpg", "Veggie sandwich with turkey", 750, 1000),
  awningCarouselPhoto("veggie sandwich.jpg", "Veggie sandwich", 750, 1000),
];
