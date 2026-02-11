const coinCountEl = document.getElementById("coinCount");
const currentSiteEl = document.getElementById("currentSite");
const unlockBtn = document.getElementById("unlockBtn");

function getCurrentTabDomain(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]?.url) return;
    try {
      const domain = new URL(tabs[0].url).hostname;
      callback(domain);
    } catch {}
  });
}

// Load coins
chrome.storage.local.get({ coins: 0 }, (data) => {
  coinCountEl.textContent = data.coins;
});

// Get current site
getCurrentTabDomain((domain) => {
  currentSiteEl.textContent = domain;

  // Enable unlock only if site is blocked
  chrome.storage.local.get({ usage: {} }, (data) => {
    const used = data.usage[domain] || 0;

    if (used < 1) {
      unlockBtn.disabled = true;
      unlockBtn.textContent = "Site not blocked";
    }
  });

  unlockBtn.onclick = () => {
    chrome.runtime.getBackgroundPage?.(() => {
      chrome.runtime.sendMessage({
        action: "UNLOCK_SITE",
        domain
      });
      window.close();
    });
  };
});
