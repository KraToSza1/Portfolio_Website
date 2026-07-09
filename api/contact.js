const TO = process.env.CONTACT_TO || "Raymondvdw@gmail.com";

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

    const key = process.env.RESEND_API_KEY;
    if (key) {
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
      if (!resp.ok) {
        console.error("[contact] Resend error", resp.status, await resp.text());
        return res.status(502).json({ ok: false, error: "Email provider failed" });
      }
      return res.status(200).json({ ok: true });
    }

    // Zero-config fallback: FormSubmit (confirm once via email the first time).
    const resp = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(TO)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        message,
        _subject: `Portfolio contact from ${name}`,
        _template: "table",
        _captcha: "false",
      }),
    });

    if (!resp.ok) {
      console.error("[contact] FormSubmit error", resp.status, await resp.text());
      return res.status(502).json({ ok: false, error: "Email provider failed" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[contact]", err);
    return res.status(500).json({ ok: false, error: "Server error" });
  }
};
