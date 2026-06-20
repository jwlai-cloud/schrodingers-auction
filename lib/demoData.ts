/**
 * lib/demoData.ts — canonical demo auction catalogue.
 *
 * Used by the scheduled refresher (POST /api/admin/refresh-demo) to keep the
 * lobby alive: each refresh re-lists these items with fresh, staggered start
 * times so they always sit at varied points on the price curve.
 */
import type { FloorAction } from "@/lib/types";

export const DEMO_SELLER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export interface DemoItem {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  category: string;
  startPrice: number;
  reservePrice: number;
  durationS: number;
  floorAction: FloorAction;
  highlights: [string, string, string];
}

export const DEMO_ITEMS: DemoItem[] = [
  {
    id: "11111111-0000-0000-0000-000000000001",
    title: "Sony WH-1000XM5 Wireless Headphones — Midnight Black",
    description: "Industry-leading noise cancellation. 30-hr battery. Brand new sealed.",
    imageUrl: "/items/wh1000xm5.png",
    category: "Electronics",
    startPrice: 1200, reservePrice: 200, durationS: 15 * 60, floorAction: "lottery",
    highlights: ["Sealed in original packaging", "Under 12-month Sony warranty", "Discontinued Midnight Black colour"],
  },
  {
    id: "11111111-0000-0000-0000-000000000002",
    title: "Nintendo Switch OLED — Zelda Limited Edition",
    description: "Limited edition. OLED screen. Zelda: Tears of the Kingdom bundle.",
    imageUrl: "/items/switch-oled-zelda.png",
    category: "Gaming",
    startPrice: 800, reservePrice: 150, durationS: 12 * 60, floorAction: "lottery",
    highlights: ["Factory sealed, holographic sticker intact", "Tears of the Kingdom included", "Sold out at major retailers"],
  },
  {
    id: "11111111-0000-0000-0000-000000000003",
    title: "Apple AirPods Pro (2nd gen) — USB-C",
    description: "H2 chip. Adaptive Transparency. USB-C MagSafe case. Sealed.",
    imageUrl: "/items/airpods-pro-2.png",
    category: "Electronics",
    startPrice: 600, reservePrice: 100, durationS: 18 * 60, floorAction: "withdraw",
    highlights: ["Newest USB-C revision", "AppleCare+ eligible 60 more days", "Engraving available at checkout"],
  },
  {
    id: "11111111-0000-0000-0000-000000000004",
    title: "Dyson V15 Detect Absolute Cordless Vacuum",
    description: "Laser dust detection. 60-min battery. Full attachment kit.",
    imageUrl: "/items/dyson-v15.png",
    category: "Home",
    startPrice: 1500, reservePrice: 350, durationS: 20 * 60, floorAction: "withdraw",
    highlights: ["Zero usage — never opened", "2-year warranty transfers to winner", "Every attachment included"],
  },
  {
    id: "11111111-0000-0000-0000-000000000005",
    title: "Lego Technic Bugatti Chiron — Factory Sealed",
    description: "3,599 pieces. 1:8 scale. Working gearbox. BNIB collector piece.",
    imageUrl: "/items/lego-bugatti.png",
    category: "Collectibles",
    startPrice: 500, reservePrice: 80, durationS: 14 * 60, floorAction: "lottery",
    highlights: ["Lego's most complex Technic set", "Working 8-speed gearbox", "Secondary market value £450+"],
  },
  {
    id: "11111111-0000-0000-0000-000000000006",
    title: "Fujifilm X100VI — Silver, Brand New in Box",
    description: "40MP X-Trans sensor. In-body stabilisation. Retro rangefinder design.",
    imageUrl: "/items/fujifilm-x100vi.png",
    category: "Photography",
    startPrice: 2000, reservePrice: 800, durationS: 25 * 60, floorAction: "withdraw",
    highlights: ["9–12 month waitlist at retail", "First X100 with in-body stabilisation", "Rare silver colourway"],
  },
];
