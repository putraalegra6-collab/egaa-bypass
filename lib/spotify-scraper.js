const axios = require("axios");
const cheerio = require("cheerio");

const CONFIG = {
  spotifySearch: "https://spotmp3.net/api/v1/search",
  spotimate: "https://spotimate.app",
  musixmatch: "https://apic-appmobile.musixmatch.com/ws/1.1/",
  appId: "mac-ios-v2.0",
  userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
};

const client = axios.create({
  timeout: 25000,
  headers: {
    "User-Agent": CONFIG.userAgent,
    Accept: "application/json, text/plain, */*"
  }
});

let mxmToken = null;
let mxmTokenTime = 0;

function createMultipartBody(fields) {
  const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);
  let body = "";
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      body += `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`;
    }
  }
  body += `--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

const get = async (url, config = {}) => {
  const response = await client.get(url, config);
  return response.data;
};

const getMxmToken = async (force = false) => {
  if (!force && mxmToken && Date.now() - mxmTokenTime < 21600000) {
    return mxmToken;
  }
  const data = await get(CONFIG.musixmatch + "token.get", {
    params: { app_id: CONFIG.appId, format: "json" }
  });
  const token = data?.message?.body?.user_token;
  if (!token) throw new Error("Gagal mengambil Musixmatch token");
  mxmToken = token;
  mxmTokenTime = Date.now();
  return token;
};

const mxmRequest = async (method, params = {}, retry = true) => {
  const token = await getMxmToken();
  try {
    const data = await get(CONFIG.musixmatch + method, {
      params: { app_id: CONFIG.appId, usertoken: token, format: "json", ...params },
      headers: {
        "X-Cookie": `x-mxm-token-guid=${token}`,
        "x-mxm-app-version": "10.1.1",
        "X-User-Agent": "Mozilla/5.0",
        "Accept-Language": "en-US,en;q=0.9"
      }
    });
    if (data?.message?.header?.status_code === 401 && retry) {
      await getMxmToken(true);
      return mxmRequest(method, params, false);
    }
    return data?.message?.body;
  } catch (error) {
    if (error.response?.status === 401 && retry) {
      await getMxmToken(true);
      return mxmRequest(method, params, false);
    }
    throw error;
  }
};

const findTracks = value => {
  if (!value) return [];
  if (Array.isArray(value)) {
    if (value.some(item => item && (item.id || item.track_id) && (item.name || item.title))) {
      return value;
    }
    for (const item of value) {
      const found = findTracks(item);
      if (found.length) return found;
    }
  }
  if (typeof value === "object") {
    for (const key of ["tracks", "items", "results", "data", "track"]) {
      if (value[key]) {
        const found = findTracks(value[key]);
        if (found.length) return found;
      }
    }
    for (const item of Object.values(value)) {
      const found = findTracks(item);
      if (found.length) return found;
    }
  }
  return [];
};

const searchSpotify = async query => {
  const data = await get(CONFIG.spotifySearch, {
    params: { q: query, limit: 1, provider: "spotify" },
    headers: { Referer: "https://spotmp3.net/", Origin: "https://spotmp3.net" }
  });

  const track = findTracks(data)[0];
  if (!track) throw new Error("Lagu tidak ditemukan di Spotify");

  const id = track.id || track.track_id;
  const title = track.name || track.title;
  const artists = track.artists || track.artist || [];

  const artist = Array.isArray(artists)
    ? artists.map(item => (typeof item === "string" ? item : item?.name)).filter(Boolean).join(", ")
    : typeof artists === "object"
      ? artists?.name || ""
      : artists;

  return {
    id,
    title,
    artist,
    album: track.album?.name || track.album || null,
    duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
    thumbnail: track.album?.images?.[0]?.url || track.thumbnail || track.image || track.cover || null,
    url: track.url || track.external_urls?.spotify || `https://open.spotify.com/track/${id}`
  };
};

