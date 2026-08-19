const fs = require('fs');
const path = require('path');

const PEXELS_SEARCH_URL = 'https://api.pexels.com/v1/search';

// Product ke naam/category se Pexels par ek matching photo dhoondta hai,
// usay uploads/ folder mein save karta hai, aur multer jaisa hi relative
// path return karta hai (/uploads/filename.jpg) — taake baqi code (frontend
// image rendering, DB column) ko koi farq na parhe.
async function fetchStockImageForProduct(query) {
  if (!process.env.PEXELS_API_KEY) {
    console.warn('PEXELS_API_KEY not set — skipping auto image fetch.');
    return null;
  }

  try {
    const searchRes = await fetch(`${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=1`, {
      headers: { Authorization: process.env.PEXELS_API_KEY },
    });
    if (!searchRes.ok) return null;

    const searchData = await searchRes.json();
    const photo = searchData.photos && searchData.photos[0];
    if (!photo) return null;

    const imageRes = await fetch(photo.src.medium);
    if (!imageRes.ok) return null;

    const buffer = Buffer.from(await imageRes.arrayBuffer());
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const filepath = path.join(__dirname, '..', 'uploads', filename);
    fs.writeFileSync(filepath, buffer);

    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Auto stock image fetch failed:', err.message);
    return null; // fail silently — product create ko block nahi karna
  }
}

module.exports = { fetchStockImageForProduct };
