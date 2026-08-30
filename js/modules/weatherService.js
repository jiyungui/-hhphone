import { worldLocations } from '../data/locationData.js';

// 极简 Ins 黑白线条 SVG 天气图标全套
export const WEATHER_SVGS = {
  sunny: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/></svg>`,
  cloudy: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/></svg>`,
  overcast: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>`,
  fog: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><line x1="4" y1="19" x2="16" y2="19"/><line x1="7" y1="22" x2="19" y2="22"/></svg>`,
  rain: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17.5 16H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/><line x1="8" y1="19" x2="7" y2="22"/><line x1="12" y1="19" x2="11" y2="22"/><line x1="16" y1="19" x2="15" y2="22"/></svg>`,
  heavyRain: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17.5 15H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/><line x1="8" y1="17" x2="6" y2="22"/><line x1="12" y1="17" x2="10" y2="22"/><line x1="16" y1="17" x2="14" y2="22"/><line x1="20" y1="17" x2="18" y2="22"/></svg>`,
  snow: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17.5 16H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/><circle cx="8" cy="20" r="1"/><circle cx="12" cy="20" r="1"/><circle cx="16" cy="20" r="1"/></svg>`,
  thunder: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M19 16.9A5 5 0 0 0 18 7h-1.26a8 8 0 1 0-11.62 9"/><polygon points="13 11 9 17 15 17 11 23 15 17 11 17"/></svg>`,
  locationUnset: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>`,
  gpsIcon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`
};

// 内存与 LocalStorage 缓存
let cachedCity = localStorage.getItem('mini_user_city') || null;
let weatherCache = JSON.parse(localStorage.getItem('mini_weather_cache') || 'null');

/**
 * 获取当前天气（如果缓存有效直接返回，否则后台异步更新）
 */
export function getCurrentLocationWeather() {
  if (!cachedCity) {
    return { isSet: false, text: '未定位', icon: WEATHER_SVGS.locationUnset };
  }

  // 缓存 20 分钟内有效
  const now = Date.now();
  if (weatherCache && weatherCache.city === cachedCity && (now - weatherCache.timestamp < 20 * 60 * 1000)) {
    return {
      isSet: true,
      city: weatherCache.city,
      temp: `${weatherCache.temp}°`,
      condition: weatherCache.condition,
      icon: WEATHER_SVGS[weatherCache.iconKey] || WEATHER_SVGS.sunny
    };
  }

  return {
    isSet: true,
    city: cachedCity,
    temp: weatherCache ? `${weatherCache.temp}°` : '--°',
    condition: weatherCache ? weatherCache.condition : '同步中...',
    icon: weatherCache ? (WEATHER_SVGS[weatherCache.iconKey] || WEATHER_SVGS.sunny) : WEATHER_SVGS.sunny
  };
}

/**
 * 核心：异步请求真实天气 API
 */
export async function syncRealWeather(cityName = cachedCity) {
  if (!cityName) return null;

  try {
    // 1. 清洗地名（如 "长沙市" -> "长沙"，"Los Angeles (洛杉矶)" -> "Los Angeles"）
    const searchTarget = cleanCityQuery(cityName);

    // 2. 调用全球地理编码获取经纬度
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchTarget)}&count=1&language=zh&format=json`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error('未检索到对应城市坐标');
    }

    const { latitude, longitude } = geoData.results[0];

    // 3. 调用气象接口获取实时温度与 WMO 气象码
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&timezone=auto`;
    const weatherRes = await fetch(weatherUrl);
    const weatherData = await weatherRes.json();

    const current = weatherData.current;
    const realTemp = Math.round(current.temperature_2m);
    const wmoCode = current.weather_code;

    // 4. 解析 WMO 国际气象编码
    const { condition, iconKey } = parseWMOCode(wmoCode);

    // 5. 存储缓存
    weatherCache = {
      city: cityName,
      temp: realTemp,
      condition,
      iconKey,
      timestamp: Date.now()
    };
    localStorage.setItem('mini_user_city', cityName);
    localStorage.setItem('mini_weather_cache', JSON.stringify(weatherCache));
    cachedCity = cityName;

    return getCurrentLocationWeather();
  } catch (err) {
    console.warn('[Weather API] 同步失败，采用备用气象估计:', err);
    return null;
  }
}

