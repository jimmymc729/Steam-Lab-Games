(function () {
  var modeBadge = document.getElementById("modeBadge");
  var gameTitleEl = document.getElementById("gameTitle");
  var joinPromptEl = document.getElementById("joinPrompt");
  var qrCodeEl = document.getElementById("qrCode");
  var shortLinkEl = document.getElementById("shortLink");
  var copyBtn = document.getElementById("copyBtn");
  var openBtn = document.getElementById("openBtn");
  var fullscreenBtn = document.getElementById("fullscreenBtn");
  var statusText = document.getElementById("statusText");
  var previewThumb = document.getElementById("previewThumb");
  var gameDescription = document.getElementById("gameDescription");
  var gameTags = document.getElementById("gameTags");

  var params = new URLSearchParams(window.location.search);
  var slugParam = params.get("game");
  var urlParam = params.get("url");
  var titleParam = params.get("title");

  var FALLBACK_GAMES = [
    { slug: "pixel-print", title: "Pixel Print Studio", path: "/pixel-print-classroom.html", status: "live", description: "Design sprites and printable pixel art sheets for class.", tags: ["tool", "art"], theme: "science" },
    { slug: "spin-art-studio", title: "Spin Art Studio", path: "/spin-art-studio.html", status: "live", description: "Create colorful spin patterns while exploring motion, symmetry, and design.", tags: ["art", "science"], theme: "sim" },
    { slug: "spiro-spark-studio", title: "Spiro Spark Studio", path: "/spirograph-studio.html", status: "live", description: "Create colorful geometric spiral art while exploring ratios, symmetry, and design.", tags: ["math", "art"], theme: "break" },
    { slug: "buoyancy-sandbox", title: "Buoyancy Sandbox", path: "/buoyancy-sandbox.html", status: "live", description: "Explore density, mass, and buoyancy by dropping objects into water.", tags: ["science", "physics"], theme: "engineering" },
    { slug: "maze-generator", title: "Random Maze Generator", path: "/maze-generator.html", status: "live", description: "Generate a fresh maze every run and navigate to the goal.", tags: ["math", "logic"], theme: "break" },
    { slug: "quake-lab", title: "Quake Lab", path: "/quake-lab/index.html", status: "live", description: "Build beam towers and stress-test them with earthquake intensities.", tags: ["engineering", "physics"], theme: "engineering" },
    { slug: "sky-math-academy", title: "Sky Math Academy", path: "/math-flight-simulator/", status: "live", description: "Fly through the correct answer cards to solve equations.", tags: ["math", "arcade"], theme: "logic" },
    { slug: "balloon-pop-quantities", title: "Balloon Pop Quantities", path: "/balloon-pop-quantities.html", status: "live", description: "Pop the matching quantity balloons to practice counting.", tags: ["math", "counting"], theme: "break" },
    { slug: "greater-gator", title: "Greater Gator", path: "/greater-gator.html", status: "live", description: "Compare numbers while the swamp gator chomps the bigger value.", tags: ["math", "comparison"], theme: "logic" },
    { slug: "math-cannon", title: "Math Cannon", path: "/math-cannon.html", status: "live", description: "Fire your cannon at the correct answer targets for fast math practice.", tags: ["math", "arcade"], theme: "break" },
    { slug: "pollinator-patrol", title: "Pollinator Patrol", path: "/pollinator%20patrol/pollinator-patrol.html", status: "live", description: "Guide your bee through flower fields and keep pollinating.", tags: ["science", "nature"], theme: "science" },
    { slug: "ten-frame-builder", title: "Ten Frame Builder", path: "/ten-frame-builder/index.html", status: "live", description: "Build quantities on interactive ten frames with multiple modes.", tags: ["math", "number sense"], theme: "logic" },
    { slug: "rube-goldberg-machine", title: "Rube Goldberg Machine Builder", path: "/rube-goldberg%20copy.html", status: "live", description: "Chain ramps, dominoes, and gadgets to create a machine.", tags: ["engineering", "physics"], theme: "engineering" },
    { slug: "biome-world-lab", title: "Biome World Lab", path: "/biome-world-lab.html", status: "live", description: "Explore Earth's biomes by adjusting temperature and rainfall.", tags: ["science", "geography"], theme: "science" },
    { slug: "moonjet-cavern", title: "Moonjet Cavern", path: "/games/moonjet-cavern/", status: "coming_soon", description: "Pilot an astronaut through rocky caverns.", tags: ["arcade", "physics"], theme: "sim" }
  ];

  var qrInstance = null;
  var activeUrl = "";
  var activeShortUrl = "";
  var activeTitle = "STEAM Lab Experiment";
  var activeStatus = "live";
  var activeSlug = "";

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
    var input = value.trim();
    if (window.location.protocol === "file:" && input.startsWith("/")) {
      input = ".." + input;
    }
    return new URL(input, getUrlBase()).href;
  }

  function assertSafeUrl(value) {
    var absolute = toAbsoluteCandidate(value);
    var parsed = new URL(absolute);
    if (window.location.protocol !== "file:" && parsed.origin !== window.location.origin) {
      throw new Error("Only same-origin game URLs are allowed.");
    }
    return absolute;
  }

  function buildShortUrl(slug) {
    if (!slug) return "";
    if (window.location.protocol === "file:") {
      return "";
    }
    return window.location.origin + "/go#" + slug;
  }

  function getDisplayShortUrl(slug) {
    if (!slug) return "";
    try {
      var host = window.location.host || "steamlab.games";
      return host + "/go#" + slug;
    } catch (e) {
      return "steamlab.games/go#" + slug;
    }
  }

  function getQrSize() {
    var shortEdge = Math.min(window.innerWidth, window.innerHeight);
    return Math.max(240, Math.min(420, Math.floor(shortEdge * 0.42)));
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
    var size = getQrSize();
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

  function renderPreviewThumb(game) {
    if (!previewThumb) return;
    var slug = (game && game.slug) || "";

    // Use individual SVG files from /thumbs/ directory (works on file:// and http://)
    if (slug) {
      var img = document.createElement("img");
      img.alt = (game && game.title) || "Experiment preview";
      img.src = "../thumbs/" + slug + ".svg";
      img.style.width = "100%";
      img.style.height = "auto";
      img.style.display = "block";
      img.onerror = function () {
        // Fall back to a colored placeholder if SVG file is missing
        showPlaceholder(game);
      };
      previewThumb.innerHTML = "";
      previewThumb.appendChild(img);
      return;
    }

    showPlaceholder(game);

    function showPlaceholder(g) {
      var themeColors = {
        science: { bg: "#dff8ea", accent: "#6ea58a" },
        sim: { bg: "#e8f7ff", accent: "#5aa6e2" },
        break: { bg: "#fff3e8", accent: "#e8903a" },
        engineering: { bg: "#ecf4ff", accent: "#4d89c7" },
        logic: { bg: "#eef2ff", accent: "#5d53ba" }
      };
      var theme = (g && g.theme) || "science";
      var colors = themeColors[theme] || themeColors.science;
      var title = (g && g.title) || "Experiment";
      var initial = title.charAt(0).toUpperCase();
      previewThumb.innerHTML =
        '<svg viewBox="0 0 300 154" xmlns="http://www.w3.org/2000/svg" role="img">' +
          '<rect width="300" height="154" fill="' + colors.bg + '" />' +
          '<rect x="18" y="18" width="264" height="118" rx="12" fill="#ffffff" opacity="0.7" />' +
          '<text x="150" y="92" text-anchor="middle" font-family="Poppins, sans-serif" font-size="48" font-weight="800" fill="' + colors.accent + '">' + initial + '</text>' +
          '<text x="150" y="118" text-anchor="middle" font-family="Nunito Sans, sans-serif" font-size="13" font-weight="700" fill="' + colors.accent + '" opacity="0.7">STEAM Lab Games</text>' +
        '</svg>';
    }
  }

  function renderTags(tags) {
    if (!gameTags || !tags) return;
    gameTags.innerHTML = "";
    tags.forEach(function (t) {
      var span = document.createElement("span");
      span.className = "tag";
      span.textContent = t.toUpperCase();
      gameTags.appendChild(span);
    });
  }

  async function readRegistry() {
    var sources = ["../data/games.json", "/data/games.json"];
    for (var i = 0; i < sources.length; i++) {
      try {
        var response = await fetch(sources[i], { cache: "no-store" });
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
      var slug = slugParam.toLowerCase().trim();
      var games = await readRegistry();
      var game = Array.isArray(games)
        ? games.find(function (entry) { return String(entry.slug || "").toLowerCase() === slug; })
        : null;

      if (!game) {
        throw new Error("Game slug not found in registry: " + slug);
      }

      return {
        slug: slug,
        title: game.title || "STEAM Lab Experiment",
        url: assertSafeUrl(game.path || ""),
        status: game.status || "live",
        description: game.description || "",
        tags: game.tags || [],
        theme: game.theme || "science"
      };
    }

    if (urlParam) {
      return {
        slug: "",
        title: titleParam || "STEAM Lab Experiment",
        url: assertSafeUrl(urlParam),
        status: "live",
        description: "",
        tags: [],
        theme: "science"
      };
    }

    throw new Error("Missing parameters. Use ?game=<slug> or ?url=<encoded_url>.");
  }

  function applyComingSoonState() {
    if (modeBadge) {
      modeBadge.textContent = "CLASS LAUNCH \u00B7 COMING SOON";
    }
    if (joinPromptEl) {
      joinPromptEl.textContent = "Preview mode: this experiment is not live yet.";
    }
    if (openBtn) {
      openBtn.textContent = "Coming Soon";
      openBtn.classList.add("disabled");
      openBtn.removeAttribute("href");
      openBtn.removeAttribute("target");
      openBtn.removeAttribute("rel");
    }
  }

  async function copyLink() {
    var text = activeShortUrl || activeUrl;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Link copied!");
      return;
    } catch (err) { /* fallback */ }
    var helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    try {
      document.execCommand("copy");
      setStatus("Link copied!");
    } catch (err) {
      setStatus("Copy failed. Select the link manually.", true);
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
    if (copyBtn) copyBtn.addEventListener("click", copyLink);
    if (fullscreenBtn) fullscreenBtn.addEventListener("click", toggleFullscreen);
    if (openBtn) {
      openBtn.addEventListener("click", function (event) {
        if (openBtn.classList.contains("disabled")) {
          event.preventDefault();
          return;
        }
        setStatus("Opening experiment...");
      });
    }

    window.addEventListener("resize", function () {
      if (activeUrl) renderQr(activeUrl);
    });

    document.addEventListener("keydown", function (event) {
      if (event.defaultPrevented) return;
      var key = String(event.key || "").toLowerCase();
      if (key === "f") { event.preventDefault(); toggleFullscreen(); }
      if (key === "c") { event.preventDefault(); copyLink(); }
    });
  }

  async function init() {
    bindActions();
    try {
      var payload = await resolvePayload();
      activeUrl = payload.url;
      activeTitle = payload.title;
      activeStatus = String(payload.status || "live").toLowerCase();
      activeSlug = payload.slug || "";

      // Build short URL
      activeShortUrl = buildShortUrl(activeSlug);

      if (gameTitleEl) gameTitleEl.textContent = activeTitle;
      if (gameDescription) gameDescription.textContent = payload.description;

      renderPreviewThumb(payload);
      renderTags(payload.tags);

      // Short link bar — show the short /go#slug URL for typing,
      // fall back to direct game URL if no slug available
      if (shortLinkEl) {
        var displayUrl = getDisplayShortUrl(activeSlug);
        if (displayUrl) {
          shortLinkEl.textContent = displayUrl;
        } else {
          try {
            var u = new URL(activeUrl);
            shortLinkEl.textContent = u.host + u.pathname;
          } catch (e) {
            shortLinkEl.textContent = activeUrl;
          }
        }
      }

      // QR always encodes the direct game URL so students land straight in the game
      renderQr(activeUrl);

      if (openBtn && !openBtn.classList.contains("disabled")) {
        openBtn.href = activeUrl;
      }

      if (activeStatus !== "live") {
        applyComingSoonState();
      }

      if (activeSlug) {
        setStatus("Ready: " + activeTitle);
      } else {
        setStatus("Custom class launch link loaded.");
      }
    } catch (err) {
      if (gameTitleEl) gameTitleEl.textContent = "Class Launch Error";
      if (gameDescription) gameDescription.textContent = "Unable to build this launch screen.";
      if (modeBadge) modeBadge.textContent = "CLASS LAUNCH";
      if (shortLinkEl) shortLinkEl.textContent = "Check URL and try again";
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
