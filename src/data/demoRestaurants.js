// Synthetic examples, not approved partners or live merchant records.
// Food prices are illustrative; no delivery fee is quoted.
export const DEMO_RESTAURANTS = [
  {
    id: 'demo-acacia-kitchen', name: 'Acacia Demo Kitchen',
    description: 'Comforting stews, injera and simple lunch plates.',
    image: '/demo/bowl.svg', campusIds: ['aau-4k', 'aau-5k'], menuAvailable: true,
    items: [
      { id: 'acacia-shiro', name: 'Shiro with injera', description: 'A warm chickpea stew served with injera.', price: 110, image: '/demo/bowl.svg', available: true },
      { id: 'acacia-vegetable-plate', name: 'Vegetable plate', description: 'Lentils, cabbage and seasonal vegetables with injera.', price: 135, image: '', available: true },
      { id: 'acacia-sambusa', name: 'Lentil sambusa', description: 'A crisp pastry with a spiced lentil filling.', price: 35, image: '', available: false },
    ],
  },
  {
    id: 'demo-courtyard-cafe', name: 'Courtyard Demo Café',
    description: 'Easy breakfast plates and something warm to sip.',
    image: '/demo/cafe.svg', campusIds: ['aau-4k', 'aau-6k'], menuAvailable: true,
    items: [
      { id: 'courtyard-firfir', name: 'Firfir', description: 'Torn injera tossed in a gently spiced sauce.', price: 95, image: '/demo/bowl.svg', available: true },
      { id: 'courtyard-tea', name: 'Spiced tea', description: 'Black tea with warming spices.', price: 25, image: '/demo/cafe.svg', available: true },
      { id: 'courtyard-omelette', name: 'Vegetable omelette', description: 'Eggs folded with tomato, onion and peppers.', price: 100, image: '', available: false },
    ],
  },
  {
    id: 'demo-tempo-table', name: 'Tempo Demo Table',
    description: 'Rice bowls, pasta and relaxed study-break meals.',
    image: '/demo/bowl.svg', campusIds: ['aau-6k', 'yared-music-school'], menuAvailable: true,
    items: [
      { id: 'tempo-rice', name: 'Vegetable rice bowl', description: 'Rice with sautéed vegetables and a light tomato sauce.', price: 120, image: '/demo/bowl.svg', available: true },
      { id: 'tempo-pasta', name: 'Tomato pasta', description: 'Pasta with a simple tomato and herb sauce.', price: 130, image: '', available: true },
      { id: 'tempo-coffee', name: 'Coffee', description: 'A small cup of freshly brewed coffee.', price: 30, image: '/demo/cafe.svg', available: false },
    ],
  },
  {
    id: 'demo-sunroom-kitchen', name: 'Sunroom Demo Kitchen',
    description: 'A sample kitchen whose menu has not been added yet.',
    image: '/demo/cafe.svg', campusIds: ['aau-5k', 'yared-music-school'], menuAvailable: true, items: [],
  },
  {
    id: 'demo-hilltop-canteen', name: 'Hilltop Demo Canteen',
    description: 'A sample canteen with a temporarily unavailable demo menu.',
    image: '', campusIds: ['aau-4k', 'aau-6k'], menuAvailable: false, items: [],
  },
];
