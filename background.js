const DAILY_LIMITS = {
  "www.youtube.com": 1,     // 1 minute
     
};

const COINS_PER_MINUTE = 1;
const UNLOCK_COST = 5;        // coins
const UNLOCK_MINUTES = 10;   // duration


let currentDomain = null;


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
  chrome.alarms.create("minuteTick", {
    periodInMinutes: 1
  });

  initCurrency();
});

function resetDailyUsage() {
  chrome.storage.local.set(
    {
      usage: {},
      coins: 0,
      unlocks: {}
    },
    () => {
      console.log("✅ Daily reset: usage, coins & unlocks");
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


function handleTab(tab) {
  const domain = getDomain(tab.url);
  if (!domain) return;

  chrome.storage.local.get({ usage: {} }, (data) => {
    const used = data.usage[domain] || 0;
    const limit = DAILY_LIMITS[domain];

    // 🚫 Block immediately if limit exceeded
    if (limit && used >= limit) {
      isTemporarilyUnlocked(domain, (unlocked) => {
        if (!unlocked) {
         blockTab(tab.id);
        }
      });
      return;
    }    
    currentDomain = domain;
    console.log("Now tracking:", domain);

    cleanExpiredUnlocks();

  });
}


chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "minuteTick") {
    if (currentDomain) {
      saveTime(currentDomain, 60);
    }
  }

  if (alarm.name === "dailyReset") {
    resetDailyUsage();
  }
});



function isTemporarilyUnlocked(domain, callback) {
  chrome.storage.local.get({ unlocks: {} }, (data) => {
    const expiry = data.unlocks[domain];
    callback(expiry && Date.now() < expiry);
  });
}

function unlockSite(domain) {
  chrome.storage.local.get(
    { coins: 0, unlocks: {} },
    (data) => {
      if (data.coins < UNLOCK_COST) {
        console.log("❌ Not enough coins");
        return;
      }

      const unlockUntil =
        Date.now() + UNLOCK_MINUTES * 60 * 1000;

      data.unlocks[domain] = unlockUntil;

      chrome.storage.local.set({
        coins: data.coins - UNLOCK_COST,
        unlocks: data.unlocks
      }, () => {
        console.log(`🔓 ${domain} unlocked for ${UNLOCK_MINUTES} minutes`);
      });
    }
  );
}

function cleanExpiredUnlocks() {
  chrome.storage.local.get({ unlocks: {} }, (data) => {
    const now = Date.now();
    let changed = false;

    for (const domain in data.unlocks) {
      if (data.unlocks[domain] <= now) {
        delete data.unlocks[domain];
        changed = true;
      }
    }

    if (changed) {
      chrome.storage.local.set({ unlocks: data.unlocks });
    }
  });
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "UNLOCK_SITE") {
    unlockSite(msg.domain);
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
