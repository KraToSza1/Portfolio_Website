/**
 * Landing Module
 * Handles landing overlay and panel management
 */

let landing = null;

/**
 * Ensure landing element exists
 */
export function ensureLanding() {
  if (landing) return;
  
  landing = document.createElement("div");
  landing.id = "landing";
  landing.hidden = true;
  landing.innerHTML = `
    <div class="landing__bg"></div>
    <div class="landing__panel">
      <button class="landing__close btn-lcars" aria-label="Close">Back to orbit</button>
      <h2 id="landing-title" class="holographic"></h2>
      <div id="landing-body"></div>
    </div>`;
  document.body.appendChild(landing);
  
  landing.querySelector(".landing__close").addEventListener("click", () => {
    landing.hidden = true;
  });
  
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && landing && !landing.hidden) {
      landing.hidden = true;
    }
  });
}

/**
 * Set landing background based on planet
 */
export function setLandingBackgroundByPlanet(t) {
  ensureLanding();
  const bgEl = landing.querySelector(".landing__bg");
  const glow = t?.planet?.glow || "#9fc7ff";
  const base = t?.planet?.base || "#0c1220";
  const shade = t?.planet?.shade || "#060a14";
  bgEl.style.background = `radial-gradient(900px 600px at 25% 20%, ${glow}33 0%, ${base} 35%, ${shade} 70%, #000 100%)`;
}

/**
 * Refresh skill bars animation
 */
export function refreshSkillBars() {
  const bars = landing?.querySelectorAll?.(".skill__fill");
  if (!bars || !bars.length) return;
  bars.forEach(b => {
    b.style.animation = "none";
    void b.offsetHeight;
    b.style.animation = "";
  });
}

/**
 * Open landing panel
 */
export function openLanding(title, html) {
  ensureLanding();
  landing.querySelector("#landing-title").textContent = title;
  landing.querySelector("#landing-body").innerHTML = html;
  landing.hidden = false;
  
  // Bind contact form if present
  if (landing.querySelector("#contact-form")) {
    if (typeof window.bindContactForm === 'function') {
      window.bindContactForm();
    }
  }
  
  // Refresh skill bars if present
  if (landing.querySelector(".skills")) {
    refreshSkillBars();
  }
}

/**
 * Get landing element
 */
export function getLanding() {
  ensureLanding();
  return landing;
}
