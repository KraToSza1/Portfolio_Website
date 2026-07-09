const TO = process.env.CONTACT_TO || "Raymondvdw@gmail.com";

async function sendWithResend({ name, email, message }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const from = process.env.CONTACT_FROM || "Portfolio <onboarding@resend.com>";
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [TO],
      reply_to: email,
      subject: `Portfolio contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
    }),
  });
  if (!resp.ok) throw new Error(`Resend ${resp.status}: ${await resp.text()}`);
  return "resend";
}

async function sendWithWeb3Forms({ name, email, message }) {
  const accessKey = process.env.WEB3FORMS_ACCESS_KEY;
  if (!accessKey) return null;
  const resp = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: accessKey,
      name,
      email,
      message,
      subject: `Portfolio contact from ${name}`,
      from_name: "rayvdw.dev",
    }),
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || data.success === false) {
    throw new Error(`Web3Forms ${resp.status}: ${JSON.stringify(data)}`);
  }
  return "web3forms";
}

async function sendWithFormspree({ name, email, message }) {
  const id = process.env.FORMSPREE_FORM_ID;
  if (!id) return null;
  const resp = await fetch(`https://formspree.io/f/${id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ name, email, message }),
  });
  if (!resp.ok) throw new Error(`Formspree ${resp.status}: ${await resp.text()}`);
  return "formspree";
}

async function sendWithFormSubmit({ name, email, message }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const resp = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(TO)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        name,
        email,
        message,
        _subject: `Portfolio contact from ${name}`,
        _template: "table",
        _captcha: "false",
      }),
      signal: controller.signal,
    });
    if (!resp.ok) throw new Error(`FormSubmit ${resp.status}: ${await resp.text()}`);
    return "formsubmit";
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const contentType = String(req.headers["content-type"] || "");
    let body = req.body;

    if (typeof body === "string") {
      if (contentType.includes("application/json")) body = JSON.parse(body || "{}");
      else body = Object.fromEntries(new URLSearchParams(body));
    } else if (!body || typeof body !== "object") {
      body = {};
    }

    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim();
    const message = String(body.message || "").trim();
    const hp = String(body._hp || body.hp || "").trim();

    if (hp) return res.status(200).json({ ok: true });
    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }

    const payload = { name, email, message };
    const providers = [sendWithResend, sendWithWeb3Forms, sendWithFormspree, sendWithFormSubmit];
    const errors = [];

    for (const send of providers) {
      try {
        const via = await send(payload);
        if (via) return res.status(200).json({ ok: true, via });
      } catch (err) {
        errors.push(String(err?.message || err));
      }
    }

    console.error("[contact] all providers failed", errors);
    return res.status(503).json({
      ok: false,
      error: "Email provider unavailable",
      hint: "Set WEB3FORMS_ACCESS_KEY or RESEND_API_KEY on the Vercel project.",
    });
  } catch (err) {
    console.error("[contact]", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
