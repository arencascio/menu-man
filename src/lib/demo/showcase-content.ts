// Fictional showcase content. Approved photo provenance: public/img/super-tacos/approved/provenance.json.
export const superTacosContent = {
  pages: [{ label: "About", path: "about", icon: "heart" }, { label: "Catering", path: "catering", icon: "handPlatter" }],
  story: {
    eyebrow: "A little about us",
    title: "Good food doesn't need a special occasion.",
    paragraphs: ["Just a warm tortilla, something smoky from the grill, and salsa with a little personality. That's the spirit of Super Tacos: familiar favorites with plenty of color, crunch, and kick."],
    imageUrl: "/img/super-tacos/approved/burrito-preparation.webp",
    imageAlt: "Fresh tortillas, vegetables and guacamole ready for burritos",
    actionLabel: "Meet Super Tacos",
  },
  reviews: {
    title: "A good meal stays with you.",
    disclosure: "Fictional sample testimonials with illustrative stock portraits. People pictured did not provide these quotes.",
    items: [
      { quote: "Bright salsa, warm tortillas, and tacos worth slowing down for.", attribution: "Alex M.", avatarUrl: "/img/super-tacos/approved/avatars/sample-1.webp" },
      { quote: "A generous burrito and a very happy lunch break.", attribution: "Jordan R.", avatarUrl: "/img/super-tacos/approved/avatars/sample-2.webp" },
      { quote: "Chips for the table. Churros to finish. Everyone found a favorite.", attribution: "Sam T.", avatarUrl: "/img/super-tacos/approved/avatars/sample-3.webp" },
      { quote: "The kind of taco night we'd happily make a weekly tradition.", attribution: "Casey L.", avatarUrl: "/img/super-tacos/approved/avatars/sample-4.webp" },
      { quote: "A little heat, plenty of flavor, and something for the whole table.", attribution: "Taylor D.", avatarUrl: "/img/super-tacos/approved/avatars/sample-5.webp" },
    ],
  },
  social: {
    eyebrow: "Life, with a little salsa",
    title: "Too good to keep to yourself.",
    description: "A few delicious moments from our sample menu. Consider this your next lunch inspiration.",
    previewNote: "Illustrative photo feed. Social profiles are not connected.",
    profiles: [{ platform: "instagram", label: "Instagram", iconUrl: "/img/super-tacos/approved/social/instagram.png" }, { platform: "tiktok", label: "TikTok", iconUrl: "/img/super-tacos/approved/social/tiktok.png" }, { platform: "facebook", label: "Facebook", iconUrl: "/img/super-tacos/approved/social/facebook.png" }],
    photos: [
      { src: "/img/super-tacos/approved/street-tacos.webp", alt: "Illustrative street tacos with fresh garnishes" },
      { src: "/img/super-tacos/approved/chips-and-salsa.webp", alt: "Illustrative guacamole and tortilla chips" },
      { src: "/img/super-tacos/approved/burrito.webp", alt: "Cut burrito with a generous filling" },
      { src: "/img/super-tacos/approved/horchata.webp", alt: "Horchata served cold" },
      { src: "/img/super-tacos/approved/churros.webp", alt: "Illustrative cinnamon sugar churros" },
    ],
  },
  about: {
    hero: {
      headline: "Food with feeling.",
      supportingText: "For the lunch break that needs a little life. For the catch-up that runs long. For the simple pleasure of finding your new favorite.",
      imageUrl: "/img/super-tacos/approved/carne-asada-tacos.webp",
      imageAlt: "Illustrative carne asada tacos with onion and cilantro",
    },
    philosophy: {
      eyebrow: "The food comes first",
      title: "Simple things. Full of feeling.",
      paragraphs: [
        "A soft tortilla. A smoky filling. Something cool and crisp. Then a squeeze of lime to bring it all together. We love food that feels generous without getting complicated.",
        "From street tacos to loaded nachos, the idea is the same: let each flavor have its moment. Pick your salsa, add your favorites, and make the meal your own.",
      ],
      imageUrl: "/img/super-tacos/approved/salsas.webp",
      imageAlt: "Bowls of colorful salsas with fresh peppers",
    },
    gathering: {
      eyebrow: "Room for one more",
      title: "The best part is sharing it.",
      paragraphs: ["Some days call for a burrito all to yourself. Others call for chips in the middle and a little of everything. There's no wrong way to find your favorite."],
      imageUrl: "/img/super-tacos/approved/taco-table.webp",
      imageAlt: "A plate of street tacos with fresh toppings",
      actionLabel: "Find your next favorite",
    },
    note: "Super Tacos is a fictional restaurant showcase, built around a very real love of good food.",
  },
  catering: {
    heading: "Flavor to share.",
    description: "A team lunch, a birthday spread, or just a good reason to get everyone together. Here's a taste of what a Super Tacos gathering could look like.",
    imageUrl: "/img/super-tacos/approved/loaded-nachos.webp",
    imageAlt: "Illustrative nachos piled with colorful toppings for sharing",
    packages: [
  {
    "id": "taco-table",
    "name": "The Taco Table",
    "priceCents": 18000,
    "serves": "Serves 10 / $18 per guest",
    "description": "Three trays of ten tacos. Mix the fillings, or double up on a favorite.",
    "includes": [
      "30 tacos: 3 trays of 10",
      "Rice, beans & warm tortillas",
      "Salsa, lime & fresh toppings"
    ],
    "choices": [
      {
        "label": "Tray 1 filling (10 tacos)",
        "options": [
          "Carne asada",
          "Carnitas",
          "Al pastor",
          "Grilled chicken",
          "Roasted vegetables"
        ],
        "defaultValue": "Carne asada"
      },
      {
        "label": "Tray 2 filling (10 tacos)",
        "options": [
          "Carne asada",
          "Carnitas",
          "Al pastor",
          "Grilled chicken",
          "Roasted vegetables"
        ],
        "defaultValue": "Carnitas"
      },
      {
        "label": "Tray 3 filling (10 tacos)",
        "options": [
          "Carne asada",
          "Carnitas",
          "Al pastor",
          "Grilled chicken",
          "Roasted vegetables"
        ],
        "defaultValue": "Grilled chicken"
      },
      {
        "label": "Serving style",
        "options": [
          "Build-your-own trays",
          "Individually packed"
        ]
      }
    ],
    "imageUrl": "/img/super-tacos/approved/carnitas-tacos.webp",
    "imageAlt": "Carnitas tacos with fresh garnishes"
  },
  {
    "id": "lunch-crowd",
    "name": "The Lunch Crowd",
    "priceCents": 16800,
    "serves": "Serves 12 / $14 per guest",
    "description": "Two boxes of six burritos, with room for different tastes.",
    "includes": [
      "12 full-size burritos: 2 boxes of 6",
      "Chips & salsa for the table",
      "Rice, beans & fresh toppings in each burrito"
    ],
    "choices": [
      {
        "label": "Box 1 filling (6 burritos)",
        "options": [
          "Grilled chicken",
          "Carne asada",
          "Black bean & vegetables"
        ],
        "defaultValue": "Grilled chicken"
      },
      {
        "label": "Box 2 filling (6 burritos)",
        "options": [
          "Grilled chicken",
          "Carne asada",
          "Black bean & vegetables"
        ],
        "defaultValue": "Black bean & vegetables"
      },
      {
        "label": "Serving style",
        "options": [
          "Individually wrapped",
          "Halved on sharing trays"
        ]
      }
    ],
    "imageUrl": "/img/super-tacos/approved/chicken-burrito.webp",
    "imageAlt": "Chicken burrito cut to show its filling"
  },
  {
    "id": "celebration",
    "name": "A Little Celebration",
    "priceCents": 22500,
    "serves": "Serves 15 / $15 per guest",
    "description": "Two rolled-taco trays, quesadilla wedges and something sweet to finish.",
    "includes": [
      "30 loaded rolled tacos: 2 trays of 15",
      "15 quesadilla wedges",
      "Chips, salsa & cinnamon churros"
    ],
    "choices": [
      {
        "label": "Tray 1 filling (15 rolled tacos)",
        "options": [
          "Chicken",
          "Potato"
        ],
        "defaultValue": "Chicken"
      },
      {
        "label": "Tray 2 filling (15 rolled tacos)",
        "options": [
          "Chicken",
          "Potato"
        ],
        "defaultValue": "Potato"
      },
      {
        "label": "Quesadilla tray",
        "options": [
          "Cheese",
          "Roasted vegetables & cheese"
        ]
      },
      {
        "label": "Salsa preference",
        "options": [
          "Mild",
          "Medium",
          "A little of each"
        ]
      }
    ],
    "imageUrl": "/img/super-tacos/approved/loaded-taquitos.webp",
    "imageAlt": "Loaded rolled tacos topped with fresh garnishes"
  }
],
    steps: [
      { title: "Find your spread", description: "Start with the food your group would love." },
      { title: "Share the occasion", description: "A real inquiry could capture your date, guest count, and food preferences." },
      { title: "Bring it together", description: "The restaurant could follow up to agree on the menu and details." },
    ],
  },
} as const;
