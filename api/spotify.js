// Spotify Download API: cari lagu (judul / link Spotify), balikin metadata + link MP3 + lirik
const { scrape } = require("../lib/spotify-scraper");

const SPOTIFY_TRACK = /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]+)/;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method && req.method !== "GET") {
    return res.status(405).json({ status: false, message: "method tidak diizinkan" });
  }

  let input = String((req.query || {}).q || "").trim();
  if (!input) return res.status(400).json({ status: false, message: "Masukkan judul lagu atau link Spotify" });

  // Link Spotify -> ambil judul lewat oEmbed, lalu dicari
  if (SPOTIFY_TRACK.test(input)) {
    try {
      const o = await fetch("https://open.spotify.com/oembed?url=" + encodeURIComponent(input));
      const j = await o.json();
      if (j && j.title) input = j.title;
    } catch (e) {}
  }

  const data = await scrape(input);
  return res.status(200).json(data);
};
