// Cuaca: GPS high-accuracy diutamakan, fallback ketat ke IP Vercel, lalu ditolak kalau tetap invalid
module.exports = async (req, res) => {
  const q = req.query || {};
  let lat = Number(q.lat);
  let lon = Number(q.lon);
  let city = '';
  let source = 'gps';

  const valid = (a, b) =>
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180;

  if (!valid(lat, lon)) {
    source = 'ip';
    lat = Number(req.headers['x-vercel-ip-latitude']);
    lon = Number(req.headers['x-vercel-ip-longitude']);
    const rawCity = req.headers['x-vercel-ip-city'] || '';
    try { city = decodeURIComponent(rawCity); } catch (e) { city = rawCity; }
    city = String(city).trim();
  }

  if (!valid(lat, lon)) {
    return res.status(400).json({ error: 'lokasi tidak diketahui' });
  }

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m` +
      `&timezone=auto`;
    const up = await fetch(url);
    const j = await up.json();
    if (!up.ok || !j.current) return res.status(502).json({ error: 'data cuaca kosong' });

    return res.status(200).json({
      temp: j.current.temperature_2m,
      feels: j.current.apparent_temperature,
      humidity: j.current.relative_humidity_2m,
      wind: j.current.wind_speed_10m,
      code: j.current.weather_code,
      city,
      lat,
      lon,
      source
    });
  } catch (e) {
    return res.status(502).json({ error: 'weather gagal: ' + e.message });
  }
};
