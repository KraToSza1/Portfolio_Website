import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.join(__dirname, "..", "assets", "docs", "Raymond-Van-Der-Walt-Resume.pdf");
fs.mkdirSync(path.dirname(outPath), { recursive: true });

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 42, bottom: 42, left: 48, right: 48 },
  info: {
    Title: "Raymond van der Walt — Resume",
    Author: "Raymond van der Walt",
    Subject: "Frontend & Game Developer",
  },
});

doc.pipe(fs.createWriteStream(outPath));

const ink = "#0f172a";
const muted = "#475569";
const accent = "#0ea5e9";
const line = "#e2e8f0";
const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;

function hr() {
  doc.moveDown(0.35);
  const y = doc.y;
  doc.strokeColor(line).lineWidth(1).moveTo(doc.page.margins.left, y).lineTo(doc.page.margins.left + pageW, y).stroke();
  doc.moveDown(0.55);
}

function section(title) {
  doc.moveDown(0.35);
  doc.fillColor(accent).font("Helvetica-Bold").fontSize(10.5).text(title.toUpperCase(), { characterSpacing: 1.2 });
  hr();
}

function job(role, when, bullets) {
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(10.5).text(role, { continued: false });
  doc.fillColor(muted).font("Helvetica").fontSize(9).text(when);
  doc.moveDown(0.2);
  bullets.forEach((b) => {
    doc.fillColor(ink).font("Helvetica").fontSize(9.5).text(`•  ${b}`, {
      width: pageW,
      lineGap: 1.5,
    });
  });
  doc.moveDown(0.45);
}

// Header
doc.fillColor(ink).font("Helvetica-Bold").fontSize(22).text("Raymond van der Walt");
doc.moveDown(0.15);
doc.fillColor(accent).font("Helvetica-Bold").fontSize(11).text("Frontend & Game Developer");
doc.moveDown(0.25);
doc.fillColor(muted).font("Helvetica").fontSize(9.2).text(
  "South Africa  ·  Raymondvdw@gmail.com  ·  rayvdw.dev  ·  github.com/KraToSza1  ·  linkedin.com/in/raymond-van-der-walt-2135b41a5"
);
hr();

// Summary
section("Summary");
doc.fillColor(ink).font("Helvetica").fontSize(9.8).text(
  "Developer focused on cinematic UI and interactive systems — shipping production React products and Unreal Engine 5 HUDs that stay sharp at 60fps. Co-founder of Whts4dinner.com with my beautiful partner. Comfortable owning UI end-to-end: design collaboration, implementation, performance budgets, and accessibility.",
  { width: pageW, lineGap: 2 }
);

// Skills
section("Core Skills");
const skills = [
  ["Frontend", "React, TypeScript, Next.js, CSS/Tailwind, Framer Motion, Canvas/WebGL"],
  ["Game / 3D", "Unreal Engine 5, UMG/CommonUI, Blueprints, Enhanced Input, Materials"],
  ["UX / Motion", "Cinematic HUD design, microinteractions, accessibility, Figma prototyping"],
  ["Tooling", "Node/Vite, Git/GitHub, Vercel, Supabase, build & performance tuning"],
];
skills.forEach(([label, value]) => {
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(9.5).text(`${label}: `, { continued: true });
  doc.font("Helvetica").fillColor(muted).text(value, { width: pageW });
  doc.moveDown(0.15);
});

// Experience
section("Experience");
job("Founder & Developer — Whts4dinner.com", "2025 – Present", [
  "Designed, built, and shipped a live meal-planning web app with my beautiful partner.",
  "Production product at whts4dinner.com — React, TypeScript, Supabase, Vercel.",
]);
job("Product Engineer — QuotePilot, ForgeQuest AI, StorIQ, MiniSME, Will Tool", "2025 – Present", [
  "Shipped AI/SME web tools and location SEO tooling end-to-end on Vercel.",
  "Built schema-driven PDF generation, canteen ordering UX, and Unreal learning quests.",
]);
job("Frontend & Game Developer", "2022 – 2025", [
  "Built cinematic mission HUDs, ARPG menu systems, and CommonUI flows in UE5.",
  "Delivered performance-first web experiences with React, TypeScript, and WebGL/Canvas.",
  "Collaborated with design to wire UI to real game/product state, not static mockups.",
]);
job("Web Developer", "2020 – 2022", [
  "Developed responsive web applications and dynamic form flows with React, TypeScript, and Node.js.",
]);

// Selected work
section("Selected Work");
const projects = [
  ["Whts4dinner.com", "Smart recipe finder & meal planning — live production product."],
  ["QuotePilot AI", "Lead, quote & follow-up PWA for service SMEs."],
  ["ForgeQuest AI", "Personalized Unreal learning through build/break/fix quests."],
  ["StorIQ Location SEO Builder", "Facility location page production cockpit."],
  ["Horror Mission HUD / ARPG UI", "Cinematic UE5 objective flow, markers, and menu systems."],
];
projects.forEach(([name, desc]) => {
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(9.5).text(name, { continued: true });
  doc.font("Helvetica").fillColor(muted).text(` — ${desc}`);
  doc.moveDown(0.12);
});

// Education
section("Education & Learning");
doc.fillColor(ink).font("Helvetica-Bold").fontSize(9.8).text("Higher Certificate in Web and Mobile Development — IIE");
doc.fillColor(muted).font("Helvetica").fontSize(9.2).text(
  "The Independent Institute of Education. Continuous learning via Udemy UE5 C++/UI tracks and shipped product work."
);
doc.moveDown(0.5);

doc.fillColor(muted).font("Helvetica").fontSize(8.5).text(
  "Portfolio · https://rayvdw.dev  ·  Open to remote/onsite opportunities",
  { align: "center" }
);

doc.end();
console.log("Wrote", outPath);
