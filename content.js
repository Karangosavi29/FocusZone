chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === "BLOCK") {
    document.documentElement.innerHTML = `
      <body style="
        display:flex;
        justify-content:center;
        align-items:center;
        height:100vh;
        background:#0f172a;
        color:white;
        font-family:sans-serif;
        text-align:center;">
        
        <div>
          <h1>🚫 Site Blocked</h1>
          <p>You’ve reached your daily limit.</p>
          <p>Come back tomorrow 💪</p>
        </div>

      </body>
    `;
  }
});
