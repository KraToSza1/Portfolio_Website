import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("assets/images/certs");
mkdirSync(OUT, { recursive: true });

const covers = [
  { id: "iie", title: "Higher Certificate", sub: "Web & Mobile Development", tag: "IIE", a: "#1a3a5c", b: "#0d1b2a", accent: "#8ad8ff" },
  { id: "react-native", title: "React Native", sub: "The Practical Guide", tag: "Udemy", a: "#0b1f3a", b: "#061018", accent: "#61dafb" },
  { id: "ue5-mp", title: "UE5 C++ Multiplayer", sub: "Crash Course", tag: "Udemy", a: "#2a1020", b: "#12080e", accent: "#ff6b6b" },
  { id: "cpp-fundamentals", title: "C++ Fundamentals", sub: "Game Programming", tag: "Udemy", a: "#10253a", b: "#081018", accent: "#5b9bd5" },
  { id: "ue5-widgets", title: "UE5 Widgets", sub: "Creating UI", tag: "Udemy", a: "#1a1430", b: "#0c0a18", accent: "#c084fc" },
  { id: "ue5-ultimate", title: "UE5 C++ Ultimate", sub: "Game Developer Course", tag: "Udemy", a: "#241810", b: "#120c08", accent: "#ffe081" },
  { id: "ue5-beginner", title: "UE5 Beginner", sub: "Complete Course", tag: "Udemy", a: "#102820", b: "#081410", accent: "#5dffb0" },
  { id: "cpp-gamedev", title: "Learn C++", sub: "For Game Development", tag: "Udemy", a: "#1a2030", b: "#0c1018", accent: "#8ad8ff" },
  { id: "ue5-frontend-ui", title: "UE5 Advanced UI", sub: "Frontend Programming", tag: "Udemy", a: "#201028", b: "#100818", accent: "#f0abfc" },
  { id: "ue5-blueprints", title: "UE5 Blueprints", sub: "Ultimate Developer", tag: "Udemy", a: "#281810", b: "#140c08", accent: "#fb923c" },
  { id: "ue5-gamelift", title: "UE5 Dedicated Servers", sub: "AWS & GameLift", tag: "Udemy", a: "#102028", b: "#081014", accent: "#38bdf8" },
  { id: "ue5-inventory", title: "UE5 UI Design", sub: "Advanced Inventory", tag: "Udemy", a: "#181828", b: "#0c0c16", accent: "#a5b4fc" },
  { id: "ue5-adv-widgets", title: "Advanced Widgets", sub: "UI Systems", tag: "Udemy", a: "#221 grav", b: "#100c18", accent: "#e879f9" },
];

// fix typo in last one
covers[covers.length - 1].a = "#221028";

function svg({ title, sub, tag, a, b, accent }) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450" viewBox="0 0 800 450">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${a}"/>
      <stop offset="100%" stop-color="${b}"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="22%" r="55%">
      <stop offset="0%" stop-color="${accent}" stop-opacity=".35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="450" fill="url(#bg)"/>
  <rect width="800" height="450" fill="url(#glow)"/>
  <circle cx="680" cy="90" r="120" fill="none" stroke="${accent}" stroke-opacity=".18" stroke-width="2"/>
  <circle cx="700" cy="110" r="70" fill="none" stroke="${accent}" stroke-opacity=".28" stroke-width="2"/>
  <rect x="40" y="40" width="720" height="370" rx="22" fill="rgba(0,0,0,.18)" stroke="${accent}" stroke-opacity=".28"/>
  <rect x="64" y="72" width="110" height="28" rx="14" fill="${accent}" fill-opacity=".16" stroke="${accent}" stroke-opacity=".45"/>
  <text x="119" y="91" text-anchor="middle" fill="${accent}" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="700" letter-spacing="1.5">${tag.toUpperCase()}</text>
  <text x="64" y="190" fill="#f4f7ff" font-family="Segoe UI, Arial, sans-serif" font-size="42" font-weight="700">${escapeXml(title)}</text>
  <text x="64" y="240" fill="#c9d4ea" font-family="Segoe UI, Arial, sans-serif" font-size="24">${escapeXml(sub)}</text>
  <rect x="64" y="290" width="180" height="6" rx="3" fill="${accent}" fill-opacity=".75"/>
  <text x="64" y="360" fill="#9fb0cc" font-family="Segoe UI, Arial, sans-serif" font-size="16" letter-spacing="2">RAYMOND VAN DER WALT</text>
</svg>`;
}

function escapeXml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

for (const c of covers) {
  const file = path.join(OUT, `${c.id}.svg`);
  writeFileSync(file, svg(c), "utf8");
  console.log("wrote", file);
}
console.log("done", covers.length);
