/* ---- Video platform transcript extraction ---- */

export function detectVideoUrl(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let id = u.searchParams.get('v');
      if (!id) id = u.pathname.split('/').filter(Boolean).pop();
      if (id && id.length === 11) return { videoId: id, platform: 'youtube' };
    }

    if (host.includes('bilibili.com')) {
      const bv = u.pathname.match(/\/video\/(BV[a-zA-Z0-9]+)/);
      if (bv) return { videoId: bv[1], platform: 'bilibili' };
      const av = u.pathname.match(/\/video\/(av\d+)/i);
      if (av) return { videoId: av[1], platform: 'bilibili' };
    }

    if (host.includes('b23.tv')) {
      return { videoId: u.pathname.slice(1), platform: 'bilibili_short' };
    }
  } catch {}
  return null;
}

export async function extractVideoTranscript(videoInfo) {
  switch (videoInfo.platform) {
    case 'youtube':
      return fetchYouTubeTranscript(videoInfo.videoId);
    case 'bilibili':
    case 'bilibili_short':
      return fetchBilibiliTranscript(videoInfo.videoId);
    default:
      throw new Error(`不支持的视频平台: ${videoInfo.platform}`);
  }
}

/* ---- YouTube ---- */

async function fetchYouTubeTranscript(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const resp = await fetch(url, {
    headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8' },
  });
  const html = await resp.text();

  // Extract ytInitialPlayerResponse
  const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});\s*var\s/);
  if (!match) throw new Error('无法获取视频数据');

  const data = JSON.parse(match[1]);
  const details = data?.videoDetails;
  const title = details?.title || '';

  const tracks = data?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks || tracks.length === 0) {
    // No captions at all — return metadata only
    const desc = details?.shortDescription || '';
    return {
      title,
      content: `[无字幕]\n标题: ${title}\n简介: ${desc}`,
      hasTranscript: false,
    };
  }

  // Prefer Chinese, then English, then first available
  let track = tracks.find((t) => t.languageCode === 'zh') ||
    tracks.find((t) => t.languageCode === 'zh-Hans') ||
    tracks.find((t) => t.languageCode === 'en') ||
    tracks[0];

  const subResp = await fetch(track.baseUrl + '&fmt=json');
  const subData = await subResp.json();

  const lines = [];
  for (const ev of subData.events || []) {
    if (ev.segs) {
      const text = ev.segs.map((s) => s.utf8).join('');
      if (text.trim()) lines.push(text);
    }
  }

  const content = lines.join('\n');
  if (!content || content.length < 30) {
    throw new Error('字幕内容为空或过短');
  }

  return { title, content, hasTranscript: true };
}

/* ---- Bilibili ---- */

async function fetchBilibiliTranscript(bvid) {
  // Step 1: Get aid + cid
  const detailUrl = `https://api.bilibili.com/x/web-interface/wbi/view/detail?bvid=${bvid}`;
  const detailResp = await fetch(detailUrl, { credentials: 'include' });
  const detail = await detailResp.json();
  if (detail.code !== 0) throw new Error(`B站 API 错误: ${detail.message}`);

  const view = detail.data?.View;
  if (!view) throw new Error('无法获取视频信息');

  const { aid, cid, title } = view;

  // Step 2: Get player data (for subtitle URL)
  const playerUrl = `https://api.bilibili.com/x/player/wbi/v2?aid=${aid}&cid=${cid}`;
  const playerResp = await fetch(playerUrl, { credentials: 'include' });
  const player = await playerResp.json();
  if (player.code !== 0) throw new Error(`B站播放器 API 错误: ${player.message}`);

  const subtitles = player.data?.subtitle?.subtitles;
  if (!subtitles || subtitles.length === 0) {
    return {
      title: title || '',
      content: `[无字幕]\n标题: ${title || ''}\n简介: ${view.desc || ''}`,
      hasTranscript: false,
    };
  }

  // Prefer Chinese
  const sub = subtitles.find((s) => s.lan_doc?.includes('中文')) || subtitles[0];
  const subUrl = sub.subtitle_url.startsWith('//') ? 'https:' + sub.subtitle_url : sub.subtitle_url;

  // Step 3: Fetch subtitle JSON from CDN
  const subResp = await fetch(subUrl);
  const subData = await subResp.json();

  const lines = (subData.body || []).map((item) => item.content).filter(Boolean);

  const content = lines.join('\n');
  if (!content || content.length < 20) {
    throw new Error('字幕内容为空或过短');
  }

  return { title: title || '', content, hasTranscript: true };
}
