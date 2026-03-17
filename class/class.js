(function () {
  const modeBadge = document.getElementById("modeBadge");
  const gameTitleEl = document.getElementById("gameTitle");
  const joinPromptEl = document.getElementById("joinPrompt");
  const qrCodeEl = document.getElementById("qrCode");
  const typedLinkEl = document.getElementById("typedLink");
  const copyBtn = document.getElementById("copyBtn");
  const openBtn = document.getElementById("openBtn");
  const fullscreenBtn = document.getElementById("fullscreenBtn");
  const statusText = document.getElementById("statusText");

  const params = new URLSearchParams(window.location.search);
  const slugParam = params.get("game");
  const urlParam = params.get("url");
  const titleParam = params.get("title");
  const FALLBACK_GAMES = [
    { slug: "pixel-print", title: "Pixel Print Studio", path: "/pixel-print-classroom.html", status: "live" },
    { slug: "spin-art-studio", title: "Spin Art Studio", path: "/spin-art-studio.html", status: "live" },
    { slug: "spiro-spark-studio", title: "Spiro Spark Studio", path: "/spirograph-studio.html", status: "live" },
    { slug: "buoyancy-sandbox", title: "Buoyancy Sandbox", path: "/buoyancy-sandbox.html", status: "live" },
    { slug: "maze-generator", title: "Random Maze Generator", path: "/maze-generator.html", status: "live" },
    { slug: "quake-lab", title: "Quake Lab", path: "/quake-lab/index.html", status: "live" },
    { slug: "sky-math-academy", title: "Sky Math Academy", path: "/math-flight-simulator/", status: "live" },
    { slug: "balloon-pop-quantities", title: "Balloon Pop Quantities", path: "/balloon-pop-quantities.html", status: "live" },
    { slug: "greater-gator", title: "Greater Gator", path: "/greater-gator.html", status: "live" },
    { slug: "math-cannon", title: "Math Cannon", path: "/math-cannon.html", status: "live" },
    { slug: "pollinator-patrol", title: "Pollinator Patrol", path: "/pollinator%20patrol/pollinator-patrol.html", status: "live" },
    { slug: "rube-goldberg-machine", title: "Rube Goldberg Machine Builder", path: "/rube-goldberg%20copy.html", status: "live" },
    { slug: "ant-colony", title: "Ant Colony Lab", path: "/games/ant-colony-lab/", status: "coming_soon" },
    { slug: "moonjet-cavern", title: "Moonjet Cavern", path: "/games/moonjet-cavern/", status: "coming_soon" },
    { slug: "bridge-builder", title: "Bridge Builder", path: "/games/bridge-builder/", status: "coming_soon" },
    { slug: "ecosystem-simulator", title: "Ecosystem Simulator", path: "/games/ecosystem-simulator/", status: "coming_soon" },
    { slug: "pattern-pulse", title: "Pattern Pulse", path: "/games/pattern-pulse/", status: "coming_soon" }
  ];

  let qrInstance = null;
  let activeUrl = "";
  let activeTitle = "STEAM Lab Experiment";
  let activeStatus = "live";
  let activeSlug = "";

  function setStatus(message, warning) {
    if (!statusText) return;
    statusText.textContent = message || "";
    statusText.classList.toggle("warn", Boolean(warning));
  }

  function getUrlBase() {
    if (window.location.protocol === "file:") {
      return window.location.href;
    }
    return window.location.origin + "/";
  }

  function toAbsoluteCandidate(value) {
    if (!value) return "";
    let input = value.trim();

    if (window.location.protocol === "file:" && input.startsWith("/")) {
      input = ".." + input;
    }

    return new URL(input, getUrlBase()).href;
  }

  function assertSafeUrl(value) {
    const absolute = toAbsoluteCandidate(value);
    const parsed = new URL(absolute);

    if (window.location.protocol !== "file:" && parsed.origin !== window.location.origin) {
      throw new Error("Only same-origin game URLs are allowed.");
    }

    return absolute;
  }

  function getQrSize() {
    const shortEdge = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(320, Math.min(760, Math.floor(shortEdge * 0.72)));
  }

  function clearQrNode() {
    while (qrCodeEl.firstChild) {
      qrCodeEl.removeChild(qrCodeEl.firstChild);
    }
  }

  function renderQr(text) {
    clearQrNode();

    if (!window.QRCode) {
      setStatus("QR library failed to load. Please refresh.", true);
      return;
    }

    const size = getQrSize();
    qrCodeEl.style.width = size + "px";
    qrCodeEl.style.height = size + "px";

    qrInstance = new window.QRCode(qrCodeEl, {
      text: text,
      width: size,
      height: size,
      colorDark: "#0f2c45",
      colorLight: "#ffffff",
      correctLevel: window.QRCode.CorrectLevel.H
    });
  }

  async function readRegistry() {
    const sources = ["../data/games.json", "/data/games.json"];

    for (const source of sources) {
      try {
        const response = await fetch(source, { cache: "no-store" });
        if (!response.ok) continue;
        return await response.json();
      } catch (err) {
        // Try next source.
      }
    }

    return FALLBACK_GAMES;
  }

  async function resolvePayload() {
    if (slugParam) {
      const slug = slugParam.toLowerCase().trim();
      const games = await readRegistry();
      const game = Array.isArray(games)
        ? games.find((entry) => String(entry.slug || "").toLowerCase() === slug)
        : null;

      if (!game) {
        throw new Error("Game slug not found in registry: " + slug);
      }

      return {
        slug: slug,
        title: game.title || "STEAM Lab Experiment",
        url: assertSafeUrl(game.path || ""),
        status: game.status || "live"
      };
    }

    if (urlParam) {
      return {
        slug: "",
        title: titleParam || "STEAM Lab Experiment",
        url: assertSafeUrl(urlParam),
        status: "live"
      };
    }

    throw new Error("Missing parameters. Use ?game=<slug> or ?url=<encoded_url>.");
  }

  function applyComingSoonState() {
    if (modeBadge) {
      modeBadge.textContent = "CLASS LAUNCH • COMING SOON";
    }
    if (joinPromptEl) {
      joinPromptEl.textContent = "Preview mode: this experiment is not live yet.";
    }
    if (typedLinkEl) {
      typedLinkEl.removeAttribute("href");
      typedLinkEl.removeAttribute("target");
      typedLinkEl.removeAttribute("rel");
    }
    if (openBtn) {
      openBtn.textContent = "Coming Soon";
      openBtn.classList.add("disabled");
      openBtn.removeAttribute("href");
      openBtn.removeAttribute("target");
      openBtn.removeAttribute("rel");
    }
  }

  function getDisplayLink(url) {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search + parsed.hash;
      if (window.location.protocol !== "file:" && parsed.origin === window.location.origin) {
        return parsed.origin + path;
      }
      return parsed.href;
    } catch (err) {
      return url;
    }
  }

  async function copyLink() {
    const text = activeUrl;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setStatus("Link copied.");
      return;
    } catch (err) {
      // Fallback below.
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    try {
      document.execCommand("copy");
      setStatus("Link copied.");
    } catch (err) {
      setStatus("Copy failed. You can still select the link manually.", true);
    }
    document.body.removeChild(helper);
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      setStatus("Fullscreen unavailable in this browser.", true);
    }
  }

  function bindActions() {
    if (copyBtn) {
      copyBtn.addEventListener("click", copyLink);
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", toggleFullscreen);
    }

    if (openBtn) {
      openBtn.addEventListener("click", (event) => {
        if (openBtn.classList.contains("disabled")) {
          event.preventDefault();
          return;
        }
        setStatus("Opening experiment...");
      });
    }

    window.addEventListener("resize", () => {
      if (activeUrl) renderQr(activeUrl);
    });

    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented) return;
      const key = String(event.key || "").toLowerCase();

      if (key === "f") {
        event.preventDefault();
        toggleFullscreen();
      }

      if (key === "c") {
        event.preventDefault();
        copyLink();
      }
    });
  }

  async function init() {
    bindActions();

    try {
      const payload = await resolvePayload();
      activeUrl = payload.url;
      activeTitle = payload.title;
      activeStatus = String(payload.status || "live").toLowerCase();
      activeSlug = payload.slug || "";

      if (gameTitleEl) gameTitleEl.textContent = activeTitle;

      const displayLink = getDisplayLink(activeUrl);
      if (typedLinkEl) {
        typedLinkEl.textContent = displayLink;
        typedLinkEl.href = activeUrl;
      }

      if (openBtn && !openBtn.classList.contains("disabled")) {
        openBtn.href = activeUrl;
      }

      renderQr(activeUrl);

      if (activeStatus !== "live") {
        applyComingSoonState();
      }

      if (activeSlug) {
        setStatus("Ready for class launch: " + activeTitle);
      } else {
        setStatus("Custom class launch link loaded.");
      }
    } catch (err) {
      if (gameTitleEl) gameTitleEl.textContent = "Class Launch Error";
      if (joinPromptEl) joinPromptEl.textContent = "Unable to build this launch screen.";
      if (modeBadge) modeBadge.textContent = "CLASS LAUNCH";
      if (typedLinkEl) {
        typedLinkEl.removeAttribute("href");
        typedLinkEl.textContent = "Check URL parameters and try again.";
      }
      if (openBtn) {
        openBtn.textContent = "Unavailable";
        openBtn.classList.add("disabled");
        openBtn.removeAttribute("href");
      }
      setStatus(err.message || "Unknown error.", true);
    }
  }

  init();
})();
