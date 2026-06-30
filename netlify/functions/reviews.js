// netlify/functions/reviews.js
//
// Handles two things:
//   GET  /.netlify/functions/reviews   -> returns all stored reviews as JSON
//   POST /.netlify/functions/reviews   -> saves a new review, returns updated list
//
// Reviews are stored as a single JSON array under one key in a Netlify Blobs
// store called "blastbros-reviews". This keeps things simple since review
// volume for a small local business will be low (no need for per-review keys).

import { getStore } from "@netlify/blobs";

const STORE_NAME = "blastbros-reviews";
const KEY = "all-reviews";
const MAX_REVIEWS = 200; // safety cap so the blob never grows unbounded
const NOTIFY_EMAIL = "heidijschuster@mac.com";

async function sendReviewNotification(review) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY not set — skipping email notification.");
    return;
  }

  const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Blast Bros Website <onboarding@resend.dev>",
        to: [NOTIFY_EMAIL],
        subject: `New review (${review.rating}★) from ${review.name}`,
        html: `
          <h2>New review on blastbrosny.com</h2>
          <p><strong>Rating:</strong> ${stars}</p>
          <p><strong>Name:</strong> ${review.name}</p>
          <p><strong>Service:</strong> ${review.service || "(not specified)"}</p>
          <p><strong>Review:</strong></p>
          <p>${review.text}</p>
          <hr>
          <p style="color:#888;font-size:0.85em;">Submitted ${review.createdAt}</p>
        `,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend email failed:", res.status, errText);
    }
  } catch (err) {
    console.error("Error sending review notification email:", err);
  }
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Password",
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default async (request) => {
  const store = getStore({ name: STORE_NAME, consistency: "strong" });

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  if (request.method === "GET") {
    let reviews = [];
    try {
      reviews = (await store.get(KEY, { type: "json" })) || [];
    } catch {
      reviews = [];
    }
    return new Response(JSON.stringify({ reviews }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  if (request.method === "POST") {
    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const name = escapeHtml((body.name || "Anonymous").toString().trim().slice(0, 60));
    const service = escapeHtml((body.service || "").toString().trim().slice(0, 60));
    const text = escapeHtml((body.review || "").toString().trim().slice(0, 600));
    let rating = parseInt(body.rating, 10);
    if (!rating || rating < 1 || rating > 5) rating = 5;

    if (!name || !text) {
      return new Response(JSON.stringify({ error: "Name and review text are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    let reviews = [];
    try {
      reviews = (await store.get(KEY, { type: "json" })) || [];
    } catch {
      reviews = [];
    }

    const newReview = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      name,
      service,
      text,
      rating,
      createdAt: new Date().toISOString(),
    };

    reviews.unshift(newReview);
    if (reviews.length > MAX_REVIEWS) reviews = reviews.slice(0, MAX_REVIEWS);

    await store.setJSON(KEY, reviews);

    // Fire off the email notification — don't let a failure here block the
    // response, the review is already saved successfully at this point.
    await sendReviewNotification(newReview);

    return new Response(JSON.stringify({ ok: true, review: newReview, reviews }), {
      status: 201,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  if (request.method === "DELETE") {
    const adminPassword = process.env.ADMIN_PASSWORD;
    const providedPassword = request.headers.get("x-admin-password");

    if (!adminPassword) {
      return new Response(JSON.stringify({ error: "Admin password not configured on server" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }
    if (providedPassword !== adminPassword) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    const idToDelete = body.id;
    if (!idToDelete) {
      return new Response(JSON.stringify({ error: "Missing review id" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders() },
      });
    }

    let reviews = [];
    try {
      reviews = (await store.get(KEY, { type: "json" })) || [];
    } catch {
      reviews = [];
    }

    const updated = reviews.filter(r => r.id !== idToDelete);
    await store.setJSON(KEY, updated);

    return new Response(JSON.stringify({ ok: true, reviews: updated }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    });
  }

  return new Response(JSON.stringify({ error: "Method not allowed" }), {
    status: 405,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
};

export const config = {
  path: "/.netlify/functions/reviews",
};
