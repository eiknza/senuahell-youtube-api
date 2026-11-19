import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = process.env.YOUTUBE_API_KEY;
const CHANNEL_HANDLE = (process.env.YOUTUBE_CHANNEL_HANDLE || "senuahellx").replace(/^@/, "");
const YT_API = "https://www.googleapis.com/youtube/v3";
const CACHE_MS = 15 * 60 * 1000;
let cache = { expires: 0, items: null };

app.use(cors({ origin: true }));
app.get("/", (_req, res) => res.json({ ok: true, service: "SenuaHell YouTube API" }));
app.get("/health", (_req, res) => res.json({ ok: true }));

async function youtube(path, params) {
  const url = new URL(`${YT_API}/${path}`);
  for (const [key, value] of Object.entries({ ...params, key: API_KEY })) url.searchParams.set(key, value);
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `YouTube API HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return data;
}

function durationSeconds(value) {
  const match = String(value || "").match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  return match ? Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0) : 0;
}

async function getVideos() {
  const channel = await youtube("channels", { part: "contentDetails", forHandle: CHANNEL_HANDLE });
  const uploads = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error(`@${CHANNEL_HANDLE} kanalı bulunamadı veya herkese açık kanal bilgisi alınamadı.`);
  const playlistItems = [];
  let pageToken = "";
  for (let page = 0; page < 10; page++) {
    const params = { part: "snippet,contentDetails", playlistId: uploads, maxResults: "50" };
    if (pageToken) params.pageToken = pageToken;
    const result = await youtube("playlistItems", params);
    playlistItems.push(...(result.items || []));
    pageToken = result.nextPageToken || "";
    if (!pageToken) break;
  }
  const ids = playlistItems.map(item => item.contentDetails?.videoId).filter(Boolean);
  const details = [];
  for (let index = 0; index < ids.length; index += 50) {
    const result = await youtube("videos", { part: "snippet,statistics,contentDetails", id: ids.slice(index, index + 50).join(",") });
    details.push(...(result.items || []));
  }
  const byId = new Map(details.map(video => [video.id, video]));
  return playlistItems.map(entry => {
    const id = entry.contentDetails?.videoId || entry.snippet?.resourceId?.videoId;
    const video = byId.get(id);
    if (!id || !video) return null;
    const stats = video.statistics || {};
    const duration = durationSeconds(video.contentDetails?.duration);
    return {
      id,
      title: video.snippet?.title || entry.snippet?.title || "YouTube videosu",
      published: video.snippet?.publishedAt || entry.snippet?.publishedAt || "",
      thumb: video.snippet?.thumbnails?.maxres?.url || video.snippet?.thumbnails?.high?.url || video.snippet?.thumbnails?.medium?.url || `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${id}`,
      isShort: duration > 0 && duration <= 180,
      duration,
      views: stats.viewCount ?? null,
      likes: stats.likeCount ?? null,
      comments: stats.commentCount ?? null
    };
  }).filter(Boolean);
}

app.get("/api/youtube/channel", async (_req, res) => {
  if (!API_KEY) return res.status(500).json({ error: "Render ortam değişkenlerinde YOUTUBE_API_KEY tanımlanmamış." });
  try {
    const result = await youtube("channels", { part: "snippet,statistics", forHandle: CHANNEL_HANDLE });
    const channel = result.items?.[0];
    if (!channel) return res.status(404).json({ error: `@${CHANNEL_HANDLE} kanalı bulunamadı.` });
    return res.json({
      title: channel.snippet?.title || CHANNEL_HANDLE,
      avatar: channel.snippet?.thumbnails?.high?.url || channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url || "",
      subscribers: channel.statistics?.hiddenSubscriberCount ? null : channel.statistics?.subscriberCount ?? null,
      views: channel.statistics?.viewCount ?? null,
      videoCount: channel.statistics?.videoCount ?? null
    });
  } catch (error) {
    console.error("YouTube channel API error:", error.message);
    return res.status(error.status || 502).json({ error: error.message || "YouTube kanal bilgileri alınamadı." });
  }
});

app.get("/api/youtube/videos", async (_req, res) => {
  if (!API_KEY) return res.status(500).json({ error: "Render ortam değişkenlerinde YOUTUBE_API_KEY tanımlanmamış." });
  if (cache.items && Date.now() < cache.expires) return res.json({ items: cache.items, cached: true });
  try {
    const items = await getVideos();
    cache = { items, expires: Date.now() + CACHE_MS };
    res.set("Cache-Control", "public, max-age=300");
    return res.json({ items, cached: false });
  } catch (error) {
    console.error("YouTube API error:", error.message);
    return res.status(error.status || 502).json({ error: error.message || "YouTube verileri alınamadı." });
  }
});

app.listen(PORT, () => console.log(`SenuaHell YouTube API listening on ${PORT}; channel @${CHANNEL_HANDLE}`));
