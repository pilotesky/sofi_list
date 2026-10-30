/**
 * 系统要求检测脚本（重写版）
 *
 * 功能：
 * - 精确检测访客操作系统及版本（Windows 7/8/8.1/10/11、macOS、Linux 等）
 * - 对比各软件最低系统要求，在「系统要求」列显示兼容性徽章
 * - Win10/Win11 通过 User-Agent Client Hints API 精确区分
 *   （需 <meta http-equiv="Accept-CH"> 标签授权，已在 single.html 中配置）
 * - 页面顶部显示系统信息摘要
 *
 * 技术说明：
 * - Windows 10 与 Windows 11 的 UA 均报告 "Windows NT 10.0"，无法通过 UA 区分
 * - User-Agent Client Hints API 的 platformVersion 格式为 "Major.Minor.Build"
 *   Windows 11 的 Major >= 13，Windows 10 的 Major 为 1~10
 * - Firefox 不支持 userAgentData API，无法精确区分 Win10/Win11，显示中性名称
 */
(function () {
  'use strict';

  // ========== 1. 软件系统要求配置 ==========
  var SOFTWARE_REQUIREMENTS = [
    // ---- 远程软件 ----
    { name: '向日葵',             minVersion: 7,  note: '' },
    { name: 'Todesk',             minVersion: 7,  note: '' },

    // ---- 沟通软件 ----
    { name: '微信',               minVersion: 7,  note: '' },
    { name: '企业微信',           minVersion: 7,  note: '' },
    { name: 'TIM',                minVersion: 7,  note: '' },
    { name: '钉钉',               minVersion: 7,  note: '' },

    // ---- 浏览器 ----
    { name: 'Chrome',             minVersion: 10, note: '' },
    { name: '360 安全浏览器',     minVersion: 7,  note: '' },
    { name: '360 极速浏览器',     minVersion: 7,  note: '32位版对老 XP/7 兼容性更好、广告更少' },

    // ---- 音乐播放器 ----
    { name: '酷狗音乐',           minVersion: 7,  note: '' },
    { name: 'QQ 音乐',            minVersion: 7,  note: '' },
    { name: '网易云音乐',         minVersion: 7,  note: '' },
    { name: '汽水音乐',           minVersion: 10, note: 'Windows 10 及以上' },

    // ---- 视频播放器 ----
    { name: '爱奇艺万能播放器',   minVersion: 7,  note: '' },
    { name: 'PotPlayer',          minVersion: 7,  note: '' },
    { name: 'VLC',                minVersion: 7,  note: '' },

    // ---- Office ----
    { name: 'WPS Office',         minVersion: 7,  note: '' },
    { name: 'Office Tool Plus',   minVersion: 7,  note: '' },

    // ---- 压缩软件 ----
    { name: '360 Zip',            minVersion: 7,  note: '' },
    { name: '7-Zip',              minVersion: 7,  note: '免费、无广告' },

    // ---- PDF 阅读器 ----
    { name: '福昕 PDF 阅读器',   minVersion: 7,  note: '' },

    // ---- 应用商场 ----
    { name: '火绒应用商店',       minVersion: 7,  note: '' },
    { name: '联想应用商店',       minVersion: 10, note: 'Windows 10 及以上' },
    { name: 'HP 应用商店',        minVersion: 10, note: 'Windows 10 及以上' }
  ];

  // ========== 2. 检测当前系统 ==========
  var ua = navigator.userAgent;

  var currentOS = {
    platform: '',      // 'Windows', 'macOS', 'Linux', 'Android', 'iOS', 'Unknown'
    version: null,     // 数字版本号：7, 8, 8.1, 10, 11
    name: '',          // 完整名称：'Windows 11', 'macOS 14.5', 'Linux' 等
    isWindows: false,
    detected: false    // 是否通过 Client Hints 精确检测
  };

  /**
   * Windows NT 版本号 → Windows 版本映射
   * 用于从 UA 字符串初步识别 Windows 大版本
   */
  var NT_VERSION_MAP = {
    'Windows NT 10.0': { version: 10,   name: 'Windows 10' },
    'Windows NT 6.3':  { version: 8.1,  name: 'Windows 8.1' },
    'Windows NT 6.2':  { version: 8,    name: 'Windows 8' },
    'Windows NT 6.1':  { version: 7,    name: 'Windows 7' },
    'Windows NT 6.0':  { version: 6,    name: 'Windows Vista' },
    'Windows NT 5.2':  { version: 5.2,  name: 'Windows XP x64' },
    'Windows NT 5.1':  { version: 5.1,  name: 'Windows XP' }
  };

  /**
   * 通过 User-Agent 字符串初步识别操作系统
   * 按优先级依次检测：Windows → macOS → Linux → 移动端 → 未知
   */
  function detectOSFromUA() {
    // ---- Windows ----
    for (var token in NT_VERSION_MAP) {
      if (NT_VERSION_MAP.hasOwnProperty(token) && ua.indexOf(token) !== -1) {
        currentOS.platform = 'Windows';
        currentOS.isWindows = true;
        currentOS.version = NT_VERSION_MAP[token].version;
        currentOS.name = NT_VERSION_MAP[token].name;
        return;
      }
    }

    // ---- macOS ----
    var macMatch = ua.match(/Mac OS X\s+([\d_]+)/);
    if (macMatch) {
      currentOS.platform = 'macOS';
      var macVer = macMatch[1].replace(/_/g, '.');
      currentOS.name = 'macOS ' + macVer;
      return;
    }

    // ---- Linux ----
    if (/Linux|X11/.test(ua)) {
      currentOS.platform = 'Linux';
      currentOS.name = 'Linux';
      return;
    }

    // ---- Android ----
    if (/Android/.test(ua)) {
      currentOS.platform = 'Android';
      currentOS.name = 'Android';
      return;
    }

    // ---- iOS ----
    if (/iPhone|iPad|iPod/.test(ua)) {
      currentOS.platform = 'iOS';
      currentOS.name = 'iOS';
      return;
    }

    // ---- 兜底 ----
    currentOS.platform = 'Unknown';
    currentOS.name = '未知系统';
  }

  /**
   * 精确区分 Windows 10 和 Windows 11
   *
   * 两者 UA 均报告 "Windows NT 10.0"，需通过 Client Hints API 区分：
   * - platformVersion 格式: "Major.Minor.Build"（如 "15.0.0", "10.0.0"）
   * - Major >= 13 → Windows 11
   * - Major 1~10  → Windows 10
   * - Major 0     → 模糊值，保持中性名称 "Windows 10/11"
   *
   * 检测策略（按优先级）：
   * 1. User-Agent Client Hints API — navigator.userAgentData.getHighEntropyValues
   * 2. UA 字符串直接包含 "Windows 11"（极少数浏览器支持）
   * 3. 保留中性名称 "Windows 10/11"
   */
  function refineWindowsVersion() {
    return new Promise(function (resolve) {
      // 非 Windows 或非 NT 10.0，无需区分
      if (!currentOS.isWindows || currentOS.version !== 10) {
        resolve();
        return;
      }

      // 默认使用中性名称，待精确区分后覆盖
      currentOS.name = 'Windows 10/11';

      // ---- 策略 1: User-Agent Client Hints API ----
      if (navigator.userAgentData && typeof navigator.userAgentData.getHighEntropyValues === 'function') {
        navigator.userAgentData.getHighEntropyValues(['platformVersion'])
          .then(function (data) {
            parsePlatformVersion(data.platformVersion);
            console.log('[system-check] Client Hints platformVersion:', data.platformVersion, '→', currentOS.name);
            resolve();
          })
          .catch(function (err) {
            console.warn('[system-check] getHighEntropyValues 失败:', err.message || err);
            resolve();
          });
        return;
      }

      // ---- 策略 2: UA 字符串兜底 ----
      if (/Windows\s*11/i.test(ua)) {
        currentOS.name = 'Windows 11';
        currentOS.version = 11;
        currentOS.detected = true;
      }

      resolve();
    });
  }

  /**
   * 从 platformVersion 解析 Windows 精确版本
   *
   * platformVersion 格式: "Major.Minor.Build"（如 "15.0.0", "10.0.0"）
   * - Major >= 13 → Windows 11（version 设为 11）
   * - Major 1~10  → Windows 10（version 保持 10）
   * - Major 0     → 模糊值，保持中性名称 "Windows 10/11"
   */
  function parsePlatformVersion(platformVersion) {
    if (!platformVersion || typeof platformVersion !== 'string') {
      return;
    }

    var parts = platformVersion.split('.');
    var major = parseInt(parts[0], 10);

    if (isNaN(major)) {
      return;
    }

    if (major >= 13) {
      currentOS.name = 'Windows 11';
      currentOS.version = 11;
      currentOS.detected = true;
    } else if (major >= 1) {
      currentOS.name = 'Windows 10';
      currentOS.detected = true;
    }
    // major === 0 → 模糊值，保持中性名称 "Windows 10/11"
  }

  // ========== 3. 工具函数 ==========

  /**
   * 版本号比较：current >= required ?
   * @returns true/false，或 null（当前版本未知时）
   */
  function isVersionOK(current, required) {
    if (current === null || current === undefined) return null;
    return current >= required;
  }

  /**
   * 将版本号转为简短显示文字
   */
  function versionLabel(ver) {
    var labels = {
      5.1: 'WinXP',
      5.2: 'WinXP x64',
      6:   'Vista',
      7:   'Win7',
      8:   'Win8',
      8.1: 'Win8.1',
      10:  'Win10',
      11:  'Win11'
    };
    return labels[ver] || ('Win' + ver);
  }

  /**
   * 创建徽章元素
   * @param {string} text  - 徽章文字
   * @param {string} type  - ok | fail | warn | unknown
   */
  function createBadge(text, type) {
    var span = document.createElement('span');
    span.style.cssText = [
      'display: inline-block',
      'padding: 2px 8px',
      'border-radius: 4px',
      'font-size: 12px',
      'font-weight: 500',
      'white-space: nowrap',
      'vertical-align: middle'
    ].join(';');

    var colors = {
      ok:      { bg: '#f6ffed', color: '#389e0d', border: '#b7eb8f' },
      fail:    { bg: '#fff2f0', color: '#cf1322', border: '#ffa39e' },
      warn:    { bg: '#fffbe6', color: '#d48806', border: '#ffe58f' },
      unknown: { bg: '#f5f5f5', color: '#8c8c8c', border: '#d9d9d9' }
    };

    var c = colors[type] || colors.unknown;
    span.style.background = c.bg;
    span.style.color = c.color;
    span.style.border = '1px solid ' + c.border;
    span.textContent = text;
    return span;
  }

  /**
   * 查找软件名称对应的系统要求
   * 去除括号后进行模糊匹配
   */
  function findRequirement(softwareName) {
    var clean = softwareName.replace(/[（(].*?[)）]/g, '').trim();
    for (var i = 0; i < SOFTWARE_REQUIREMENTS.length; i++) {
      var req = SOFTWARE_REQUIREMENTS[i];
      if (clean.indexOf(req.name) !== -1 || req.name.indexOf(clean) !== -1) {
        return req;
      }
    }
    return null;
  }

  // ========== 4. 页面更新 ==========

  function updatePage() {
    var tables = document.querySelectorAll('.container table');
    var checkedCount = 0;
    var okCount = 0;
    var failCount = 0;

    tables.forEach(function (table) {
      var rows = table.querySelectorAll('tbody tr');
      rows.forEach(function (row) {
        var cells = row.querySelectorAll('td');
        if (cells.length < 4) return;

        var nameCell = cells[0];
        var reqCell  = cells[2];
        var softwareName = nameCell.textContent.trim();

        var req = findRequirement(softwareName);
        if (!req) return;

        // 清空「系统要求」列
        reqCell.textContent = '';
        reqCell.style.whiteSpace = 'nowrap';

        checkedCount++;

        var reqLabel = versionLabel(req.minVersion) + '+';
        var badge = null;

        if (!currentOS.isWindows) {
          // 非 Windows 系统
          badge = createBadge(reqLabel + ' · 非 Win', 'warn');
        } else {
          var ok = isVersionOK(currentOS.version, req.minVersion);
          if (ok === true) {
            badge = createBadge('✅ ' + reqLabel, 'ok');
            okCount++;
          } else if (ok === false) {
            badge = createBadge('❌ 需 ' + reqLabel, 'fail');
            failCount++;
          } else {
            badge = createBadge(reqLabel + ' · 未知', 'unknown');
          }
        }

        reqCell.appendChild(badge);
      });
    });

    // ========== 5. 页面顶部系统信息摘要 ==========
    var container = document.querySelector('.container');
    if (container && checkedCount > 0) {
      // 移除旧摘要（避免重复插入）
      var oldSummary = container.querySelector('.system-check-summary');
      if (oldSummary) {
        oldSummary.remove();
      }

      var summary = document.createElement('div');
      summary.className = 'system-check-summary';
      summary.style.cssText = [
        'margin: 0 auto 24px auto',
        'padding: 16px 20px',
        'border-radius: 8px',
        'font-size: 14px',
        'line-height: 1.8',
        'max-width: 500px',
        'text-align: center'
      ].join(';');

      var sysInfo = '🖥 当前系统：<strong>' + (currentOS.name || '未知') + '</strong>';
      var statusLine = '';

      if (currentOS.isWindows) {
        if (failCount === 0) {
          statusLine = '<br>✅ 所有 <strong>' + checkedCount + '</strong> 款软件均兼容当前系统';
          summary.style.background = '#f6ffed';
          summary.style.border = '1px solid #b7eb8f';
        } else {
          statusLine = '<br>⚠️ <strong>' + okCount + '</strong> 款可用，<strong>' + failCount + '</strong> 款不兼容当前系统';
          summary.style.background = '#fffbe6';
          summary.style.border = '1px solid #ffe58f';
        }
      } else {
        statusLine = '<br>ℹ️ 共 <strong>' + checkedCount + '</strong> 款 Windows 软件，请确认对应系统的版本';
        summary.style.background = '#f5f5f5';
        summary.style.border = '1px solid #d9d9d9';
      }

      summary.innerHTML = sysInfo + statusLine;

      var h1 = container.querySelector('h1');
      if (h1) {
        h1.insertAdjacentElement('afterend', summary);
      } else {
        container.insertBefore(summary, container.firstChild);
      }
    }

    // ========== 6. 控制台调试输出 ==========
    console.log(
      '%c🔍 系统要求检测完成',
      'font-weight:bold; color:#1677ff;'
    );
    console.log('  系统:', currentOS.name || '未知');
    console.log('  版本:', currentOS.version !== null ? currentOS.version : 'N/A');
    console.log('  精确检测:', currentOS.detected ? '✅' : '❌');
    console.log('  已检测:', checkedCount, '款');
    console.log('  可用:', okCount, '款');
    console.log('  不兼容:', failCount, '款');
  }

  // ========== 7. 启动 ==========
  detectOSFromUA();
  // 仅 Windows 10 需要异步 Client Hints；其余系统（如 iOS Safari）同步执行，避免 Promise 等待
  if (currentOS.isWindows && currentOS.version === 10) {
    refineWindowsVersion().then(updatePage);
  } else {
    updatePage();
  }
})();