const scrapeSpotimate = async url => {
  const cleanUrl = url.trim().split("?")[0];
  const base = CONFIG.spotimate;

  const page = await client.get(base + "/en1", {
    headers: { "User-Agent": CONFIG.userAgent, Accept: "*/*" },
    timeout: 15000
  });

  let cookies = (page.headers["set-cookie"] || []).map(cookie => cookie.split(";")[0]).join("; ");
  let token = "";

  try {
    const verify = await client.post(
      base + "/api/userverify",
      "url=" + encodeURIComponent(cleanUrl),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          "User-Agent": CONFIG.userAgent,
          "X-Requested-With": "XMLHttpRequest",
          Referer: base + "/en1",
          Origin: base,
          Cookie: cookies
        },
        timeout: 10000
      }
    );

    if (verify.data?.token) token = verify.data.token;

    const verifyCookies = (verify.headers["set-cookie"] || []).map(cookie => cookie.split(";")[0]).join("; ");
    if (verifyCookies) cookies = cookies ? `${cookies}; ${verifyCookies}` : verifyCookies;
  } catch {}

  const action = createMultipartBody({ url: cleanUrl, cftoken: token });

  const actionResponse = await client.post(base + "/action", action.body, {
    headers: {
      "Content-Type": action.contentType,
      "User-Agent": CONFIG.userAgent,
      Referer: base + "/en1",
      Origin: base,
      Cookie: cookies
    },
    timeout: 20000
  });

  const actionCookies = (actionResponse.headers["set-cookie"] || []).map(cookie => cookie.split(";")[0]).join("; ");
  if (actionCookies) cookies = cookies ? `${cookies}; ${actionCookies}` : actionCookies;

  const actionData = actionResponse.data;
  if (!actionData || actionData.success === false) {
    throw new Error(actionData?.message || "Spotimate mengembalikan kegagalan");
  }

  const $ = cheerio.load(actionData.html || "");
  const titleH = $("h2, h3").first().text().trim();
  const artistP = $('p.text-sm, p[class*="text-white"], .spotifymate-middle p').first().text().trim();
  const thumbImg = $('img[class*="rounded"], .spotifymate img, img').first().attr("src") || "";

  const tracks = [];
  $("form").each((_, form) => {
    const element = $(form);
    const data = element.find('input[name="data"]').val() || "";
    const trackToken =
      element.find('input[name="token"]').val() ||
      element.find('input[name="track_token"]').val() ||
      "";
    const trackBase = element.find('input[name="base"]').val() || cleanUrl;

    if (!data && !trackToken) return;

    let trackInfo = { title: "", artist: "", thumbnail: "" };
    if (data) {
      try {
        const decoded = JSON.parse(Buffer.from(data, "base64").toString());
        trackInfo.title = decoded.name || decoded.title || "";
        trackInfo.artist = decoded.artist || decoded.singer || "";
        trackInfo.thumbnail = decoded.cover || "";
      } catch {}
    }

    tracks.push({
      data,
      base: trackBase,
      trackToken,
      title: trackInfo.title || titleH || "Spotify Track",
      artist: trackInfo.artist || artistP || "",
      thumbnail: trackInfo.thumbnail || thumbImg
    });
  });

  if (!tracks.length) throw new Error("Tidak ada track yang ditemukan dari Spotimate");

  const firstTrack = tracks[0];
  const downloads = [];

  if (firstTrack.data && firstTrack.trackToken) {
    try {
      const multipart = createMultipartBody({
        data: firstTrack.data,
        base: firstTrack.base || cleanUrl,
        token: firstTrack.trackToken
      });

      const downloadResponse = await client.post(base + "/action/track", multipart.body, {
        headers: {
          "Content-Type": multipart.contentType,
          "User-Agent": CONFIG.userAgent,
          Referer: base + "/en1",
          Origin: base,
          Cookie: cookies
        },
        timeout: 20000
      });

      const downloadHtml = downloadResponse.data?.data || downloadResponse.data?.html || "";

      if (downloadHtml) {
        const $download = cheerio.load(downloadHtml);
        $download("a[href^='http']").each((_, element) => {
          const href = $download(element).attr("href");
          const text = $download(element).text().trim();

          if (
            !href ||
            href.includes("tunecable") ||
            href.includes("premium") ||
            text.toLowerCase().includes("another song")
          ) {
            return;
          }

          const isCover =
            text.toLowerCase().includes("cover") ||
            href.includes("cover") ||
            href.includes("scdn.co") ||
            /\.(jpg|jpeg|png|webp)(\?.*)?$/i.test(href);

          downloads.push({
            type: isCover ? "photo" : "audio",
            quality: isCover ? "cover" : "320kbps",
            url: href
          });
        });
      }
    } catch {}
  }

  return {
    title: firstTrack.title,
    artist: firstTrack.artist,
    thumbnail: firstTrack.thumbnail,
    downloads
  };
};

const getLyrics = async (title, artist) => {
  try {
    const search = await mxmRequest("track.search", {
      q_track: title,
      q_artist: artist,
      page_size: 1,
      page: 1,
      s_track_rating: "desc",
      f_has_lyrics: 1
    });

    const track = search?.track_list?.[0]?.track;
    if (!track?.track_id) return { lyrics: null, synced_lyrics: null };

    const [plain, synced] = await Promise.allSettled([
      mxmRequest("track.lyrics.get", { track_id: track.track_id }),
      mxmRequest("track.subtitle.get", { track_id: track.track_id, subtitle_format: "lrc" })
    ]);

    return {
      lyrics: plain.status === "fulfilled" ? plain.value?.lyrics?.lyrics_body || null : null,
      synced_lyrics: synced.status === "fulfilled" ? synced.value?.subtitle?.subtitle_body || null : null
    };
  } catch {
    return { lyrics: null, synced_lyrics: null };
  }
};

const scrape = async query => {
  const started = Date.now();

  try {
    if (!query || !String(query).trim()) throw new Error("Masukkan judul lagu");

    const track = await searchSpotify(String(query).trim());

    const [spotimate, lyrics] = await Promise.all([
      scrapeSpotimate(track.url).catch(error => ({ error: error.message })),
      getLyrics(track.title, track.artist)
    ]);

    const audio = spotimate.downloads?.find(item => item.type === "audio");

    const result = {
      title: track.title,
      artist: track.artist,
      album: track.album,
      duration: track.duration,
      thumbnail: track.thumbnail || spotimate.thumbnail || null,
      url: track.url,
      download: audio?.url || null,
      download_info: audio ? { provider: "Spotimate", quality: audio.quality } : null,
      downloads: spotimate.downloads || [],
      lyrics: lyrics.lyrics,
      synced_lyrics: lyrics.synced_lyrics
    };

    return {
      status: true,
      query,
      result,
      ...(spotimate.error ? { download_error: spotimate.error } : {}),
      elapsed_ms: Date.now() - started
    };
  } catch (error) {
    return {
      status: false,
      query,
      message: error.message || "Scraping gagal",
      elapsed_ms: Date.now() - started
    };
  }
};

module.exports = { scrape };
