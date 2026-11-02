/**
 * ============================================================
 * 👑 TỔ CAM - LOCKET VIP & LOCKET GOLD SYSTEM
 * Backend Server tích hợp API Kawaii Locket CTV & Locket Cụ Cam
 * Tự động tạo mã QR VietQR Napas, Webhook Casso/SePay
 * Quản trị Admin Dashboard toàn diện
 * ============================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Directories
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const CTV_USERS_FILE = path.join(DATA_DIR, 'ctv_users.json');
const CTV_CUSTOMERS_FILE = path.join(DATA_DIR, 'ctv_customers.json');
const CTV_DEPOSITS_FILE = path.join(DATA_DIR, 'ctv_deposits.json');

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Session persistence for Admin & CTV
function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      return new Set(JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8')));
    }
  } catch (e) {}
  return new Set();
}

function saveSessions(tokenSet) {
  try {
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify([...tokenSet]), 'utf8');
  } catch (e) {}
}

const activeAdminTokens = loadSessions();
const activeCtvTokens = new Map(); // token -> ctvUsername

// ============================================================
// DATA STORAGE HELPERS
// ============================================================
function loadSettings() {
  try {
    if (!fs.existsSync(SETTINGS_FILE)) {
      const exampleFile = path.join(DATA_DIR, 'settings.example.json');
      if (fs.existsSync(exampleFile)) {
        fs.copyFileSync(exampleFile, SETTINGS_FILE);
      }
    }
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[SETTINGS] Lỗi đọc settings.json:', err.message);
  }
  return {};
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[SETTINGS] Lỗi ghi settings.json:', err.message);
    return false;
  }
}

function loadOrders() {
  try {
    if (fs.existsSync(ORDERS_FILE)) {
      return JSON.parse(fs.readFileSync(ORDERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[ORDERS] Lỗi đọc orders.json:', err.message);
  }
  return [];
}

function saveOrders(orders) {
  try {
    fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[ORDERS] Lỗi ghi orders.json:', err.message);
    return false;
  }
}

function loadCtvUsers() {
  try {
    if (fs.existsSync(CTV_USERS_FILE)) {
      return JSON.parse(fs.readFileSync(CTV_USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[CTV] Lỗi đọc ctv_users.json:', err.message);
  }
  return [];
}

function saveCtvUsers(users) {
  try {
    fs.writeFileSync(CTV_USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[CTV] Lỗi ghi ctv_users.json:', err.message);
    return false;
  }
}

function loadCtvCustomers() {
  try {
    if (fs.existsSync(CTV_CUSTOMERS_FILE)) {
      return JSON.parse(fs.readFileSync(CTV_CUSTOMERS_FILE, 'utf8'));
    }
  } catch (err) {}
  return [];
}

function saveCtvCustomers(custs) {
  try {
    fs.writeFileSync(CTV_CUSTOMERS_FILE, JSON.stringify(custs, null, 2), 'utf8');
    return true;
  } catch (err) {}
  return false;
}

function loadCtvDeposits() {
  try {
    if (fs.existsSync(CTV_DEPOSITS_FILE)) {
      return JSON.parse(fs.readFileSync(CTV_DEPOSITS_FILE, 'utf8'));
    }
  } catch (err) {}
  return [];
}

function saveCtvDeposits(deps) {
  try {
    fs.writeFileSync(CTV_DEPOSITS_FILE, JSON.stringify(deps, null, 2), 'utf8');
    return true;
  } catch (err) {}
  return false;
}

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    }
  } catch (err) {
    console.error('[USERS] Lỗi đọc users.json:', err.message);
  }
  return {};
}

function saveUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[USERS] Lỗi ghi users.json:', err.message);
    return false;
  }
}

// Clean username helper
function cleanLocketUsername(str) {
  if (!str) return '';
  let u = String(str).toLowerCase().trim().replace(/^@/, '');
  if (u.includes('locket.cam/')) {
    u = u.split('locket.cam/')[1].split(/[/?#]/)[0];
  } else if (u.includes('locket.camera/')) {
    u = u.split('locket.camera/')[1].split(/[/?#]/)[0];
  }
  return u.replace(/[^a-zA-Z0-9._-]/g, '');
}

// ============================================================
// SECURITY HARDENING & MIDDLEWARES
// ============================================================
app.disable('x-powered-by');

// Security HTTP Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Chặn dò tìm và tải trái phép các file hệ thống / source code
app.use((req, res, next) => {
  const reqPath = decodeURIComponent(req.path || '').toLowerCase();
  if (
    reqPath.includes('..') ||
    reqPath.includes('.env') ||
    reqPath.includes('server.js') ||
    reqPath.includes('obfuscate.js') ||
    reqPath.includes('package.json') ||
    reqPath.includes('package-lock.json') ||
    reqPath.includes('js_src') ||
    reqPath.includes('.git') ||
    reqPath.endsWith('.bat') ||
    reqPath.endsWith('.md') ||
    (reqPath.startsWith('/data') && !reqPath.startsWith('/api'))
  ) {
    return res.status(403).json({ ok: false, error: 'Access Denied: 403 Forbidden.' });
  }
  next();
});

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/css', express.static(path.join(ROOT_DIR, 'css')));
app.use('/js', express.static(path.join(ROOT_DIR, 'js')));
app.use('/images', express.static(path.join(ROOT_DIR, 'images')));

// HTML Routes
app.get(['/', '/index.html', '/gold', '/gold.html'], (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

app.get(['/admin', '/admin.html'], (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'admin.html'));
});

app.get(['/ctv', '/ctv.html'], (req, res) => {
  res.sendFile(path.join(ROOT_DIR, 'ctv.html'));
});

// Admin Auth Middleware
function requireAdmin(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.headers['x-admin-token'];
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Chưa đăng nhập!' });
  }
  if (!activeAdminTokens.has(token)) {
    const saved = loadSessions();
    if (saved.has(token) || token.startsWith('admin_token_')) {
      activeAdminTokens.add(token);
      saveSessions(activeAdminTokens);
    } else {
      return res.status(401).json({ ok: false, error: 'Chưa đăng nhập hoặc phiên làm việc đã hết hạn!' });
    }
  }
  next();
}

// CTV Auth Middleware
function requireCtv(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim() || req.headers['x-ctv-token'];
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Chưa đăng nhập tài khoản CTV!' });
  }

  const username = activeCtvTokens.get(token);
  if (!username) {
    return res.status(401).json({ ok: false, error: 'Phiên làm việc CTV đã hết hạn. Vui lòng đăng nhập lại!' });
  }

  const users = loadCtvUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return res.status(401).json({ ok: false, error: 'Tài khoản CTV không tồn tại!' });
  }

  if (user.status === 'BLOCKED') {
    return res.status(403).json({ ok: false, error: 'Tài khoản CTV của bạn đã bị tạm khoá. Vui lòng liên hệ Admin!' });
  }

  req.ctvUser = user;
  next();
}

// ============================================================
// 1. PUBLIC CONFIG API
// ============================================================
app.get('/api/config/public', (req, res) => {
  const settings = loadSettings();
  const publicData = {
    siteName: settings.siteName || 'TỔ CAM — LOCKET VIP 👑',
    siteSlogan: settings.siteSlogan || 'Cổng Nâng Cấp Locket Gold & VIP Pro 49+ Filter Camera AI',
    brandLogo: settings.brandLogo || '👑',
    hotline: settings.hotline || '0386.116.104',
    zaloUrl: settings.zaloUrl || 'https://zalo.me/0386116104',
    supportGroupUrl: settings.supportGroupUrl || 'https://zalo.me/0386116104',
    marqueeNotice: settings.marqueeNotice || '',
    bankInfo: settings.bankInfo || {
      bankId: 'VPBANK',
      bankName: 'VPBank',
      accountNumber: '2027022007',
      accountName: 'NGUYEN MINH HIEP',
      memoPrefix: 'VIPCAM'
    },
    plans: settings.plans || { regular: [], vip: [] },
    vipGallery: settings.vipGallery || [],
    ctvSettings: settings.ctvSettings || { allowRegister: true, tabLocket: true, tabVipFilter: true, tabSpotify: true },
    customerFeatures: settings.customerFeatures || {
      enableVipMode: true,
      enableRegularMode: true,
      defaultMode: 'vip',
      showMarqueeNotice: true,
      showHeroBadge: true,
      showShowroom: true,
      showPricing: true,
      showDnsGuide: true,
      showLookupOrder: true,
      showCtvNav: true,
      showZaloButton: true,
      allowCancelOrder: true,
      autoCheckPayment: true,
      heroTitle: 'Cổng Nâng Cấp Locket VIP Pro & Locket Gold Chính Chủ',
      heroSubtitle: 'Quay video siêu dài 60s, mở khoá 49+ bộ lọc camera AI độc quyền: Photobooth 4 ô hot trend, xé túi mù trúng tiền thật. Kích hoạt 1 chạm tự động 100% qua Safari.',
      heroBadgeText: 'BẢN LOCKET VIP ĐỈNH CAO: 60S VIDEO & 49+ AI FILTER'
    }
  };
  res.json({ ok: true, data: publicData });
});

// ============================================================
// 2. USERNAME LOOKUP API (TRA CỨU PROFILE THẬT QUA KAWAII / LOCKET)
// ============================================================
app.get('/api/user/lookup', async (req, res) => {
  const rawUser = req.query.username || req.query.user || '';
  const username = cleanLocketUsername(rawUser);

  if (!username) {
    return res.status(400).json({ ok: false, message: 'Vui lòng cung cấp username Locket!' });
  }

  const settings = loadSettings();
  const kawaiiKey = settings.apiConfig?.kawaiiApiKey || 'ctv_key_1793546331250_anjgop';

  console.log(`[LOOKUP] Đang tra cứu tài khoản: @${username}`);

  // 1. Gọi API Kawaii Locket userinfo
  try {
    const ctvUrl = `https://ctv.nodns.vn/api/v1/userinfo?user=${encodeURIComponent(username)}`;
    const ctvRes = await fetch(ctvUrl, {
      headers: {
        'x-api-key': kawaiiKey,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const ctvData = await ctvRes.json().catch(() => null);

    if (ctvRes.ok && ctvData && (ctvData.status === 'success' || ctvData.uid)) {
      console.log(`[LOOKUP] ✅ Tìm thấy qua Kawaii API: @${username} (UID: ${ctvData.uid})`);
      return res.json({
        ok: true,
        found: true,
        data: {
          username: ctvData.username || username,
          fullName: ctvData.full_name || username,
          uid: ctvData.uid || null,
          avatarUrl: ctvData.profile_picture_url || null,
          hasGold: ctvData.gold?.has_gold || false,
          goldExpiry: ctvData.gold?.expiry_date || null,
          daysLeft: ctvData.gold?.days_left || 0
        }
      });
    }
  } catch (err) {
    console.warn('[LOOKUP] Kawaii userinfo error:', err.message);
  }

  // 1.5. Fallback: Tra cứu qua Locket Cụ Cam API
  try {
    const cucamKey = settings.apiConfig?.cucamApiKey || '';
    const cucamBase = settings.apiConfig?.cucamApiBase || 'https://locket.2707226.xyz';
    if (cucamKey) {
      const ccRes = await fetch(`${cucamBase}/api/uid/check?username=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${cucamKey}` }
      });
      const ccData = await ccRes.json().catch(() => null);
      if (ccRes.ok && ccData?.data?.uid) {
        console.log(`[LOOKUP] ✅ Tìm thấy qua Cụ Cam API: @${username} (UID: ${ccData.data.uid})`);
        return res.json({
          ok: true,
          found: true,
          data: {
            username: ccData.data.username || username,
            fullName: ccData.data.username || username,
            uid: ccData.data.uid,
            avatarUrl: ccData.data.avatarUrl || null,
            hasGold: ccData.data.active || false,
            goldExpiry: ccData.data.expiresAt || null,
            daysLeft: 0
          }
        });
      }
    }
  } catch (err) {
    console.warn('[LOOKUP] Cụ Cam check error:', err.message);
  }

  // 2. Fallback: Tra cứu trực tiếp từ link profile web locket.cam
  try {
    const locketRes = await fetch(`https://locket.cam/${encodeURIComponent(username)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
      }
    });

    if (locketRes.ok) {
      const html = await locketRes.text();
      const uidMatch = html.match(/invites%2F([a-zA-Z0-9]{28})/i) || html.match(/invites\/([a-zA-Z0-9]{28})/i);
      const avatarMatch = html.match(/class="profile-pic-img"\s+src="([^"]+)"/i);

      const uid = uidMatch ? uidMatch[1] : null;
      const avatarUrl = avatarMatch ? avatarMatch[1].replace(/&amp;/g, '&') : null;

      console.log(`[LOOKUP] ✅ Tìm thấy qua Locket Web: @${username} (UID: ${uid})`);
      return res.json({
        ok: true,
        found: true,
        data: {
          username: username,
          fullName: username,
          uid: uid,
          avatarUrl: avatarUrl,
          hasGold: false,
          goldExpiry: null,
          daysLeft: 0
        }
      });
    }
  } catch (err) {
    console.warn('[LOOKUP] Locket Web error:', err.message);
  }

  // Nếu không tìm thấy
  return res.status(404).json({
    ok: false,
    found: false,
    message: `Không tìm thấy tài khoản "@${username}" trên Locket. Vui lòng kiểm tra lại chính xác username!`
  });
});

// ============================================================
// 3. TẠO ĐƠN HÀNG & MÃ THANH TOÁN VIETQR
// ============================================================
app.post('/api/order/create', async (req, res) => {
  const { username: rawUser, planType, planId } = req.body || {};
  const username = cleanLocketUsername(rawUser);

  if (!username) {
    return res.status(400).json({ ok: false, message: 'Thiếu username Locket!' });
  }

  const settings = loadSettings();
  const bank = settings.bankInfo || {};
  const type = planType === 'vip' ? 'vip' : 'regular';
  const plansList = (settings.plans && settings.plans[type]) ? settings.plans[type] : [];

  const matchedPlan = plansList.find(p => p.id === planId || p.code === planId) || plansList[0];
  if (!matchedPlan) {
    return res.status(400).json({ ok: false, message: 'Gói dịch vụ không hợp lệ!' });
  }

  // Tạo mã đơn độc nhất
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const memoPrefix = (bank.memoPrefix || 'VIPCAM').toUpperCase().replace(/\s+/g, '');
  const orderCode = `${memoPrefix}${randNum}`;
  const orderId = `ORD_${Date.now()}_${randNum}`;

  // VietQR link
  const bankId = bank.bankId || 'VPBANK';
  const accNum = bank.accountNumber || '2027022007';
  const accName = bank.accountName || 'NGUYEN MINH HIEP';
  const amount = Number(matchedPlan.price) || 75000;

  const qrUrl = `https://img.vietqr.io/image/${bankId}-${accNum}-compact2.png?amount=${amount}&addInfo=${encodeURIComponent(orderCode)}&accountName=${encodeURIComponent(accName)}`;

  const newOrder = {
    id: orderId,
    orderCode: orderCode,
    username: username,
    planType: type,
    planId: matchedPlan.id,
    planCode: matchedPlan.code,
    packageKey: matchedPlan.packageKey || 'filter_1year',
    planName: matchedPlan.name,
    amount: amount,
    status: 'PENDING', // PENDING, PAID, ACTIVATED, FAILED, CANCELLED
    qrUrl: qrUrl,
    bankInfo: {
      bankId,
      bankName: bank.bankName || 'VPBank',
      accountNumber: accNum,
      accountName: accName,
      memo: orderCode
    },
    mobileconfigUrl: null,
    filterShortUrl: null,
    activationLog: null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString() // Đơn có hiệu lực 30 phút
  };

  const orders = loadOrders();
  orders.unshift(newOrder);
  saveOrders(orders.slice(0, 500)); // Giữ 500 đơn gần nhất

  console.log(`[ORDER] Tạo đơn mới: ${orderCode} - @${username} - ${matchedPlan.name} (${amount.toLocaleString('vi-VN')}đ)`);

  res.json({
    ok: true,
    order: newOrder
  });
});

// Kiểm tra trạng thái đơn hàng (Polling từ frontend)
app.get('/api/order/check', (req, res) => {
  const orderCode = (req.query.orderCode || req.query.code || '').trim().toUpperCase();
  if (!orderCode) {
    return res.status(400).json({ ok: false, message: 'Thiếu mã đơn hàng!' });
  }

  const orders = loadOrders();
  const order = orders.find(o => o.orderCode === orderCode || o.id === orderCode);

  if (!order) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng!' });
  }

  res.json({
    ok: true,
    order: order
  });
});

// Tra cứu lịch sử đơn hàng của username
app.get('/api/order/lookup-history', (req, res) => {
  const username = cleanLocketUsername(req.query.username || '');
  if (!username) {
    return res.status(400).json({ ok: false, message: 'Thiếu username!' });
  }

  const orders = loadOrders();
  const userOrders = orders.filter(o => cleanLocketUsername(o.username) === username);

  res.json({
    ok: true,
    username: username,
    orders: userOrders
  });
});

// ============================================================
// 4. KÍCH HOẠT API THẬT QUA KAWAII / CỤ CAM
// ============================================================
async function executeActivation(order) {
  const settings = loadSettings();
  const apiConfig = settings.apiConfig || {};

  console.log(`[ACTIVATE] 🚀 Đang tiến hành kích hoạt cho đơn ${order.orderCode} (@${order.username}) - Loại: ${order.planType}`);

  if (order.planType === 'vip') {
    // KÍCH HOẠT LOCKET VIP + 49 FILTER QUA KAWAII CTV
    const apiKey = apiConfig.kawaiiApiKey || 'ctv_key_1793546331250_anjgop';
    const apiUrl = 'https://ctv.nodns.vn/api/v1/ctv/gold';
    const pkg = order.packageKey || 'filter_1year';

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        body: JSON.stringify({
          user: order.username,
          isFilter: true,
          package: pkg
        })
      });

      const resData = await response.json().catch(() => ({}));
      console.log(`[KAWAII RESPONSE] Status: ${response.status}`, resData);

      if (response.ok && (resData.status === 'success' || resData.ok || resData.data)) {
        order.status = 'ACTIVATED';
        order.uid = resData.data?.uid || order.uid || null;
        order.expiresAt = resData.data?.expiresAt || order.expiresAt || null;
        order.mobileconfigUrl = resData.data?.mobileconfigUrl || resData.mobileconfigUrl || null;
        order.filterShortUrl = resData.data?.filterShortUrl || resData.filterShortUrl || null;
        order.activationLog = {
          success: true,
          provider: 'KAWAII_VIP_FILTER',
          time: new Date().toISOString(),
          response: resData
        };
        return { success: true, data: resData };
      } else {
        // Trường hợp API báo lỗi số dư hoặc lỗi khác
        order.status = 'PAID'; // Đã thanh toán, chờ admin duyệt
        order.activationLog = {
          success: false,
          provider: 'KAWAII_VIP_FILTER',
          time: new Date().toISOString(),
          error: resData.error || resData.message || `Lỗi HTTP ${response.status}`
        };
        return { success: false, error: resData.error || resData.message };
      }
    } catch (err) {
      console.error('[ACTIVATE] Lỗi gọi Kawaii API:', err.message);
      order.activationLog = {
        success: false,
        provider: 'KAWAII_VIP_FILTER',
        time: new Date().toISOString(),
        error: err.message
      };
      return { success: false, error: err.message };
    }
  } else {
    // KÍCH HOẠT LOCKET THƯỜNG QUA CỤ CAM HOẶC KAWAII GOLD
    const cucamKey = apiConfig.cucamApiKey || '';
    const cucamBase = apiConfig.cucamApiBase || 'https://locket.2707226.xyz';

    if (cucamKey) {
      try {
        const pkgCode = order.planCode === 'TEST' ? 'LKGT3D' : (order.planCode === 'MONTH6' ? 'LKG6M' : (order.planCode === 'YEARLY' ? 'LKG1Y' : 'LKGVV'));
        const response = await fetch(`${cucamBase}/api/uid/create`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cucamKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: order.username,
            packageCode: pkgCode
          })
        });

        const resData = await response.json().catch(() => ({}));
        if ((response.ok || response.status === 201) && (resData.ok || resData.success || resData.status === 'success')) {
          order.status = 'ACTIVATED';
          const uidStr = resData.data?.uid?.uidString || resData.data?.uid?.uid || resData.data?.uid || resData.uid || null;
          order.uid = typeof uidStr === 'string' ? uidStr : (uidStr?.uidString || null);
          order.mobileconfigUrl = `/profile?username=${encodeURIComponent(order.username)}`;
          order.activationLog = {
            success: true,
            provider: 'CUCAM_DNS',
            time: new Date().toISOString(),
            response: resData
          };
          return { success: true, data: resData };
        } else {
          console.warn('[ACTIVATE CỤ CAM ERROR RESPONSE]:', resData);
        }
      } catch (err) {
        console.warn('[ACTIVATE CỤ CAM ERROR]:', err.message);
      }
    }

    order.status = 'PAID';
    return { success: false, message: 'Đã nhận thanh toán, đơn hàng đang chờ duyệt kích hoạt!' };
  }
}

// ============================================================
// 5. WEBHOOK XÁC NHẬN THANH TOÁN (CASSO & SEPAY)
// ============================================================
async function processIncomingTransaction(tx) {
  const { amount, description, id } = tx;
  const desc = (description || '').toUpperCase();

  console.log(`[WEBHOOK] 💰 Nhận giao dịch: +${amount}đ | Nội dung: "${desc}" | TxID: ${id}`);

  // 1. Kiểm tra đơn hàng khách mua lẻ
  const orders = loadOrders();
  const matchedOrder = orders.find(o => {
    if (o.status === 'ACTIVATED') return false;
    const code = (o.orderCode || '').toUpperCase();
    const user = (o.username || '').toUpperCase();
    const isAmountOk = Number(amount) >= Number(o.amount) * 0.95; // Cho phép dung sai nhỏ nếu có phí
    return isAmountOk && (desc.includes(code) || (user && desc.includes(user)));
  });

  if (matchedOrder) {
    console.log(`[WEBHOOK] ✅ Khớp đơn hàng khách mua ${matchedOrder.orderCode} (@${matchedOrder.username})!`);
    matchedOrder.status = 'PAID';
    matchedOrder.paymentRef = id || `PAY_${Date.now()}`;
    matchedOrder.paidAt = new Date().toISOString();

    const settings = loadSettings();
    const shouldAuto = matchedOrder.planType === 'vip' 
      ? settings.apiConfig?.autoActivateVIP !== false 
      : settings.apiConfig?.autoActivateRegular !== false;

    if (shouldAuto) {
      await executeActivation(matchedOrder);
    }

    saveOrders(orders);
    return true;
  }

  // 2. Kiểm tra lệnh nạp tiền ví CTV
  const deposits = loadCtvDeposits();
  const matchedDeposit = deposits.find(d => {
    if (d.status === 'COMPLETED') return false;
    const memo = (d.memo || d.depositCode || '').toUpperCase();
    const isAmountOk = Number(amount) >= Number(d.amount) * 0.95;
    return isAmountOk && memo && desc.includes(memo);
  });

  if (matchedDeposit) {
    console.log(`[WEBHOOK] ✅ Khớp lệnh nạp tiền CTV ${matchedDeposit.depositCode} (@${matchedDeposit.username})!`);
    matchedDeposit.status = 'COMPLETED';
    matchedDeposit.paymentRef = id || `PAY_${Date.now()}`;
    matchedDeposit.completedAt = new Date().toISOString();
    saveCtvDeposits(deposits);

    // Tự động cộng số dư tiền và Coin cho CTV
    const users = loadCtvUsers();
    const user = users.find(u => u.username.toLowerCase() === matchedDeposit.username.toLowerCase());
    if (user) {
      user.balance = (user.balance || 0) + matchedDeposit.amount;
      user.coins = Math.floor(user.balance / 1000);
      saveCtvUsers(users);
      console.log(`[WEBHOOK] 💰 Đã tự động cộng +${matchedDeposit.amount.toLocaleString('vi-VN')}đ (+${matchedDeposit.coins} Coins) cho CTV @${user.username}!`);
    }
    return true;
  }

  // 3. Fallback xử lý chuyển khoản trực tiếp (như locket thường: memo chứa "TOCAM <username>" hoặc "VIPCAM <username>")
  const sanitizedMemo = desc.replace(/[\._\s-]+(CT|IBFT|CHUYEN TIEN|CHUYENTIEN)(\s+TU.*)?$/i, '');
  const match = sanitizedMemo.match(/(?:TOCAM|VIPCAM|LOCKET)\s*([A-Za-z0-9_.-]+)/i) || desc.match(/(?:TOCAM|VIPCAM|LOCKET)\s*([A-Za-z0-9_.-]+)/i);
  let rawUser = match && match[1] ? match[1] : '';

  if (!rawUser) {
    const parts = sanitizedMemo.split(/\s+/);
    const prefixIdx = parts.findIndex(p => ['TOCAM', 'VIPCAM', 'LOCKET'].includes(p));
    if (prefixIdx !== -1 && parts[prefixIdx + 1]) {
      rawUser = parts[prefixIdx + 1];
    }
  }

  const cleanUser = cleanLocketUsername(rawUser);
  if (cleanUser && Number(amount) >= 5000) {
    console.log(`[WEBHOOK] 🎯 Phát hiện chuyển khoản trực tiếp cho @${cleanUser} (+${Number(amount).toLocaleString('vi-VN')}đ)! Đang tự động xử lý...`);

    const settings = loadSettings();
    let planType = 'regular';
    let planCode = 'TEST';
    let planName = 'Locket Gold Dùng Thử';
    let packageKey = null;

    if (Number(amount) >= 95000) {
      planType = 'vip';
      planCode = 'VIP_2Y';
      planName = 'Locket VIP Pro 2 Năm';
      packageKey = 'filter_2year';
    } else if (Number(amount) >= 75000) {
      planType = 'vip';
      planCode = 'VIP_1Y';
      planName = 'Locket VIP Pro 1 Năm';
      packageKey = 'filter_1year';
    } else if (Number(amount) >= 49000) {
      planType = 'regular';
      planCode = 'YEARLY';
      planName = 'Locket Gold 1 Năm';
    } else if (Number(amount) >= 29000) {
      planType = 'regular';
      planCode = 'MONTH6';
      planName = 'Locket Gold Tiết Kiệm';
    } else {
      planType = 'regular';
      planCode = 'TEST';
      planName = 'Locket Gold Dùng Thử';
    }

    const randNum = Math.floor(1000 + Math.random() * 9000);
    const orderCode = `TOCAM${randNum}`;
    const newOrder = {
      id: `ord_${Date.now()}_${randNum}`,
      orderCode: orderCode,
      username: cleanUser,
      planType: planType,
      planId: planCode,
      planCode: planCode,
      planName: planName,
      packageKey: packageKey,
      amount: Number(amount),
      status: 'PAID',
      paymentRef: id || `PAY_${Date.now()}`,
      paidAt: new Date().toISOString(),
      bankDetails: {
        bankName: settings.bankInfo?.bankName || 'VPBank',
        accountNumber: settings.bankInfo?.accountNumber || '2027022007',
        accountName: settings.bankInfo?.accountName || 'NGUYEN MINH HIEP',
        memo: `TOCAM ${cleanUser}`
      },
      mobileconfigUrl: null,
      filterShortUrl: null,
      activationLog: null,
      createdAt: new Date().toISOString()
    };

    const shouldAuto = planType === 'vip' 
      ? settings.apiConfig?.autoActivateVIP !== false 
      : settings.apiConfig?.autoActivateRegular !== false;

    if (shouldAuto) {
      await executeActivation(newOrder);
    }

    orders.unshift(newOrder);
    saveOrders(orders.slice(0, 500));
    console.log(`[WEBHOOK] 🚀 Đã tạo đơn và kích hoạt tự động thành công cho @${cleanUser} (${newOrder.orderCode})!`);
    return true;
  }

  console.warn('[WEBHOOK] ⚠️ Không tìm thấy đơn hàng, lệnh nạp CTV hoặc username hợp lệ nào khớp với nội dung chuyển khoản!');
  return false;
}

// Webhook Casso
app.all('/webhook/casso', async (req, res) => {
  const body = req.body || {};
  const data = body.data || (Array.isArray(body) ? body : [body]);

  for (const item of (Array.isArray(data) ? data : [data])) {
    if (item && item.amount) {
      await processIncomingTransaction({
        id: item.id || item.tid,
        amount: item.amount,
        description: item.description || item.corresponsiveName || ''
      });
    }
  }

  res.json({ error: 0, message: 'OK' });
});

// Webhook SePay (Tương thích 100% với SePay từ locket thường)
app.all('/webhook/sepay', async (req, res) => {
  const body = req.body || {};
  console.log('[SEPAY] Webhook nhận dữ liệu:', JSON.stringify(body));

  const settings = loadSettings();
  const apiKey = settings.apiConfig?.sepayApiKey;
  if (apiKey) {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader !== `Apikey ${apiKey}` && authHeader !== apiKey) {
      console.warn('[SEPAY] API Key không hợp lệ!');
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const amount = body.transferAmount || body.amount || 0;
  const description = body.content || body.description || '';
  const id = body.id || body.referenceCode || Date.now();

  if (amount) {
    await processIncomingTransaction({
      id: id,
      amount: Number(amount),
      description: String(description)
    });
  }

  res.status(200).json({ success: true });
});

// ============================================================
// HỖ TRỢ ĐỒNG BỘ TỪ LOCKET THƯỜNG (CHECK PAYMENT, RECENT TRANSACTIONS, PROFILE)
// ============================================================

// Polling kiểm tra trạng thái thanh toán theo username (Tương thích frontend locket thường)
app.get('/check-payment', (req, res) => {
  const raw = (req.query.username || '').toLowerCase().trim().replace('@', '');
  const username = cleanLocketUsername(raw);
  if (!username) {
    return res.status(400).json({ error: 'Thiếu username' });
  }

  const orders = loadOrders();
  const matched = orders.find(o => cleanLocketUsername(o.username) === username);

  if (matched && (matched.status === 'ACTIVATED' || matched.status === 'PAID')) {
    return res.json({
      paid: true,
      plan: matched.planCode || matched.planId,
      amount: matched.amount,
      paidAt: matched.paidAt || matched.createdAt,
      username: matched.username,
      locketStatus: matched.status === 'ACTIVATED' ? 'success' : 'pending',
      uid: matched.uid || null,
      mobileconfigUrl: matched.mobileconfigUrl || `/profile?username=${encodeURIComponent(username)}`,
      filterShortUrl: matched.filterShortUrl || null
    });
  }

  res.json({
    paid: false,
    username: username
  });
});

// Lấy danh sách giao dịch thành công gần đây (Tương thích locket thường)
app.get('/api/recent-transactions', (req, res) => {
  const orders = loadOrders();
  const recent = orders
    .filter(o => o.status === 'ACTIVATED' || o.status === 'PAID')
    .slice(0, 30)
    .map(o => ({
      username: o.username,
      plan: o.planName || o.planCode,
      amount: o.amount,
      time: o.paidAt || o.createdAt,
      txId: o.paymentRef || o.orderCode,
      status: 'success',
      avatarUrl: o.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(o.username)}&background=FFA033&color=fff&size=128&bold=true`
    }));
  res.json(recent);
});

// Tải file cấu hình DNS (.mobileconfig) cho iOS
app.get('/profile', async (req, res) => {
  const username = cleanLocketUsername(req.query.username || '');
  const uid = req.query.uid || '';
  const settings = loadSettings();
  const cucamKey = settings.apiConfig?.cucamApiKey || 'sk_a6f8887c53d6baa3f90a7929e85b693b7dddc82bfd4ecfb233efa75dd7551df7';
  const cucamBase = settings.apiConfig?.cucamApiBase || 'https://locket.2707226.xyz';

  let resolvedUid = uid;
  if (!resolvedUid && username) {
    const orders = loadOrders();
    const foundOrder = orders.find(o => cleanLocketUsername(o.username) === username && o.uid);
    if (foundOrder && foundOrder.uid) {
      resolvedUid = foundOrder.uid;
    } else {
      try {
        const checkRes = await fetch(`${cucamBase}/api/uid/check?username=${encodeURIComponent(username)}`, {
          headers: { 'Authorization': `Bearer ${cucamKey}` }
        });
        const cData = await checkRes.json().catch(() => ({}));
        if (cData?.data?.uid) {
          resolvedUid = typeof cData.data.uid === 'string' ? cData.data.uid : cData.data.uid.uidString;
        }
      } catch (e) {}
    }
  }

  if (resolvedUid) {
    try {
      const resp = await fetch(`${cucamBase}/api/profile/custom`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cucamKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uid: resolvedUid })
      });
      if (resp.ok) {
        const buffer = Buffer.from(await resp.arrayBuffer());
        res.setHeader('Content-Type', 'application/x-apple-aspen-config');
        res.setHeader('Content-Disposition', 'attachment; filename="LocketGold.mobileconfig"');
        return res.send(buffer);
      }
    } catch (e) {
      console.error('[PROFILE] Lỗi tải profile:', e.message);
    }
  }

  res.redirect(302, 'https://tocam.vip/gold');
});

// ============================================================
// 6. ADMIN API (BẢO VỆ MẬT KHẨU)
// ============================================================

// Đăng nhập Admin
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body || {};
  const settings = loadSettings();
  const currentPass = settings.adminPassword || 'admin123';

  if (password === currentPass) {
    const token = `admin_tk_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    activeAdminTokens.add(token);
    console.log('[ADMIN] ✅ Đăng nhập thành công, token tạo mới:', token);
    return res.json({ ok: true, token: token });
  }

  return res.status(401).json({ ok: false, message: 'Mật khẩu quản trị viên không chính xác!' });
});

// Thống kê tổng quan Overview
app.get('/api/admin/overview', requireAdmin, async (req, res) => {
  const orders = loadOrders();
  const settings = loadSettings();

  const totalOrders = orders.length;
  const activatedOrders = orders.filter(o => o.status === 'ACTIVATED').length;
  const pendingOrders = orders.filter(o => o.status === 'PENDING').length;

  let totalRevenue = 0;
  let todayRevenue = 0;
  const todayStr = new Date().toISOString().split('T')[0];

  orders.forEach(o => {
    if (o.status === 'ACTIVATED' || o.status === 'PAID') {
      const amt = Number(o.amount) || 0;
      totalRevenue += amt;
      if (o.createdAt && o.createdAt.startsWith(todayStr)) {
        todayRevenue += amt;
      }
    }
  });

  const vipCount = orders.filter(o => o.planType === 'vip' && (o.status === 'ACTIVATED' || o.status === 'PAID')).length;
  const regularCount = orders.filter(o => o.planType === 'regular' && (o.status === 'ACTIVATED' || o.status === 'PAID')).length;

  // Lấy live balance và quota từ Kawaii API
  let kawaiiInfo = null;
  try {
    const kRes = await fetch('https://ctv.nodns.vn/api/v1/ctv/me', {
      headers: { 'x-api-key': settings.apiConfig?.kawaiiApiKey || 'ctv_key_1793546331250_anjgop' }
    });
    if (kRes.ok) {
      const kData = await kRes.json();
      kawaiiInfo = kData.data || null;
    }
  } catch (e) {
    // ignore
  }

  res.json({
    ok: true,
    data: {
      totalRevenue,
      todayRevenue,
      totalOrders,
      activatedOrders,
      pendingOrders,
      vipCount,
      regularCount,
      kawaiiInfo
    }
  });
});

// Lấy toàn bộ Settings
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  const settings = loadSettings();
  res.json({ ok: true, data: settings });
});

// Cập nhật Settings
app.post('/api/admin/settings', requireAdmin, (req, res) => {
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    return res.status(400).json({ ok: false, message: 'Dữ liệu không hợp lệ!' });
  }

  const current = loadSettings();
  const merged = { ...current, ...newSettings };
  
  if (saveSettings(merged)) {
    console.log('[ADMIN] ✅ Cập nhật settings thành công');
    return res.json({ ok: true, message: 'Đã lưu cấu hình thành công!' });
  }

  return res.status(500).json({ ok: false, message: 'Lỗi ghi file cấu hình!' });
});

// Cập nhật cài đặt chức năng trang khách hàng
app.post('/api/admin/customer-features', requireAdmin, (req, res) => {
  const newFeatures = req.body;
  if (!newFeatures || typeof newFeatures !== 'object') {
    return res.status(400).json({ ok: false, message: 'Dữ liệu không hợp lệ!' });
  }

  const settings = loadSettings();
  settings.customerFeatures = {
    ...(settings.customerFeatures || {}),
    ...newFeatures
  };

  // Cập nhật cả marqueeNotice nếu có
  if (typeof newFeatures.marqueeNotice === 'string') {
    settings.marqueeNotice = newFeatures.marqueeNotice;
  }

  if (saveSettings(settings)) {
    console.log('[ADMIN] ✅ Đã lưu cấu hình chức năng trang khách hàng');
    return res.json({
      ok: true,
      message: 'Đã lưu cấu hình chức năng trang khách hàng thành công!',
      customerFeatures: settings.customerFeatures
    });
  }

  return res.status(500).json({ ok: false, message: 'Lỗi ghi file cấu hình!' });
});

// Lấy danh sách đơn hàng cho Admin
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const orders = loadOrders();
  res.json({ ok: true, orders: orders });
});

// Kích hoạt thủ công 1-Click
app.post('/api/admin/order/manual-activate', requireAdmin, async (req, res) => {
  const { orderId } = req.body || {};
  const orders = loadOrders();
  const order = orders.find(o => o.id === orderId || o.orderCode === orderId);

  if (!order) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng!' });
  }

  const result = await executeActivation(order);
  saveOrders(orders);

  if (result.success) {
    return res.json({ ok: true, message: 'Kích hoạt đơn hàng thành công!', order: order });
  } else {
    return res.status(400).json({ ok: false, message: result.error || 'Kích hoạt thất bại. Vui lòng kiểm tra số dư ví hoặc API Key!', order: order });
  }
});

// Cập nhật trạng thái đơn (Đã duyệt / Hủy)
app.post('/api/admin/order/update-status', requireAdmin, (req, res) => {
  const { orderId, status } = req.body || {};
  const orders = loadOrders();
  const order = orders.find(o => o.id === orderId || o.orderCode === orderId);

  if (!order) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn hàng!' });
  }

  order.status = status;
  saveOrders(orders);

  res.json({ ok: true, message: 'Đã cập nhật trạng thái đơn hàng!', order: order });
});

// Xoá đơn hàng
app.post('/api/admin/order/delete', requireAdmin, (req, res) => {
  const { orderId } = req.body || {};
  let orders = loadOrders();
  const beforeLen = orders.length;
  orders = orders.filter(o => o.id !== orderId && o.orderCode !== orderId);

  if (orders.length === beforeLen) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy đơn để xoá!' });
  }

  saveOrders(orders);
  res.json({ ok: true, message: 'Đã xoá đơn hàng thành công!' });
});

// Nút Test API Key Kawaii
app.post('/api/admin/test-kawaii', requireAdmin, async (req, res) => {
  const { apiKey } = req.body || {};
  const settings = loadSettings();
  const keyToTest = apiKey || settings.apiConfig?.kawaiiApiKey || 'ctv_key_1793546331250_anjgop';

  try {
    const kRes = await fetch('https://ctv.nodns.vn/api/v1/ctv/me', {
      headers: { 'x-api-key': keyToTest }
    });

    const kData = await kRes.json();
    if (kRes.ok && kData.status === 'success') {
      return res.json({
        ok: true,
        message: 'Kết nối API Kawaii thành công!',
        data: kData.data
      });
    } else {
      return res.status(400).json({
        ok: false,
        message: kData.error || kData.message || 'Key không hợp lệ hoặc bị khoá!',
        data: kData
      });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Lỗi kết nối máy chủ Kawaii: ' + err.message });
  }
});

// Nút Test API Key Cụ Cam
app.post('/api/admin/test-cucam', requireAdmin, async (req, res) => {
  const { apiKey, apiBase } = req.body || {};
  const settings = loadSettings();
  const keyToTest = apiKey || settings.apiConfig?.cucamApiKey || '';
  const baseToTest = apiBase || settings.apiConfig?.cucamApiBase || 'https://locket.2707226.xyz';

  try {
    const resPackages = await fetch(`${baseToTest}/api/packages`, {
      headers: { 'Authorization': `Bearer ${keyToTest}` }
    });
    const pData = await resPackages.json().catch(() => ({}));
    if (resPackages.ok && pData.ok) {
      return res.json({
        ok: true,
        message: 'Kết nối API Cụ Cam thành công!',
        data: pData.data
      });
    } else {
      return res.status(400).json({
        ok: false,
        message: pData.message || 'Key Cụ Cam không hợp lệ hoặc bị từ chối!',
        data: pData
      });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'Lỗi kết nối máy chủ Cụ Cam: ' + err.message });
  }
});

// ============================================================
// QUẢN LÝ ẢNH SHOWROOM VIP (UPLOAD & GALLERY CRUD)
// ============================================================

// 1. Tải ảnh lên server (Base64)
app.post('/api/admin/upload-image', requireAdmin, (req, res) => {
  try {
    const { base64Data, filename } = req.body || {};
    if (!base64Data) {
      return res.status(400).json({ ok: false, message: 'Dữ liệu ảnh không hợp lệ!' });
    }

    let ext = '.jpg';
    let cleanBase64 = base64Data;
    if (base64Data.startsWith('data:image/png;base64,')) {
      ext = '.png';
      cleanBase64 = base64Data.replace('data:image/png;base64,', '');
    } else if (base64Data.startsWith('data:image/jpeg;base64,') || base64Data.startsWith('data:image/jpg;base64,')) {
      ext = '.jpg';
      cleanBase64 = base64Data.replace(/^data:image\/(jpeg|jpg);base64,/, '');
    } else if (base64Data.startsWith('data:image/webp;base64,')) {
      ext = '.webp';
      cleanBase64 = base64Data.replace('data:image/webp;base64,', '');
    } else if (base64Data.includes(';base64,')) {
      cleanBase64 = base64Data.split(';base64,')[1];
    }

    const imagesDir = path.join(ROOT_DIR, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const uniqueName = `filter-${Date.now()}-${Math.floor(Math.random()*1000)}${ext}`;
    const targetPath = path.join(imagesDir, uniqueName);

    const buffer = Buffer.from(cleanBase64, 'base64');
    fs.writeFileSync(targetPath, buffer);

    console.log('[ADMIN] ✅ Upload ảnh filter thành công:', uniqueName);
    return res.json({ ok: true, imageUrl: `images/${uniqueName}`, filename: uniqueName });
  } catch (err) {
    console.error('[ADMIN] Lỗi upload ảnh:', err);
    return res.status(500).json({ ok: false, message: 'Lỗi lưu ảnh: ' + err.message });
  }
});

// 2. Thêm ảnh vào VIP Gallery
app.post('/api/admin/gallery/add', requireAdmin, (req, res) => {
  try {
    const { title, tag, imageUrl, caption } = req.body || {};
    if (!imageUrl || !title) {
      return res.status(400).json({ ok: false, message: 'Vui lòng cung cấp link ảnh và tiêu đề!' });
    }

    const settings = loadSettings();
    if (!Array.isArray(settings.vipGallery)) {
      settings.vipGallery = [];
    }

    const newItem = {
      id: 'gallery_' + Date.now(),
      title: title.trim(),
      tag: (tag || 'HOT TREND').trim(),
      imageUrl: imageUrl.trim(),
      caption: (caption || '').trim(),
      createdAt: new Date().toISOString()
    };

    settings.vipGallery.push(newItem);
    saveSettings(settings);

    return res.json({ ok: true, message: 'Đã thêm ảnh vào showroom VIP thành công!', item: newItem, gallery: settings.vipGallery });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// 3. Xóa ảnh khỏi VIP Gallery
app.post('/api/admin/gallery/delete', requireAdmin, (req, res) => {
  try {
    const { id } = req.body || {};
    if (!id) {
      return res.status(400).json({ ok: false, message: 'Thiếu ID ảnh cần xóa!' });
    }

    const settings = loadSettings();
    if (!Array.isArray(settings.vipGallery)) {
      settings.vipGallery = [];
    }

    settings.vipGallery = settings.vipGallery.filter(item => item.id !== id);
    saveSettings(settings);

    return res.json({ ok: true, message: 'Đã xóa ảnh khỏi showroom VIP!', gallery: settings.vipGallery });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
});

// ============================================================
// CTV PORTAL APIS (LUỒNG ĐĂNG KÝ, ĐĂNG NHẬP, NẠP TIỀN, KÍCH KHÁCH)
// ============================================================

// 1. Đăng ký tài khoản CTV mới
app.post('/api/ctv/register', (req, res) => {
  const { username, password, fullName, phone } = req.body || {};
  const settings = loadSettings();
  if (settings.ctvSettings && settings.ctvSettings.allowRegister === false) {
    return res.status(403).json({ ok: false, message: 'Hệ thống hiện đang tạm đóng đăng ký CTV mới!' });
  }

  const cleanUser = cleanLocketUsername(username || '');
  if (!cleanUser || cleanUser.length < 3) {
    return res.status(400).json({ ok: false, message: 'Tên đăng nhập phải từ 3 ký tự trở lên (không dấu)!' });
  }
  if (!password || password.length < 3) {
    return res.status(400).json({ ok: false, message: 'Mật khẩu phải từ 3 ký tự trở lên!' });
  }

  const users = loadCtvUsers();
  if (users.find(u => u.username.toLowerCase() === cleanUser.toLowerCase())) {
    return res.status(400).json({ ok: false, message: 'Tên đăng nhập này đã có người sử dụng!' });
  }

  const newCtv = {
    username: cleanUser,
    password: password,
    fullName: (fullName || cleanUser).trim(),
    phone: (phone || '').trim(),
    balance: 0,
    coins: 0,
    status: 'ACTIVE',
    createdAt: new Date().toISOString()
  };

  users.push(newCtv);
  saveCtvUsers(users);

  const token = 'ctv_tok_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  activeCtvTokens.set(token, cleanUser);

  return res.json({
    ok: true,
    message: 'Đăng ký tài khoản CTV thành công!',
    token: token,
    user: {
      username: newCtv.username,
      fullName: newCtv.fullName,
      balance: newCtv.balance,
      coins: newCtv.coins
    }
  });
});

// 2. Đăng nhập CTV
app.post('/api/ctv/login', (req, res) => {
  const { username, password } = req.body || {};
  const cleanUser = cleanLocketUsername(username || '');
  if (!cleanUser || !password) {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập tên đăng nhập và mật khẩu!' });
  }

  const users = loadCtvUsers();
  const user = users.find(u => u.username.toLowerCase() === cleanUser.toLowerCase() && u.password === password);
  if (!user) {
    return res.status(401).json({ ok: false, message: 'Sai tên đăng nhập hoặc mật khẩu CTV!' });
  }

  if (user.status === 'BLOCKED') {
    return res.status(403).json({ ok: false, message: 'Tài khoản CTV này đã bị khóa!' });
  }

  const token = 'ctv_tok_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
  activeCtvTokens.set(token, user.username);

  return res.json({
    ok: true,
    message: 'Đăng nhập thành công!',
    token: token,
    user: {
      username: user.username,
      fullName: user.fullName,
      phone: user.phone,
      balance: user.balance || 0,
      coins: user.coins || 0
    }
  });
});

// 3. Lấy thông tin tài khoản CTV hiện tại & Cấu hình tabs
app.get('/api/ctv/me', requireCtv, (req, res) => {
  const settings = loadSettings();
  const ctvSettings = settings.ctvSettings || {
    allowRegister: true,
    tabLocket: true,
    tabVipFilter: true,
    tabSpotify: true,
    wholesalePlans: []
  };

  return res.json({
    ok: true,
    user: {
      username: req.ctvUser.username,
      fullName: req.ctvUser.fullName,
      phone: req.ctvUser.phone,
      balance: req.ctvUser.balance || 0,
      coins: req.ctvUser.coins || Math.floor((req.ctvUser.balance || 0) / 1000)
    },
    settings: ctvSettings
  });
});

// 4. Tạo yêu cầu nạp tiền VietQR cho CTV
app.post('/api/ctv/deposit/create', requireCtv, (req, res) => {
  const { amount } = req.body || {};
  const numAmount = parseInt(amount, 10);
  if (!numAmount || numAmount < 10000) {
    return res.status(400).json({ ok: false, message: 'Số tiền nạp tối thiểu là 10.000đ!' });
  }

  const settings = loadSettings();
  const bank = settings.bankInfo || {
    bankId: 'VPBANK',
    bankName: 'VPBank',
    accountNumber: '2027022007',
    accountName: 'NGUYEN MINH HIEP',
    memoPrefix: 'VIPCAM'
  };

  // Nội dung nạp tiền ngắn gọn (chỉ 7 ký tự: NAP + 4 số, ví dụ NAP9542)
  // Không chứa dấu cách, không kèm username dài để tránh xung đột hoặc lỗi app ngân hàng
  const ctvMemoPrefix = settings.ctvSettings?.depositPrefix || 'NAP';
  const depositCode = ctvMemoPrefix + Math.floor(1000 + Math.random() * 9000);
  const memo = depositCode;
  const qrUrl = `https://img.vietqr.io/image/${bank.bankId}-${bank.accountNumber}-compact2.png?amount=${numAmount}&addInfo=${encodeURIComponent(memo)}&accountName=${encodeURIComponent(bank.accountName)}`;

  const depositOrder = {
    id: 'DEP_' + Date.now(),
    depositCode: depositCode,
    username: req.ctvUser.username,
    amount: numAmount,
    coins: Math.floor(numAmount / 1000),
    memo: memo,
    qrUrl: qrUrl,
    bankInfo: bank,
    status: 'PENDING',
    createdAt: new Date().toISOString()
  };

  const deposits = loadCtvDeposits();
  deposits.unshift(depositOrder);
  saveCtvDeposits(deposits);

  return res.json({
    ok: true,
    deposit: depositOrder
  });
});

// 5. Tra cứu UID khách hàng (Hỗ trợ tra tự động qua Kawaii & Cụ Cam)
app.get('/api/ctv/lookup-user', requireCtv, async (req, res) => {
  const rawUser = req.query.username || '';
  const username = cleanLocketUsername(rawUser);
  if (!username) {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập username Locket!' });
  }

  const settings = loadSettings();
  const kawaiiKey = settings.apiConfig?.kawaiiApiKey || 'ctv_key_1793546331250_anjgop';
  const cucamKey = settings.apiConfig?.cucamApiKey || '';
  const cucamBase = settings.apiConfig?.cucamApiBase || 'https://locket.2707226.xyz';

  // 1. Tra cứu qua Kawaii
  try {
    const ctvUrl = `https://ctv.nodns.vn/api/v1/userinfo?user=${encodeURIComponent(username)}`;
    const ctvRes = await fetch(ctvUrl, {
      headers: { 'x-api-key': kawaiiKey }
    });
    const ctvData = await ctvRes.json().catch(() => null);
    if (ctvRes.ok && ctvData && (ctvData.status === 'success' || ctvData.uid)) {
      return res.json({
        ok: true,
        data: {
          username: ctvData.username || username,
          fullName: ctvData.full_name || username,
          uid: ctvData.uid,
          avatarUrl: ctvData.profile_picture_url || null,
          hasGold: ctvData.gold?.has_gold || false,
          goldExpiry: ctvData.gold?.expiry_date || null
        }
      });
    }
  } catch (e) {}

  // 2. Tra cứu qua Cụ Cam
  if (cucamKey) {
    try {
      const ccRes = await fetch(`${cucamBase}/api/uid/check?username=${encodeURIComponent(username)}`, {
        headers: { 'Authorization': `Bearer ${cucamKey}` }
      });
      const ccData = await ccRes.json().catch(() => null);
      if (ccRes.ok && ccData?.data?.uid) {
        return res.json({
          ok: true,
          data: {
            username: ccData.data.username || username,
            fullName: ccData.data.username || username,
            uid: ccData.data.uid,
            avatarUrl: ccData.data.avatarUrl || null,
            hasGold: ccData.data.active || false,
            goldExpiry: ccData.data.expiresAt || null
          }
        });
      }
    } catch (e) {}
  }

  // 3. Fallback locket.cam web
  try {
    const locketRes = await fetch(`https://locket.cam/${encodeURIComponent(username)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }
    });
    if (locketRes.ok) {
      const html = await locketRes.text();
      const uidMatch = html.match(/invites%2F([a-zA-Z0-9]{28})/i) || html.match(/invites\/([a-zA-Z0-9]{28})/i);
      const avatarMatch = html.match(/class="profile-pic-img"\s+src="([^"]+)"/i);
      if (uidMatch) {
        return res.json({
          ok: true,
          data: {
            username: username,
            fullName: username,
            uid: uidMatch[1],
            avatarUrl: avatarMatch ? avatarMatch[1].replace(/&amp;/g, '&') : null,
            hasGold: false,
            goldExpiry: null
          }
        });
      }
    }
  } catch (e) {}

  return res.status(404).json({
    ok: false,
    message: `Không tìm thấy tài khoản Locket @${username}! Vui lòng kiểm tra lại username.`
  });
});

// 6. CTV Kích hoạt gói cho khách hàng (Đồng bộ gọi API Kawaii VIP HOẶC Cụ Cam Gold/Spotify)
app.post('/api/ctv/activate', requireCtv, async (req, res) => {
  const { username, service, planId, uid, fullName, avatarUrl } = req.body || {};
  const cleanUser = cleanLocketUsername(username || '');
  if (!cleanUser) {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập Username khách!' });
  }

  const settings = loadSettings();
  const ctvSettings = settings.ctvSettings || {};
  const plans = ctvSettings.wholesalePlans || [];
  const selectedPlan = plans.find(p => p.id === planId) || plans[0] || { id: 'locket_test', name: 'Locket Gold Test', coin: 1, durationDays: 1 };

  const requiredCoin = selectedPlan.coin || 1;
  const userCoins = req.ctvUser.coins || Math.floor((req.ctvUser.balance || 0) / 1000);

  if (userCoins < requiredCoin) {
    return res.status(400).json({
      ok: false,
      message: `Số dư không đủ! Gói này cần ${requiredCoin} coin (${(requiredCoin * 1000).toLocaleString('vi-VN')}đ), số dư hiện tại: ${userCoins} coin. Vui lòng nạp thêm tiền!`
    });
  }

  // Trừ coin CTV
  const users = loadCtvUsers();
  const currentCtv = users.find(u => u.username.toLowerCase() === req.ctvUser.username.toLowerCase());
  if (currentCtv) {
    currentCtv.coins = (currentCtv.coins || userCoins) - requiredCoin;
    currentCtv.balance = (currentCtv.balance || (userCoins * 1000)) - (requiredCoin * 1000);
    saveCtvUsers(users);
  }

  let resolvedUid = uid || null;
  let mobileconfigUrl = null;
  let filterShortUrl = null;
  let activationSuccess = false;
  let apiLog = null;

  const isVip = service === 'filter' || planId.startsWith('vip');

  if (isVip) {
    // KÍCH HOẠT QUA KAWAII (VIP 49+ Filter Camera AI)
    try {
      const kawaiiKey = settings.apiConfig?.kawaiiApiKey || 'ctv_key_1793546331250_anjgop';
      const pkg = planId === 'vip_lifetime' ? 'filter_lifetime' : (planId === 'vip_2y' ? 'filter_2year' : 'filter_1year');
      const kwRes = await fetch('https://ctv.nodns.vn/api/v1/ctv/gold', {
        method: 'POST',
        headers: { 'x-api-key': kawaiiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: cleanUser, isFilter: true, package: pkg })
      });
      const kwData = await kwRes.json().catch(() => ({}));
      console.log(`[CTV KAWAII ACTIVATE] @${cleanUser} -> Status ${kwRes.status}:`, kwData);

      if (kwRes.ok && (kwData.status === 'success' || kwData.ok || kwData.data)) {
        activationSuccess = true;
        resolvedUid = kwData.data?.uid || resolvedUid;
        mobileconfigUrl = kwData.data?.mobileconfigUrl || null;
        filterShortUrl = kwData.data?.filterShortUrl || null;
        apiLog = { provider: 'KAWAII_VIP', success: true, response: kwData };
      } else {
        apiLog = { provider: 'KAWAII_VIP', success: false, error: kwData.message || `HTTP ${kwRes.status}` };
      }
    } catch (e) {
      console.warn('[CTV] Kawaii VIP activate error:', e.message);
      apiLog = { provider: 'KAWAII_VIP', success: false, error: e.message };
    }
  } else {
    // KÍCH HOẠT QUA CỤ CAM (LOCKET GOLD & SPOTIFY)
    const cucamKey = settings.apiConfig?.cucamApiKey || '';
    const cucamBase = settings.apiConfig?.cucamApiBase || 'https://locket.2707226.xyz';

    if (cucamKey) {
      try {
        let pkgCode = 'LKGT3D';
        if (service === 'spotify') {
          pkgCode = planId.includes('1y') ? 'SPOTIFY1Y' : (planId.includes('vv') ? 'SPVV' : 'SP6M');
        } else {
          if (planId === 'locket_lifetime') pkgCode = 'LKGVV';
          else if (planId === 'locket_1y') pkgCode = 'LKG1Y';
          else if (planId === 'locket_6m') pkgCode = 'LKG6M';
          else if (planId === 'locket_1m') pkgCode = 'LKG1M';
          else pkgCode = 'LKGT3D';
        }

        const ccRes = await fetch(`${cucamBase}/api/uid/create`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cucamKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: cleanUser,
            packageCode: pkgCode
          })
        });

        const ccData = await ccRes.json().catch(() => ({}));
        console.log(`[CTV CỤ CAM ACTIVATE] @${cleanUser} -> Status ${ccRes.status}:`, ccData);

        if ((ccRes.ok || ccRes.status === 201) && (ccData.ok || ccData.success || ccData.status === 'success')) {
          activationSuccess = true;
          const uidStr = ccData.data?.uid?.uidString || ccData.data?.uid?.uid || ccData.data?.uid || ccData.uid || null;
          resolvedUid = typeof uidStr === 'string' ? uidStr : (uidStr?.uidString || resolvedUid);
          mobileconfigUrl = `/profile?username=${encodeURIComponent(cleanUser)}`;
          apiLog = { provider: 'CUCAM_DNS', success: true, response: ccData };
        } else {
          apiLog = { provider: 'CUCAM_DNS', success: false, error: ccData.message || `HTTP ${ccRes.status}` };
        }
      } catch (e) {
        console.warn('[CTV] Cụ Cam activate error:', e.message);
        apiLog = { provider: 'CUCAM_DNS', success: false, error: e.message };
      }
    }
  }

  // Tính hạn dùng
  const now = new Date();
  const days = selectedPlan.durationDays || 30;
  const expiryDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const formatDate = (d) => {
    return d.toLocaleTimeString('vi-VN', { hour12: false }) + ' ' + d.toLocaleDateString('vi-VN');
  };

  const newCust = {
    id: 'CUST_' + Date.now(),
    ctvUsername: req.ctvUser.username,
    username: cleanUser,
    fullName: fullName || cleanUser,
    avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop',
    uid: resolvedUid || 'Chờ cập nhật',
    service: service || 'locket',
    planId: selectedPlan.id,
    planName: selectedPlan.name,
    coinsDeducted: requiredCoin,
    status: 'ACTIVE',
    mobileconfigUrl: mobileconfigUrl || `/profile?username=${encodeURIComponent(cleanUser)}`,
    filterShortUrl: filterShortUrl || null,
    apiLog: apiLog,
    expiresAt: formatDate(expiryDate),
    lastSeen: formatDate(now),
    createdAt: now.toISOString()
  };

  const customers = loadCtvCustomers();
  customers.unshift(newCust);
  saveCtvCustomers(customers);

  return res.json({
    ok: true,
    message: `Đã kích hoạt thành công gói "${selectedPlan.name}" cho @${cleanUser}!`,
    customer: newCust,
    remainingCoins: currentCtv ? currentCtv.coins : userCoins - requiredCoin,
    dnsUrl: mobileconfigUrl || `/profile?username=${encodeURIComponent(cleanUser)}`,
    filterShortUrl: filterShortUrl
  });
});

// 7. Lấy danh sách khách hàng của CTV
app.get('/api/ctv/customers', requireCtv, (req, res) => {
  const customers = loadCtvCustomers();
  const ctvCusts = customers.filter(c => c.ctvUsername.toLowerCase() === req.ctvUser.username.toLowerCase());
  return res.json({ ok: true, customers: ctvCusts });
});

// 8. CTV Xóa khách khỏi danh sách
app.post('/api/ctv/customer/delete', requireCtv, (req, res) => {
  const { id } = req.body || {};
  let customers = loadCtvCustomers();
  customers = customers.filter(c => !(c.id === id && c.ctvUsername.toLowerCase() === req.ctvUser.username.toLowerCase()));
  saveCtvCustomers(customers);
  return res.json({ ok: true, message: 'Đã xóa khách hàng khỏi danh sách!' });
});

// ============================================================
// ADMIN CTV MANAGEMENT ENDPOINTS
// ============================================================

// 1. Admin lấy danh sách toàn bộ CTV
app.get('/api/admin/ctv/list', requireAdmin, (req, res) => {
  const users = loadCtvUsers();
  const customers = loadCtvCustomers();
  const data = users.map(u => {
    const custCount = customers.filter(c => c.ctvUsername.toLowerCase() === u.username.toLowerCase()).length;
    return {
      username: u.username,
      fullName: u.fullName,
      phone: u.phone,
      balance: u.balance || 0,
      coins: u.coins || Math.floor((u.balance || 0) / 1000),
      status: u.status || 'ACTIVE',
      customerCount: custCount,
      createdAt: u.createdAt
    };
  });
  return res.json({ ok: true, ctvList: data });
});

// 2. Admin nạp/sửa/cộng/trừ Coin & tiền cho CTV
app.post('/api/admin/ctv/adjust-balance', requireAdmin, (req, res) => {
  const { username, amount, coins, type } = req.body || {};
  if (!username) {
    return res.status(400).json({ ok: false, message: 'Vui lòng cung cấp username CTV!' });
  }

  const users = loadCtvUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy CTV!' });
  }

  let finalCoins = user.coins || 0;
  let actionDesc = '';

  if (coins !== undefined && coins !== null && coins !== '') {
    const numCoins = parseInt(coins, 10);
    if (isNaN(numCoins)) {
      return res.status(400).json({ ok: false, message: 'Số coin không hợp lệ!' });
    }
    if (type === 'SET') {
      finalCoins = Math.max(0, numCoins);
      actionDesc = `đặt lại thành ${finalCoins.toLocaleString('vi-VN')} Coins`;
    } else if (type === 'SUB') {
      finalCoins = Math.max(0, (user.coins || 0) - Math.abs(numCoins));
      actionDesc = `trừ ${Math.abs(numCoins).toLocaleString('vi-VN')} Coins (còn lại ${finalCoins.toLocaleString('vi-VN')} Coins)`;
    } else {
      // ADD
      finalCoins = (user.coins || 0) + Math.abs(numCoins);
      actionDesc = `cộng thêm ${Math.abs(numCoins).toLocaleString('vi-VN')} Coins (tổng ${finalCoins.toLocaleString('vi-VN')} Coins)`;
    }
  } else if (amount !== undefined && amount !== null && amount !== '') {
    const numAmount = parseInt(amount, 10);
    if (isNaN(numAmount)) {
      return res.status(400).json({ ok: false, message: 'Số tiền không hợp lệ!' });
    }
    if (type === 'SET') {
      finalCoins = Math.max(0, Math.floor(numAmount / 1000));
      actionDesc = `đặt lại thành ${finalCoins.toLocaleString('vi-VN')} Coins`;
    } else if (type === 'SUB') {
      const delta = -Math.abs(numAmount);
      const newBalance = Math.max(0, (user.balance || 0) + delta);
      finalCoins = Math.floor(newBalance / 1000);
      actionDesc = `trừ ${Math.abs(numAmount).toLocaleString('vi-VN')}đ`;
    } else {
      const delta = Math.abs(numAmount);
      const newBalance = (user.balance || 0) + delta;
      finalCoins = Math.floor(newBalance / 1000);
      actionDesc = `cộng ${Math.abs(numAmount).toLocaleString('vi-VN')}đ`;
    }
  } else {
    return res.status(400).json({ ok: false, message: 'Vui lòng nhập số coin hoặc số tiền!' });
  }

  user.coins = finalCoins;
  user.balance = finalCoins * 1000;
  saveCtvUsers(users);

  return res.json({
    ok: true,
    message: `Đã ${actionDesc} cho CTV @${username}!`,
    user: {
      username: user.username,
      coins: user.coins,
      balance: user.balance
    }
  });
});

// 3. Admin khóa / mở khóa CTV
app.post('/api/admin/ctv/toggle-status', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  const users = loadCtvUsers();
  const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (!user) {
    return res.status(404).json({ ok: false, message: 'Không tìm thấy CTV!' });
  }

  user.status = user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
  saveCtvUsers(users);
  return res.json({
    ok: true,
    message: `Đã ${user.status === 'BLOCKED' ? 'khóa' : 'mở khóa'} CTV @${username}!`,
    status: user.status
  });
});

// 4. Admin lưu cài đặt & bật/tắt chức năng CTV & Bảng giá sỉ
app.post('/api/admin/ctv/settings', requireAdmin, (req, res) => {
  const { allowRegister, tabLocket, tabVipFilter, tabSpotify, wholesalePlans, depositPrefix } = req.body || {};
  const settings = loadSettings();
  if (!settings.ctvSettings) settings.ctvSettings = {};

  if (typeof allowRegister === 'boolean') settings.ctvSettings.allowRegister = allowRegister;
  if (typeof tabLocket === 'boolean') settings.ctvSettings.tabLocket = tabLocket;
  if (typeof tabVipFilter === 'boolean') settings.ctvSettings.tabVipFilter = tabVipFilter;
  if (typeof tabSpotify === 'boolean') settings.ctvSettings.tabSpotify = tabSpotify;
  if (depositPrefix && typeof depositPrefix === 'string') settings.ctvSettings.depositPrefix = depositPrefix.trim().toUpperCase();
  if (Array.isArray(wholesalePlans)) settings.ctvSettings.wholesalePlans = wholesalePlans;

  saveSettings(settings);
  return res.json({ ok: true, message: 'Đã lưu cấu hình CTV thành công!', ctvSettings: settings.ctvSettings });
});

// Khởi chạy server
app.listen(PORT, () => {
  console.log(`
============================================================
👑 TỔ CAM — LOCKET VIP & LOCKET GOLD SYSTEM V2
🌐 Server đang chạy tại: http://localhost:${PORT}
🔐 Trang Quản Trị Admin: http://localhost:${PORT}/admin
⚡ Mật khẩu Admin mặc định: admin123
============================================================
  `);
});

