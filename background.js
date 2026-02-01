const DAILY_LIMITS = {
  "www.youtube.com": 30,     // 1 minute
     
};

const COINS_PER_MINUTE = 1;


let currentDomain = null;
let startTime = null;

function initCurrency() {
  chrome.storage.local.get({ coins: 0 }, (data) => {
    if (typeof data.coins !== "number") {
      chrome.storage.local.set({ coins: 0 });
    }
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("dailyReset", {
    periodInMinutes: 1440
  });
  initCurrency();
});

function resetDailyUsage() {
  chrome.storage.local.set(
    {
      usage: {},
      coins: 0
    },
    () => {
      console.log("✅ Daily reset: usage & coins");
    }
  );
}

function isBlocked(domain, callback) {
  chrome.storage.local.get({ usage: {} }, (data) => {
    const used = data.usage[domain] || 0;
    const limit = DAILY_LIMITS[domain];

    callback(limit && used >= limit);
  });
}




function getDomain(url) {
  try {
    if (
      url.startsWith("chrome://") ||
      url.startsWith("chrome-extension://")
    ) {
      return null;
    }
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

function blockTab(tabId) {
  chrome.tabs.update(tabId, {
    url: chrome.runtime.getURL("blocked.html")
  });
}



function saveTime(domain, seconds) {
  chrome.storage.local.get(
    { usage: {}, coins: 0 },
    (data) => {
      const usage = data.usage;
      const coins = data.coins;

      usage[domain] = (usage[domain] || 0) + seconds;

      // Earn coins ONLY if site is not blocked
      if (!DAILY_LIMITS[domain]) {
        const earnedCoins = Math.floor(seconds / 60) * COINS_PER_MINUTE;
        if (earnedCoins > 0) {
          chrome.storage.local.set({
            usage,
            coins: coins + earnedCoins
          });
          console.log(`🪙 Earned ${earnedCoins} coins`);
          return;
        }
      }

      chrome.storage.local.set({ usage });
    }
  );
}

function updateTime() {
  if (!currentDomain || !startTime) return;

  const seconds = Math.floor((Date.now() - startTime) / 1000);
  if (seconds > 0) {
    console.log(`Adding ${seconds}s to`, currentDomain);
    saveTime(currentDomain, seconds);
  }
}

function handleTab(tab) {
  const domain = getDomain(tab.url);
  if (!domain) return;

  chrome.storage.local.get({ usage: {} }, (data) => {
    const used = data.usage[domain] || 0;
    const limit = DAILY_LIMITS[domain];

    // 🚫 Block immediately if limit exceeded
    if (limit && used >= limit) {
      blockTab(tab.id);
      return;
    }

    // ⏱️ Save previous domain time
    if (currentDomain && startTime) {
      const secs = Math.floor((Date.now() - startTime) / 1000);
      saveTime(currentDomain, secs);
    }

    currentDomain = domain;
    startTime = Date.now();
    console.log("Now tracking:", domain);
  });
}


function resetDailyUsage() {
  chrome.storage.local.set({ usage: {} }, () => {
    console.log(" Daily usage reset");
  });
}

chrome.runtime.onInstalled.addListener(() => {
    
  chrome.alarms.create("dailyReset", {
    periodInMinutes: 1440 // 24 hours
  });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "dailyReset") {
    resetDailyUsage();
  }
});





chrome.tabs.onActivated.addListener(({ tabId }) => {
  chrome.tabs.get(tabId, handleTab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === "complete") {
    handleTab(tab);
  }
});
