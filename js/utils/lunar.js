// 农历基本编码表 (1900 - 2050)
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x04950,
  0x0d4a0,0x1f8a6,0x0b550,0x056a0,0x1ada4,0x095d0,0x049b0,0x14977,0x0a4b0,0x0b4b5,
  0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,
  0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x04950,0x0d4a0,0x1f8a6,0x0b550,
  0x056a0,0x1ada4,0x095d0,0x049b0,0x14977,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,
  0x02b60,0x09570,0x052f2,0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,
  0x186e3,0x092e0,0x1c8d7,0x04950,0x0d4a0,0x1f8a6,0x0b550,0x056a0,0x1ada4,0x095d0,
  0x049b0,0x14977,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,
  0x04970,0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,
  0x04950,0x0d4a0,0x1f8a6,0x0b550,0x056a0,0x1ada4,0x095d0,0x049b0,0x14977,0x0a4b0
];

const CHINESE_NUMS = ['日', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const LUNAR_DAYS = [
  '初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'
];

/**
 * 输入公历 Date，返回对应的农历汉字日（如 "初一", "廿七"）
 */
export function getLunarDayName(solarDate) {
  let offset = (Date.UTC(solarDate.getFullYear(), solarDate.getMonth(), solarDate.getDate()) - Date.UTC(1900, 0, 31)) / 86400000;
  
  let i, leap = 0, temp = 0;
  for (i = 1900; i < 2050 && offset > 0; i++) {
    temp = getLunarYearDays(i);
    offset -= temp;
  }

  if (offset < 0) {
    offset += temp;
    i--;
  }

  leap = getLunarLeapMonth(i);
  let isLeap = false;

  for (let m = 1; m < 13 && offset > 0; m++) {
    if (leap > 0 && m === (leap + 1) && !isLeap) {
      --m;
      isLeap = true;
      temp = getLunarLeapDays(i);
    } else {
      temp = getLunarMonthDays(i, m);
    }

    if (isLeap && m === (leap + 1)) isLeap = false;
    offset -= temp;
  }

  if (offset === 0 && leap > 0 && i === leap + 1) {
    if (isLeap) isLeap = false;
    else isLeap = true;
  }

  if (offset < 0) {
    offset += temp;
  }

  const lunarDay = Math.floor(offset + 1);
  return LUNAR_DAYS[lunarDay - 1] || '初一';
}

function getLunarYearDays(year) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (LUNAR_INFO[year - 1900] & i) ? 1 : 0;
  return sum + getLunarLeapDays(year);
}

function getLunarLeapMonth(year) {
  return LUNAR_INFO[year - 1900] & 0xf;
}

function getLunarLeapDays(year) {
  if (getLunarLeapMonth(year)) return (LUNAR_INFO[year - 1900] & 0x10000) ? 30 : 29;
  return 0;
}

function getLunarMonthDays(year, month) {
  return (LUNAR_INFO[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}