/**
 * 清洗地名以提升地理编码匹配成功率
 */
function cleanCityQuery(raw) {
  let name = raw.split('/')[0].trim();
  // 提取括号外的英文或括号内的中文
  if (name.includes('(')) {
    const match = name.match(/\((.*?)\)/);
    if (match && match[1]) name = match[1];
  }
  return name.replace(/(市|区|县|省|特别行政区)$/g, '');
}

/**
 * 将国际 WMO 气象代码转为中文与对应图标
 */
function parseWMOCode(code) {
  if (code === 0) return { condition: '晴', iconKey: 'sunny' };
  if (code === 1 || code === 2) return { condition: '多云', iconKey: 'cloudy' };
  if (code === 3) return { condition: '阴', iconKey: 'overcast' };
  if (code === 45 || code === 48) return { condition: '雾', iconKey: 'fog' };
  if ([51, 53, 55, 61, 63, 80, 81].includes(code)) return { condition: '小雨', iconKey: 'rain' };
  if ([65, 82].includes(code)) return { condition: '大雨', iconKey: 'heavyRain' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { condition: '雪', iconKey: 'snow' };
  if ([95, 96, 99].includes(code)) return { condition: '雷阵雨', iconKey: 'thunder' };
  return { condition: '晴', iconKey: 'sunny' };
}

/**
 * 弹出多级地区选择抽屉（带 GPS 自动定位按钮）
 */
export function openLocationModal(onSelectCallback) {
  const modalContainer = document.getElementById('modal-root') || createModalContainer();
  modalContainer.classList.add('active');

  let navStack = [];

  function pushView(title, items, onSelect, getLabel = (x) => x) {
    navStack.push({ title, items, onSelect, getLabel });
    renderCurrent();
  }

  function popView() {
    if (navStack.length > 1) {
      navStack.pop();
      renderCurrent();
    }
  }

  function renderCurrent() {
    const current = navStack[navStack.length - 1];
    const canGoBack = navStack.length > 1;

    modalContainer.innerHTML = `
      <div class="modal-backdrop" id="modal-backdrop"></div>
      <div class="modal-sheet">
        <div class="sheet-drag-handle"></div>
        <div class="sheet-header">
          ${canGoBack ? '<button class="sheet-back-btn" id="modal-back-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg></button>' : '<div style="width:24px"></div>'}
          <span class="sheet-title">${current.title}</span>
          <button class="sheet-close-btn" id="modal-close-btn"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>
        </div>

        <!-- 🚀 GPS 自动定位按钮 -->
        <button class="gps-auto-btn" id="gps-locate-btn">
          ${WEATHER_SVGS.gpsIcon}
          <span>获取当前 GPS 真实位置与温度</span>
        </button>

        <div class="sheet-search-wrap">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <input type="text" id="modal-search" placeholder="输入城市/省份/国家进行搜索..."/>
        </div>

        <ul class="sheet-options-list" id="sheet-options">
          ${current.items.map((item, idx) => `
            <li class="sheet-option-item" data-idx="${idx}">
              <span>${current.getLabel(item)}</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </li>
          `).join('')}
        </ul>
      </div>
    `;

    // 绑定通用事件
    modalContainer.querySelector('#modal-backdrop').onclick = closeModal;
    modalContainer.querySelector('#modal-close-btn').onclick = closeModal;
    if (canGoBack) modalContainer.querySelector('#modal-back-btn').onclick = popView;

    // 绑定 GPS 自动定位
    const gpsBtn = modalContainer.querySelector('#gps-locate-btn');
    gpsBtn.onclick = () => handleGPSAutoLocate(gpsBtn);

    // 绑定列表点击
    const options = modalContainer.querySelectorAll('.sheet-option-item');
    options.forEach(opt => {
      opt.onclick = () => {
        const idx = Number(opt.getAttribute('data-idx'));
        current.onSelect(current.items[idx]);
      };
    });

    // 搜索监听
    const searchInput = modalContainer.querySelector('#modal-search');
    searchInput.oninput = (e) => {
      const keyword = e.target.value.trim().toLowerCase();
      if (!keyword) {
        renderCurrent();
        return;
      }
      const results = searchAllLocations(keyword);
      const listEl = modalContainer.querySelector('#sheet-options');
      listEl.innerHTML = results.length ? results.map((r, i) => `
        <li class="sheet-option-item search-match-item" data-search-idx="${i}">
          <div class="search-match-text">
            <strong>${r.target}</strong>
            <small class="search-crumb">${r.path}</small>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </li>
      `).join('') : '<li class="no-result-text">未找到匹配地区</li>';

      listEl.querySelectorAll('.search-match-item').forEach(el => {
        el.onclick = () => {
          const idx = Number(el.getAttribute('data-search-idx'));
          selectFinalLocation(results[idx].target);
        };
      });
    };
  }

  // 处理手机/浏览器原生 GPS 定位
  function handleGPSAutoLocate(btn) {
    if (!navigator.geolocation) {
      alert('当前设备不支持 GPS 定位');
      return;
    }
    btn.innerHTML = `<span>正在获取卫星定位与气象中...</span>`;
    btn.style.opacity = '0.6';

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          // 反向地理编码查询城市名
          const revGeo = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=zh`);
          const revData = await revGeo.json();
          const autoCity = revData.address.city || revData.address.town || revData.address.county || revData.address.state || '当前位置';
          await syncRealWeather(autoCity);
          closeModal();
          if (onSelectCallback) onSelectCallback();
        } catch (e) {
          // 备用：直接通过经纬度查询
          await syncRealWeather('当前位置');
          closeModal();
          if (onSelectCallback) onSelectCallback();
        }
      },
      (err) => {
        btn.innerHTML = `${WEATHER_SVGS.gpsIcon}<span>定位权限被拒，请手动选择</span>`;
        btn.style.opacity = '1';
      },
      { timeout: 8000 }
    );
  }

  async function selectFinalLocation(cityName) {
    closeModal();
    // 立即触发一次真实天气拉取
    await syncRealWeather(cityName);
    if (onSelectCallback) onSelectCallback();
  }

  function closeModal() {
    modalContainer.classList.remove('active');
  }

  // 层级下钻构建
  function startContinentLevel() {
    pushView("选择大洲", worldLocations, (continent) => {
      startRegionLevel(continent);
    }, (c) => c.continent);
  }

  function startRegionLevel(continent) {
    pushView(continent.continent, continent.regions, (region) => {
      startCountryLevel(region);
    }, (r) => r.name);
  }

  function startCountryLevel(region) {
    pushView(region.name, region.countries, (country) => {
      if (country.provinces) {
        startProvinceLevel(country);
      } else if (country.cities) {
        startCityLevel(country.name, country.cities);
      } else {
        selectFinalLocation(country.name);
      }
    }, (c) => c.name);
  }

  function startProvinceLevel(country) {
    pushView(country.name, country.provinces, (province) => {
      startCityLevel(province.name, province.cities);
    }, (p) => p.name);
  }

  function startCityLevel(parentName, cities) {
    pushView(parentName, cities, (city) => {
      selectFinalLocation(city);
    }, (city) => city);
  }

  startContinentLevel();
}

function searchAllLocations(kw) {
  const list = [];
  worldLocations.forEach(c => {
    c.regions.forEach(r => {
      r.countries.forEach(country => {
        if (country.name.toLowerCase().includes(kw)) {
          list.push({ target: country.name, path: `${c.continent} · ${r.name}` });
        }
        if (country.provinces) {
          country.provinces.forEach(p => {
            if (p.name.toLowerCase().includes(kw)) {
              list.push({ target: p.name, path: `${country.name}` });
            }
            p.cities.forEach(city => {
              if (city.toLowerCase().includes(kw)) {
                list.push({ target: city, path: `${country.name} · ${p.name}` });
              }
            });
          });
        }
        if (country.cities) {
          country.cities.forEach(city => {
            if (city.toLowerCase().includes(kw)) {
              list.push({ target: city, path: `${country.name}` });
            }
          });
        }
      });
    });
  });
  return list.slice(0, 40);
}

function createModalContainer() {
  const root = document.createElement('div');
  root.id = 'modal-root';
  root.className = 'modal-container';
  const phoneBody = document.querySelector('.phone-frame') || document.body;
  phoneBody.appendChild(root);
  return root;
}
