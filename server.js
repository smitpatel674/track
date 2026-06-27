import http from 'node:http';
import { trackShipment } from './tracking.js';

const port = Number(process.env.PORT || 3000);

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*'
  });
  res.end(JSON.stringify(payload, null, 2));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (url.pathname === '/') {
    sendJson(res, 200, {
      ok: true,
      usage: '/tracking/:trackingNo',
      example: '/tracking/269868197'
    });
    return;
  }

  const match = url.pathname.match(/^\/tracking\/([^/]+)$/);
  if (!match) {
    sendJson(res, 404, {
      ok: false,
      error: 'Use /tracking/:trackingNo'
    });
    return;
  }

  const trackingNo = decodeURIComponent(match[1]).trim();
  if (!trackingNo) {
    sendJson(res, 400, {
      ok: false,
      error: 'Tracking number is required.'
    });
    return;
  }

  try {
    const data = await trackShipment(trackingNo, {
      debug: url.searchParams.get('debug') === '1'
    });
    sendJson(res, data.found ? 200 : 404, {
      ok: data.found,
      trackingNo,
      data
    });
  } catch (error) {
    console.error(error);
    sendJson(res, 500, {
      ok: false,
      trackingNo,
      error: error.message
    });
  }
});

server.listen(port, () => {
  console.log(`Tracking API listening on port ${port}`);
  console.log(`Track URL: http://localhost:${port}/tracking/269868197`);
});
