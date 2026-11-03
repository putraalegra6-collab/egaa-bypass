// Cuaca: pakai koordinat GPS (?lat&lon) kalau ada, kalau nggak pakai lokasi IP dari header Vercel
module.exports = async (req, res) => {
  const q = req.query || {};
  let lat = Number(q.lat);
  let lon = Number(q.lon);
  let city = '';
  if (q.lat === undefined || q.lon === undefined || !isFinite(lat) || !isFinite(lon)) {
    lat = Number(req.headers['x-vercel-ip-latitude']);
    lon = Number(req.headers['x-vercel-ip-longitude']);
    const rawCity = req.headers['x-vercel-ip-city'] || '';
    try { city = decodeURIComponent(rawCity); } catch (e) { city = rawCity; }
  }
  if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: 'lokasi tidak diketahui' });
  try {
    const up = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`);
    const j = await up.json();
    if (!up.ok || !j.current) return res.status(502).json({ error: 'data cuaca kosong' });
    return res.status(200).json({ temp: j.current.temperature_2m, code: j.current.weather_code, city });
  } catch (e) {
    return res.status(502).json({ error: 'weather gagal: ' + e.message });
  }
};
