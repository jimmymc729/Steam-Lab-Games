const CONFIG = {
  grid: { cols: 28, rows: 18, tileSize: 34 },
  camera: {
    zoomMin: 0.42,
    zoomMax: 2.0,
    panSpeed: 860,
    zoomStep: 0.1,
  },
  simStepSeconds: 0.25,
  maxResource: 999,
  winTargets: {
    temperature: -24,
    pressure: 32,
    oxygen: 18,
    biomass: 20,
    population: 140,
    holdSeconds: 18,
  },
  loseThresholdSeconds: 30,
};

const TERRAIN_TYPES = {
  rocky: {
    name: "Rocky Plains",
    base: [114, 72, 57],
    lush: [102, 155, 93],
  },
  ice: {
    name: "Ice Field",
    base: [124, 143, 164],
    lush: [120, 175, 169],
  },
  crater: {
    name: "Crater Basin",
    base: [84, 51, 54],
    lush: [90, 143, 103],
  },
  volcanic: {
    name: "Volcanic Zone",
    base: [73, 43, 38],
    lush: [89, 126, 88],
  },
  canyon: {
    name: "Canyon",
    base: [139, 82, 56],
    lush: [118, 163, 100],
  },
};

const BUILDINGS = [
  {
    id: "solarFarm",
    name: "Solar Farm",
    cost: { metals: 18 },
    production: { energy: 2.2 },
    upkeep: {},
    terrain: ["rocky", "canyon", "crater", "volcanic"],
    capacity: 0,
    greenBoost: 0.015,
    description: "Cheap baseline power. Vulnerable to dust storms.",
    tint: [106, 206, 255],
  },
  {
    id: "fusionPlant",
    name: "Fusion Plant",
    cost: { metals: 52, carbon: 20, science: 16 },
    production: { energy: 7.6 },
    upkeep: { waterIce: 0.45 },
    terrain: ["rocky", "volcanic", "crater"],
    capacity: 0,
    greenBoost: 0.008,
    description: "High-output grid anchor for late growth.",
    tint: [255, 195, 124],
  },
  {
    id: "iceExtractor",
    name: "Ice Extractor",
    cost: { metals: 24, energy: 10 },
    production: { waterIce: 2.0, carbon: 0.45 },
    upkeep: { energy: 1.2 },
    terrain: ["ice"],
    capacity: 0,
    greenBoost: 0.02,
    description: "Core water source from subsurface ice sheets.",
    tint: [173, 241, 255],
  },
  {
    id: "metalMine",
    name: "Metal Mine",
    cost: { metals: 14, energy: 8 },
    production: { metals: 1.65, carbon: 0.12 },
    upkeep: { energy: 1.0 },
    terrain: ["volcanic", "crater"],
    capacity: 0,
    greenBoost: 0.01,
    description: "Extracts metals for construction and upgrades.",
    tint: [198, 163, 138],
  },
  {
    id: "researchStation",
    name: "Research Station",
    cost: { metals: 26, energy: 13, waterIce: 6 },
    production: { science: 1.35 },
    upkeep: { energy: 0.8, waterIce: 0.24 },
    terrain: ["rocky", "canyon", "crater", "ice"],
    capacity: 0,
    greenBoost: 0.022,
    description: "Unlocks scientific momentum and efficiency.",
    tint: [146, 224, 255],
  },
  {
    id: "atmoProcessor",
    name: "Atmospheric Processor",
    cost: { metals: 34, carbon: 22, energy: 14 },
    production: {},
    upkeep: { energy: 1.8, carbon: 0.35 },
    terrain: ["volcanic", "rocky", "crater"],
    capacity: 0,
    greenBoost: 0.04,
    description: "Builds pressure and oxygen using carbon feedstock.",
    tint: [152, 231, 191],
  },
  {
    id: "greenhouse",
    name: "Greenhouse Dome",
    cost: { metals: 32, waterIce: 20, energy: 16 },
    production: {},
    upkeep: { energy: 1.6, waterIce: 0.9, carbon: 0.12 },
    terrain: ["rocky", "canyon", "ice"],
    capacity: 6,
    greenBoost: 0.06,
    description: "Produces oxygen and biomass while supporting colonists.",
    tint: [130, 212, 141],
  },
  {
    id: "habitatDome",
    name: "Habitat District",
    cost: { metals: 38, energy: 20, waterIce: 18, carbon: 8 },
    production: {},
    upkeep: { energy: 1.5, waterIce: 0.75, carbon: 0.2 },
    terrain: ["rocky", "canyon", "crater"],
    capacity: 28,
    greenBoost: 0.05,
    description: "Main population district with long-term housing capacity.",
    tint: [142, 233, 255],
  },
];

const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((building) => [building.id, building]));
const RESOURCE_KEYS = ["energy", "metals", "waterIce", "carbon", "science"];

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const overlayEl = document.getElementById("overlay");
const missionStatusEl = document.getElementById("missionStatus");
const buildMenuEl = document.getElementById("buildMenu");
const eventLogEl = document.getElementById("eventLog");
const criticalTextEl = document.getElementById("criticalText");
const goalTextEl = document.getElementById("goalText");

const pauseBtn = document.getElementById("pauseBtn");
const restartBtn = document.getElementById("restartBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");
const speedButtons = [...document.querySelectorAll(".speed-btn")];

const keyState = {
  up: false,
  down: false,
  left: false,
  right: false,
};

const pointerState = {
  canvasX: 0,
  canvasY: 0,
  worldX: 0,
  worldY: 0,
  hoverTile: null,
  leftDown: false,
  leftStartX: 0,
  leftStartY: 0,
  leftMoved: false,
  panning: false,
};

let viewState = {
  width: window.innerWidth,
  height: window.innerHeight,
};

const HEX = createHexMetrics();

let state = createInitialState("menu");
let fixedStepAccumulator = 0;
let lastTimestamp = 0;

init();

function createHexMetrics() {
  const radius = CONFIG.grid.tileSize;
  const hexWidth = radius * 2;
  const hexHeight = Math.sqrt(3) * radius;
  const xStep = radius * 1.5;
  const yStep = hexHeight;
  return { radius, hexWidth, hexHeight, xStep, yStep };
}

function getHexCenter(col, row) {
  return {
    x: col * HEX.xStep + HEX.radius + 72,
    y: row * HEX.yStep + (col % 2 ? HEX.yStep * 0.5 : 0) + HEX.radius + 102,
  };
}

function getWorldDimensions() {
  const width = (CONFIG.grid.cols - 1) * HEX.xStep + HEX.hexWidth + 144;
  const height = CONFIG.grid.rows * HEX.yStep + HEX.yStep * 0.5 + HEX.radius * 2 + 188;
  return { width, height };
}

function init() {
  createBuildMenu();
  wireEvents();
  resizeCanvas();

  if (goalTextEl) {
    goalTextEl.textContent =
      "Build a self-sustaining Martian city. Raise Temp, Pressure, Oxygen, Biomass, and Population while preventing life-support collapse.";
  }

  showOverlay(
    "Terraform Mars: Grand Strategy",
    "Guide Mars through a Civilization-inspired era of expansion. Claim hex sectors, develop districts, and shape a thriving world through long-term planning."
  );
  addLog("Simulation ready. Build utility backbone first.", "good");
  syncUi();
  requestAnimationFrame(gameLoop);
}

function createInitialState(mode = "playing") {
  const map = generateMap();
  const world = getWorldDimensions();

  return {
    mode,
    paused: mode !== "playing",
    speed: 1,
    selectedBuildingId: BUILDINGS[0].id,
    map,
    world,
    camera: {
      x: Math.max(0, (world.width - viewState.width) * 0.5),
      y: Math.max(0, (world.height - viewState.height) * 0.5),
      zoom: 0.88,
    },
    timeSeconds: 0,
    resources: {
      energy: 140,
      metals: 120,
      waterIce: 90,
      carbon: 62,
      science: 10,
    },
    stats: {
      temperature: -62,
      pressure: 4,
      oxygen: 0.4,
      biomass: 0,
      population: 0,
    },
    colony: {
      capacity: 0,
      started: false,
      criticalTimer: 0,
      winTimer: 0,
    },
    counts: getEmptyBuildingCounts(),
    event: {
      type: null,
      timer: 0,
      nextEventIn: randomRange(34, 56),
    },
    logs: [],
  };
}

function generateMap() {
  const map = [];
  for (let y = 0; y < CONFIG.grid.rows; y += 1) {
    for (let x = 0; x < CONFIG.grid.cols; x += 1) {
      const terrain = pickTerrain(x, y);
      map.push({
        x,
        y,
        terrain,
        elevation: hash2D(x * 0.29 + 4.3, y * 0.33 + 9.7),
        fertility: hash2D(x * 0.61 + 12.4, y * 0.57 + 6.9),
        terraforming: Math.random() * 0.03,
        building: null,
        pulse: 0,
      });
    }
  }
  return map;
}

function pickTerrain(x, y) {
  const latBand = y / CONFIG.grid.rows;
  const noise = hash2D(x * 0.17 + 3, y * 0.19 + 7);
  const ridge = Math.abs(hash2D(x * 0.24 + 15.3, y * 0.28 + 2.1) - 0.5);
  const cold = Math.max(0, 0.3 - Math.abs(latBand - 0.08));

  if (latBand < 0.2 && (noise > 0.34 || cold > 0.18)) {
    return "ice";
  }

  if (latBand > 0.74 && noise < 0.35) {
    return "canyon";
  }

  if (ridge > 0.23 && noise < 0.28) {
    return "crater";
  }
  if (noise < 0.38) {
    return "rocky";
  }
  if (noise < 0.55) {
    return "canyon";
  }
  if (noise < 0.77) {
    return "volcanic";
  }
  return "rocky";
}

function getEmptyBuildingCounts() {
  return {
    solarFarm: 0,
    fusionPlant: 0,
    iceExtractor: 0,
    metalMine: 0,
    researchStation: 0,
    atmoProcessor: 0,
    greenhouse: 0,
    habitatDome: 0,
  };
}

function createBuildMenu() {
  buildMenuEl.innerHTML = "";

  BUILDINGS.forEach((building, index) => {
    const button = document.createElement("button");
    button.className = "build-btn";
    button.dataset.buildingId = building.id;
    button.type = "button";

    const keyHint = index + 1;
    button.innerHTML = `${keyHint}. ${building.name}<span class="cost">${formatCost(building.cost)}</span>`;
    button.title = `${building.description} | Terrain: ${building.terrain
      .map((terrain) => TERRAIN_TYPES[terrain].name)
      .join(", ")}`;

    button.addEventListener("click", () => {
      state.selectedBuildingId = building.id;
      syncUi();
    });

    buildMenuEl.appendChild(button);
  });
}

function wireEvents() {
  window.addEventListener("resize", resizeCanvas);

  canvas.addEventListener("contextmenu", (event) => event.preventDefault());

  canvas.addEventListener("mousemove", (event) => {
    updatePointerFromEvent(event);

    if (pointerState.leftDown) {
      const dx = Math.abs(pointerState.canvasX - pointerState.leftStartX);
      const dy = Math.abs(pointerState.canvasY - pointerState.leftStartY);
      if (dx > 5 || dy > 5) {
        pointerState.leftMoved = true;
      }
    }

    if (pointerState.panning) {
      const movementX = event.movementX || 0;
      const movementY = event.movementY || 0;
      panCameraByPixels(-movementX, -movementY);
    }
  });

  canvas.addEventListener("mousedown", (event) => {
    updatePointerFromEvent(event);

    if (event.button === 0) {
      pointerState.leftDown = true;
      pointerState.leftMoved = false;
      pointerState.leftStartX = pointerState.canvasX;
      pointerState.leftStartY = pointerState.canvasY;
    }

    if (event.button === 1 || event.button === 2) {
      pointerState.panning = true;
    }
  });

  canvas.addEventListener("mouseup", (event) => {
    updatePointerFromEvent(event);

    if (event.button === 0) {
      if (pointerState.leftDown && !pointerState.leftMoved) {
        tryPlaceFromPointer();
      }
      pointerState.leftDown = false;
      pointerState.leftMoved = false;
    }

    if (event.button === 1 || event.button === 2) {
      pointerState.panning = false;
    }
  });

  canvas.addEventListener("mouseleave", () => {
    pointerState.hoverTile = null;
    pointerState.leftDown = false;
    pointerState.leftMoved = false;
    pointerState.panning = false;
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      const direction = event.deltaY < 0 ? 1 : -1;
      zoomCameraAtPointer(direction * CONFIG.camera.zoomStep, pointerState.canvasX, pointerState.canvasY);
    },
    { passive: false }
  );

  pauseBtn.addEventListener("click", () => {
    if (state.mode !== "playing") {
      return;
    }
    state.paused = !state.paused;
    addLog(state.paused ? "Simulation paused." : "Simulation resumed.");
    syncUi();
  });

  restartBtn.addEventListener("click", () => {
    startMission();
  });

  fullscreenBtn.addEventListener("click", () => {
    toggleFullscreen();
  });

  speedButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (state.mode !== "playing") {
        return;
      }
      state.speed = Number(button.dataset.speed || "1");
      syncUi();
    });
  });

  window.addEventListener("keydown", (event) => {
    setPanKey(event.code, true);

    if (event.code === "Space") {
      event.preventDefault();
      if (state.mode === "playing") {
        state.paused = !state.paused;
        syncUi();
      }
      return;
    }

    if (event.code === "KeyF") {
      toggleFullscreen();
      return;
    }

    if (event.code === "KeyR") {
      startMission();
      return;
    }

    if (/^Digit[1-8]$/.test(event.code)) {
      const index = Number(event.code.replace("Digit", "")) - 1;
      if (BUILDINGS[index]) {
        state.selectedBuildingId = BUILDINGS[index].id;
        syncUi();
      }
    }
  });

  window.addEventListener("keyup", (event) => {
    setPanKey(event.code, false);
  });
}

function setPanKey(code, active) {
  if (code === "KeyW" || code === "ArrowUp") {
    keyState.up = active;
  } else if (code === "KeyS" || code === "ArrowDown") {
    keyState.down = active;
  } else if (code === "KeyA" || code === "ArrowLeft") {
    keyState.left = active;
  } else if (code === "KeyD" || code === "ArrowRight") {
    keyState.right = active;
  }
}

function resizeCanvas() {
  viewState.width = window.innerWidth;
  viewState.height = window.innerHeight;

  canvas.width = viewState.width;
  canvas.height = viewState.height;

  clampCamera();
}

function updatePointerFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  pointerState.canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
  pointerState.canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);

  const worldPos = screenToWorld(pointerState.canvasX, pointerState.canvasY);
  pointerState.worldX = worldPos.x;
  pointerState.worldY = worldPos.y;

  pointerState.hoverTile = pickTileFromWorld(worldPos.x, worldPos.y);
}

function screenToWorld(screenX, screenY) {
  const zoom = state.camera.zoom;
  return {
    x: state.camera.x + screenX / zoom,
    y: state.camera.y + screenY / zoom,
  };
}

function pickTileFromWorld(worldX, worldY) {
  const approxCol = Math.round((worldX - 72 - HEX.radius) / HEX.xStep);
  let best = null;
  let bestDist = Number.POSITIVE_INFINITY;

  for (let col = approxCol - 2; col <= approxCol + 2; col += 1) {
    if (col < 0 || col >= CONFIG.grid.cols) {
      continue;
    }

    const rowOffset = col % 2 ? HEX.yStep * 0.5 : 0;
    const approxRow = Math.round((worldY - 102 - HEX.radius - rowOffset) / HEX.yStep);
    for (let row = approxRow - 2; row <= approxRow + 2; row += 1) {
      if (row < 0 || row >= CONFIG.grid.rows) {
        continue;
      }
      const center = getHexCenter(col, row);
      const dx = worldX - center.x;
      const dy = worldY - center.y;
      const dist = Math.hypot(dx, dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = { x: col, y: row };
      }
    }
  }

  if (!best || bestDist > HEX.radius * 1.05) {
    return null;
  }
  return best;
}

function tryPlaceFromPointer() {
  if (state.mode !== "playing" || state.paused) {
    return;
  }

  const hover = pointerState.hoverTile;
  if (!hover) {
    return;
  }

  placeBuildingOnTile(hover.x, hover.y);
}

function placeBuildingOnTile(tileX, tileY) {
  const tile = getTile(tileX, tileY);
  const building = BUILDING_BY_ID[state.selectedBuildingId];

  if (!tile || !building) {
    return;
  }

  if (tile.building) {
    addLog("That tile already has infrastructure.", "alert");
    syncUi();
    return;
  }

  if (!building.terrain.includes(tile.terrain)) {
    addLog(`${building.name} is not compatible with ${TERRAIN_TYPES[tile.terrain].name}.`, "alert");
    syncUi();
    return;
  }

  if (!canAfford(building.cost)) {
    addLog(`Not enough resources for ${building.name}.`, "alert");
    syncUi();
    return;
  }

  spendCost(building.cost);

  tile.building = {
    id: building.id,
    efficiency: computePlacementEfficiency(tile, building),
  };
  tile.pulse = 1;

  recalculateBuildingCounts();
  if (building.capacity > 0) {
    state.colony.started = true;
  }

  addLog(`${building.name} built at (${tileX}, ${tileY}).`, "good");
  syncUi();
}

function computePlacementEfficiency(tile, building) {
  let efficiency = 1;

  if (building.id === "solarFarm" && tile.terrain === "canyon") {
    efficiency += 0.08;
  }
  if (building.id === "iceExtractor" && tile.terrain === "ice") {
    efficiency += 0.14;
  }
  if (building.id === "metalMine" && tile.terrain === "volcanic") {
    efficiency += 0.12;
  }
  if (building.id === "atmoProcessor" && tile.terrain === "crater") {
    efficiency += 0.1;
  }

  return clamp(efficiency, 0.75, 1.3);
}

function canAfford(cost) {
  return Object.entries(cost).every(([resource, amount]) => state.resources[resource] >= amount);
}

function spendCost(cost) {
  for (const [resource, amount] of Object.entries(cost)) {
    state.resources[resource] = Math.max(0, state.resources[resource] - amount);
  }
}

function recalculateBuildingCounts() {
  const counts = getEmptyBuildingCounts();
  for (const tile of state.map) {
    if (tile.building) {
      counts[tile.building.id] += 1;
    }
  }
  state.counts = counts;
}

function gameLoop(timestamp) {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const deltaSeconds = Math.min(0.1, (timestamp - lastTimestamp) / 1000);
  lastTimestamp = timestamp;

  if (state.mode === "playing") {
    updateCameraFromKeys(deltaSeconds);

    if (!state.paused) {
      advanceSimulation(deltaSeconds * state.speed);
      syncUi();
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function updateCameraFromKeys(dt) {
  let moveX = 0;
  let moveY = 0;

  if (keyState.left) {
    moveX -= 1;
  }
  if (keyState.right) {
    moveX += 1;
  }
  if (keyState.up) {
    moveY -= 1;
  }
  if (keyState.down) {
    moveY += 1;
  }

  if (moveX === 0 && moveY === 0) {
    return;
  }

  const length = Math.hypot(moveX, moveY) || 1;
  const speed = CONFIG.camera.panSpeed / state.camera.zoom;

  state.camera.x += (moveX / length) * speed * dt;
  state.camera.y += (moveY / length) * speed * dt;
  clampCamera();
}

function panCameraByPixels(pixelDx, pixelDy) {
  state.camera.x += pixelDx / state.camera.zoom;
  state.camera.y += pixelDy / state.camera.zoom;
  clampCamera();
}

function zoomCameraAtPointer(zoomDelta, pointerX, pointerY) {
  const oldZoom = state.camera.zoom;
  const newZoom = clamp(oldZoom + zoomDelta, CONFIG.camera.zoomMin, CONFIG.camera.zoomMax);
  if (Math.abs(newZoom - oldZoom) < 0.001) {
    return;
  }

  const worldBefore = screenToWorld(pointerX, pointerY);
  state.camera.zoom = newZoom;

  state.camera.x = worldBefore.x - pointerX / newZoom;
  state.camera.y = worldBefore.y - pointerY / newZoom;
  clampCamera();
}

function clampCamera() {
  const visibleWidth = viewState.width / state.camera.zoom;
  const visibleHeight = viewState.height / state.camera.zoom;

  const maxX = Math.max(0, state.world.width - visibleWidth);
  const maxY = Math.max(0, state.world.height - visibleHeight);

  state.camera.x = clamp(state.camera.x, 0, maxX);
  state.camera.y = clamp(state.camera.y, 0, maxY);
}

function advanceSimulation(simSeconds) {
  fixedStepAccumulator += simSeconds;
  while (fixedStepAccumulator >= CONFIG.simStepSeconds) {
    updateSimStep(CONFIG.simStepSeconds);
    fixedStepAccumulator -= CONFIG.simStepSeconds;
  }
}

function updateSimStep(dt) {
  state.timeSeconds += dt;

  updateEventSystem(dt);

  const eventMods = getEventModifiers();
  const resourceDeltas = {
    energy: 0,
    metals: 0,
    waterIce: 0,
    carbon: 0,
    science: 0,
  };

  for (const tile of state.map) {
    if (tile.pulse > 0) {
      tile.pulse = Math.max(0, tile.pulse - dt * 1.3);
    }

    if (!tile.building) {
      continue;
    }

    const building = BUILDING_BY_ID[tile.building.id];
    const efficiency = tile.building.efficiency || 1;

    for (const [resource, amount] of Object.entries(building.production)) {
      let produced = amount * efficiency;

      if (building.id === "solarFarm") {
        produced *= eventMods.solarMultiplier;
      }
      if (building.id === "researchStation") {
        produced *= eventMods.scienceMultiplier;
      }

      resourceDeltas[resource] += produced;
    }

    for (const [resource, amount] of Object.entries(building.upkeep)) {
      resourceDeltas[resource] -= amount * eventMods.upkeepMultiplier;
    }

    if (building.id === "fusionPlant") {
      resourceDeltas.temperatureBoost = (resourceDeltas.temperatureBoost || 0) + 0.02 * efficiency;
    }
  }

  if (eventMods.flatMetalDrain > 0) {
    resourceDeltas.metals -= eventMods.flatMetalDrain;
  }
  if (eventMods.flatEnergyDrain > 0) {
    resourceDeltas.energy -= eventMods.flatEnergyDrain;
  }

  const shortages = {
    energy: false,
    waterIce: false,
  };

  for (const resource of RESOURCE_KEYS) {
    const nextValue = state.resources[resource] + resourceDeltas[resource] * dt;
    state.resources[resource] = clamp(nextValue, 0, CONFIG.maxResource);

    if (state.resources[resource] <= 0.01) {
      if (resource === "energy" || resource === "waterIce") {
        shortages[resource] = true;
      }
    }
  }

  applyTerraformingModel(dt, shortages, eventMods, resourceDeltas);
  updatePopulation(dt, shortages, eventMods);
  updateTiles(dt);
  checkWinLose(dt, shortages);
}

function updateEventSystem(dt) {
  if (state.event.type) {
    state.event.timer -= dt;
    if (state.event.timer <= 0) {
      addLog(`${formatEventName(state.event.type)} ended. Systems stabilizing.`, "good");
      state.event.type = null;
      state.event.timer = 0;
      state.event.nextEventIn = randomRange(34, 60);
    }
    return;
  }

  state.event.nextEventIn -= dt;
  if (state.event.nextEventIn <= 0) {
    startRandomEvent();
  }
}

function startRandomEvent() {
  const roll = Math.random();
  if (roll < 0.52) {
    state.event.type = "dustStorm";
    state.event.timer = randomRange(14, 21);
    addLog("Dust storm front has arrived. Solar farms operating below capacity.", "alert");
  } else if (roll < 0.84) {
    state.event.type = "equipmentFailure";
    state.event.timer = randomRange(12, 18);
    addLog("Equipment failures detected. Extra maintenance drains resources.", "alert");
  } else {
    state.event.type = "solarFlare";
    state.event.timer = randomRange(10, 15);
    addLog("Solar flare spike. Colony systems are in radiation-safe mode.", "alert");
  }
}

function getEventModifiers() {
  if (state.event.type === "dustStorm") {
    return {
      solarMultiplier: 0.42,
      upkeepMultiplier: 1,
      popSupportMultiplier: 0.96,
      scienceMultiplier: 1,
      flatMetalDrain: 0,
      flatEnergyDrain: 0,
      oxygenMultiplier: 1,
    };
  }

  if (state.event.type === "equipmentFailure") {
    return {
      solarMultiplier: 1,
      upkeepMultiplier: 1.4,
      popSupportMultiplier: 0.95,
      scienceMultiplier: 0.9,
      flatMetalDrain: 0.8,
      flatEnergyDrain: 1.1,
      oxygenMultiplier: 1,
    };
  }

  if (state.event.type === "solarFlare") {
    return {
      solarMultiplier: 1.14,
      upkeepMultiplier: 1.08,
      popSupportMultiplier: 0.82,
      scienceMultiplier: 1.12,
      flatMetalDrain: 0,
      flatEnergyDrain: 0.4,
      oxygenMultiplier: 0.85,
    };
  }

  return {
    solarMultiplier: 1,
    upkeepMultiplier: 1,
    popSupportMultiplier: 1,
    scienceMultiplier: 1,
    flatMetalDrain: 0,
    flatEnergyDrain: 0,
    oxygenMultiplier: 1,
  };
}

function applyTerraformingModel(dt, shortages, eventMods, resourceDeltas) {
  const {
    solarFarm,
    fusionPlant,
    researchStation,
    atmoProcessor,
    greenhouse,
    habitatDome,
  } = state.counts;

  const shortMultiplier = shortages.energy || shortages.waterIce ? 0.57 : 1;

  const tempDelta =
    fusionPlant * 0.07 +
    atmoProcessor * 0.024 +
    greenhouse * 0.014 +
    habitatDome * 0.01 +
    (resourceDeltas.temperatureBoost || 0) -
    0.007;

  state.stats.temperature += tempDelta * shortMultiplier * dt;

  state.stats.pressure +=
    (atmoProcessor * 0.072 + fusionPlant * 0.015 + greenhouse * 0.02 + researchStation * 0.009) *
    shortMultiplier *
    dt;

  state.stats.oxygen +=
    (greenhouse * 0.09 + atmoProcessor * 0.03 + Math.max(0, state.stats.biomass) * 0.008) *
    shortMultiplier *
    eventMods.oxygenMultiplier *
    dt;

  const biomassBase = greenhouse * 0.045 + (state.stats.oxygen > 11 ? 0.028 : -0.012);
  const waterFactor = state.resources.waterIce > 70 ? 0.016 : -0.02;
  state.stats.biomass += (biomassBase + waterFactor) * shortMultiplier * dt;

  state.stats.temperature = clamp(state.stats.temperature, -80, 20);
  state.stats.pressure = clamp(state.stats.pressure, 0, 65);
  state.stats.oxygen = clamp(state.stats.oxygen, 0, 45);
  state.stats.biomass = clamp(state.stats.biomass, 0, 100);
}

function updatePopulation(dt, shortages, eventMods) {
  const habitatCapacity = state.counts.habitatDome * 28;
  const greenhouseCapacity = state.counts.greenhouse * 6;
  state.colony.capacity = habitatCapacity + greenhouseCapacity;

  if (state.colony.capacity <= 0) {
    state.stats.population = Math.max(0, state.stats.population - dt * 1.5);
    return;
  }

  state.colony.started = true;

  const tempScore = clamp01((state.stats.temperature + 70) / 52);
  const pressureScore = clamp01(state.stats.pressure / 34);
  const oxygenScore = clamp01(state.stats.oxygen / 22);
  const biomassScore = clamp01(state.stats.biomass / 35);

  const habitability = tempScore * 0.28 + pressureScore * 0.27 + oxygenScore * 0.31 + biomassScore * 0.14;

  const energySupport = clamp01(state.resources.energy / 55);
  const waterSupport = clamp01(state.resources.waterIce / 45);
  const support = ((energySupport + waterSupport) * 0.5) * eventMods.popSupportMultiplier;

  let targetPopulation = Math.floor(state.colony.capacity * habitability * support);
  if (shortages.energy || shortages.waterIce) {
    targetPopulation = Math.floor(targetPopulation * 0.62);
  }

  if (state.stats.population < targetPopulation) {
    state.stats.population += Math.min(targetPopulation - state.stats.population, dt * 2.3);
  } else {
    state.stats.population -= Math.min(state.stats.population - targetPopulation, dt * 1.75);
  }

  state.stats.population = clamp(state.stats.population, 0, state.colony.capacity);
}

function updateTiles(dt) {
  const oxygenFactor = clamp01(state.stats.oxygen / 24);
  const temperatureFactor = clamp01((state.stats.temperature + 70) / 60);
  const waterFactor = clamp01(state.resources.waterIce / 240);

  for (const tile of state.map) {
    const localBoost = localTerraformBoost(tile.x, tile.y);
    const growth =
      (oxygenFactor * 0.35 + temperatureFactor * 0.25 + waterFactor * 0.17 + localBoost - 0.16) * dt * 0.2;

    tile.terraforming = clamp(tile.terraforming + growth, 0, 1);
  }
}

function localTerraformBoost(tileX, tileY) {
  let boost = 0;
  for (const [dx, dy] of getHexNeighborOffsets(tileX)) {
    const neighbor = getTile(tileX + dx, tileY + dy);
    if (!neighbor || !neighbor.building) {
      continue;
    }
    const building = BUILDING_BY_ID[neighbor.building.id];
    boost += building.greenBoost * 0.16;
  }
  return boost;
}

function getHexNeighborOffsets(col) {
  if (col % 2) {
    return [
      [1, 0],
      [1, 1],
      [0, 1],
      [-1, 1],
      [-1, 0],
      [0, -1],
    ];
  }
  return [
    [1, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
  ];
}

function checkWinLose(dt, shortages) {
  const target = CONFIG.winTargets;

  const hitWinTargets =
    state.stats.temperature >= target.temperature &&
    state.stats.pressure >= target.pressure &&
    state.stats.oxygen >= target.oxygen &&
    state.stats.biomass >= target.biomass &&
    state.stats.population >= target.population;

  if (hitWinTargets) {
    state.colony.winTimer += dt;
  } else {
    state.colony.winTimer = Math.max(0, state.colony.winTimer - dt * 2);
  }

  if (state.colony.started && (shortages.energy || shortages.waterIce)) {
    state.colony.criticalTimer += dt;
  } else {
    state.colony.criticalTimer = Math.max(0, state.colony.criticalTimer - dt * 1.4);
  }

  if (state.colony.winTimer >= target.holdSeconds) {
    state.mode = "win";
    state.paused = true;
    showOverlay(
      "Terraforming Milestone Achieved",
      "Your Mars city reached stable regional habitability. Expansion to neighboring sectors is now viable.",
      "Launch New Mission"
    );
    addLog("Victory: regional habitability stabilized.", "good");
    syncUi();
    return;
  }

  if (state.colony.started && state.colony.criticalTimer >= CONFIG.loseThresholdSeconds) {
    state.mode = "lose";
    state.paused = true;
    showOverlay(
      "Colony Collapse",
      "Life-support essentials stayed depleted too long. Build stronger utility reserves before rapid district growth.",
      "Try Again"
    );
    addLog("Mission failed: life-support collapse.", "alert");
    syncUi();
  }
}

function draw() {
  drawBackground();

  const zoom = state.camera.zoom;
  ctx.setTransform(zoom, 0, 0, zoom, -state.camera.x * zoom, -state.camera.y * zoom);

  drawTerrain();
  drawGrid();
  drawUtilityLinks();
  drawBuildings();
  drawHoverTile();

  ctx.setTransform(1, 0, 0, 1, 0, 0);

  drawTileInspector();

  if (state.event.type === "dustStorm") {
    drawDustStormOverlay();
  } else if (state.event.type === "solarFlare") {
    drawSolarFlareOverlay();
  }

  drawCameraBadge();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, viewState.height);
  gradient.addColorStop(0, "#7e5b3b");
  gradient.addColorStop(0.42, "#9e6b41");
  gradient.addColorStop(0.78, "#5b3928");
  gradient.addColorStop(1, "#2f2019");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewState.width, viewState.height);

  const sunGlow = ctx.createRadialGradient(
    viewState.width * 0.73,
    viewState.height * 0.19,
    20,
    viewState.width * 0.73,
    viewState.height * 0.19,
    viewState.width * 0.52
  );
  sunGlow.addColorStop(0, "rgba(255, 220, 155, 0.32)");
  sunGlow.addColorStop(1, "rgba(255, 220, 155, 0)");
  ctx.fillStyle = sunGlow;
  ctx.fillRect(0, 0, viewState.width, viewState.height);

  const hazeBand = ctx.createLinearGradient(0, viewState.height * 0.26, 0, viewState.height * 0.9);
  hazeBand.addColorStop(0, "rgba(229, 169, 107, 0.08)");
  hazeBand.addColorStop(1, "rgba(26, 17, 13, 0.22)");
  ctx.fillStyle = hazeBand;
  ctx.fillRect(0, 0, viewState.width, viewState.height);

  ctx.fillStyle = "rgba(55, 35, 24, 0.48)";
  ctx.fillRect(0, 0, viewState.width, 64);
  ctx.fillRect(0, viewState.height - 56, viewState.width, 56);
}

function drawTerrain() {
  const radius = HEX.radius;

  for (const tile of state.map) {
    const terrain = TERRAIN_TYPES[tile.terrain];
    const center = getHexCenter(tile.x, tile.y);
    const tone = blendColor(terrain.base, terrain.lush, tile.terraforming);

    const rowShade = clamp(0.86 + (tile.y / CONFIG.grid.rows) * 0.17, 0.82, 1.1);
    const elevationShade = 0.88 + tile.elevation * 0.24;
    ctx.fillStyle = rgbToCss(multiplyRgb(tone, rowShade * elevationShade));
    drawHexTilePath(center.x, center.y, radius);
    ctx.fill();

    drawTerrainTexture(tile, center.x, center.y, radius);

    ctx.strokeStyle = `rgba(44, 28, 19, ${0.22 + tile.elevation * 0.2})`;
    ctx.lineWidth = 1.1;
    drawHexTilePath(center.x, center.y, radius);
    ctx.stroke();

    if (tile.elevation > 0.63) {
      ctx.strokeStyle = "rgba(246, 229, 188, 0.16)";
      ctx.lineWidth = 1;
      drawHexTilePath(center.x, center.y - radius * 0.05, radius * 0.78);
      ctx.stroke();
    }

    if (tile.pulse > 0) {
      ctx.fillStyle = `rgba(255, 236, 175, ${tile.pulse * 0.22})`;
      drawHexTilePath(center.x, center.y, radius);
      ctx.fill();
    }
  }
}

function drawTerrainTexture(tile, centerX, centerY, radius) {
  const seed = tile.x * 37 + tile.y * 91;

  ctx.save();
  drawHexTilePath(centerX, centerY, radius - 1.3);
  ctx.clip();

  if (tile.terrain === "crater") {
    ctx.strokeStyle = "rgba(36, 20, 20, 0.35)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i += 1) {
      const px = centerX + (hash2D(seed + i * 3, 8.7) - 0.5) * radius * 1.2;
      const py = centerY + (hash2D(seed + i * 5, 12.9) - 0.5) * radius * 1.1;
      const ring = radius * (0.2 + hash2D(seed + i * 7, 3.1) * 0.3);
      ctx.beginPath();
      ctx.arc(px, py, ring, 0, Math.PI * 2);
      ctx.stroke();
    }
  } else if (tile.terrain === "ice") {
    ctx.strokeStyle = "rgba(219, 247, 255, 0.34)";
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 2; i += 1) {
      ctx.beginPath();
      ctx.moveTo(centerX - radius * 0.65, centerY - radius * 0.2 + i * 7 + hash2D(seed + i, 1.3) * 5);
      ctx.lineTo(centerX + radius * 0.64, centerY - radius * 0.24 + i * 6 + hash2D(seed + i, 4.2) * 5);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = `rgba(255, 238, 204, ${0.05 + tile.fertility * 0.07})`;
    for (let i = 0; i < 5; i += 1) {
      const px = centerX + (hash2D(seed + i, 5.1) - 0.5) * radius * 1.3;
      const py = centerY + (hash2D(seed + i, 9.8) - 0.5) * radius * 1.2;
      ctx.beginPath();
      ctx.arc(px, py, 1.3 + hash2D(seed + i, 14.2) * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (tile.terraforming > 0.3) {
    const growth = clamp((tile.terraforming - 0.3) / 0.7, 0, 1);
    const patchCount = 2 + Math.floor(growth * 4);
    for (let i = 0; i < patchCount; i += 1) {
      const px = centerX + (hash2D(seed + i * 11, 17.9) - 0.5) * radius * 1.3;
      const py = centerY + (hash2D(seed + i * 13, 22.4) - 0.5) * radius * 1.2;
      const rad = radius * (0.1 + hash2D(seed + i * 17, 3.7) * 0.22);
      ctx.fillStyle = `rgba(95, 170, 88, ${0.2 + growth * 0.4})`;
      ctx.beginPath();
      ctx.ellipse(px, py, rad, rad * 0.6, hash2D(seed + i * 19, 10.4) * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  if (tile.elevation > 0.68) {
    const peakAlpha = (tile.elevation - 0.68) * 0.85;
    ctx.fillStyle = `rgba(245, 228, 191, ${peakAlpha})`;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY - radius * 0.1, radius * 0.26, radius * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawGrid() {
  if (state.camera.zoom < 0.62) {
    return;
  }

  ctx.strokeStyle = "rgba(251, 232, 188, 0.12)";
  ctx.lineWidth = 1;
  for (const tile of state.map) {
    const center = getHexCenter(tile.x, tile.y);
    drawHexTilePath(center.x, center.y, HEX.radius);
    ctx.stroke();
  }
}

function drawHexTilePath(centerX, centerY, radius) {
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const angle = Math.PI / 180 * (60 * i - 30);
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
}

function drawUtilityLinks() {
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  for (const tile of state.map) {
    if (!tile.building) {
      continue;
    }
    const fromCenter = getHexCenter(tile.x, tile.y);
    for (const [dx, dy] of getHexNeighborOffsets(tile.x)) {
      const neighbor = getTile(tile.x + dx, tile.y + dy);
      if (!neighbor || !neighbor.building) {
        continue;
      }
      if (neighbor.x < tile.x || (neighbor.x === tile.x && neighbor.y < tile.y)) {
        continue;
      }
      const toCenter = getHexCenter(neighbor.x, neighbor.y);
      drawLink(fromCenter, toCenter, 0.9);
    }
  }
}

function drawLink(fromCenter, toCenter, strength) {
  const pulse = 0.45 + 0.55 * Math.sin(state.timeSeconds * 3 + fromCenter.x * 0.01 + toCenter.y * 0.01);
  ctx.strokeStyle = `rgba(247, 196, 116, ${(0.08 + pulse * 0.2) * strength})`;

  ctx.beginPath();
  ctx.moveTo(fromCenter.x, fromCenter.y);
  ctx.lineTo(toCenter.x, toCenter.y);
  ctx.stroke();
}

function drawBuildings() {
  for (const tile of state.map) {
    if (!tile.building) {
      continue;
    }

    const building = BUILDING_BY_ID[tile.building.id];
    const center = getHexCenter(tile.x, tile.y);

    drawStructureBase(center.x, center.y);
    drawBuildingGlyph(building, tile, center.x, center.y);
  }
}

function drawStructureBase(centerX, centerY) {
  ctx.fillStyle = "rgba(18, 11, 8, 0.43)";
  ctx.beginPath();
  ctx.ellipse(centerX, centerY + HEX.radius * 0.36, HEX.radius * 0.45, HEX.radius * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawBuildingGlyph(building, tile, centerX, centerY) {
  const r = HEX.radius;
  const x = centerX - r;
  const y = centerY - r;

  if (building.id === "solarFarm") {
    const shimmer = 0.45 + 0.55 * Math.sin(state.timeSeconds * 5 + tile.x);
    ctx.fillStyle = "#163650";
    ctx.fillRect(x + r * 0.45, y + r * 0.9, r * 1.1, r * 0.52);
    ctx.strokeStyle = `rgba(163, 224, 255, ${0.44 + shimmer * 0.45})`;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x + r * 0.45, y + r * 0.9, r * 1.1, r * 0.52);
    ctx.fillStyle = "#5f7b87";
    ctx.fillRect(x + r * 0.95, y + r * 0.58, r * 0.18, r * 0.34);
  } else if (building.id === "fusionPlant") {
    const glow = 0.4 + 0.6 * Math.sin(state.timeSeconds * 2.2 + tile.y);
    ctx.fillStyle = "#5b493f";
    ctx.fillRect(x + r * 0.56, y + r * 0.58, r * 0.86, r * 0.74);
    ctx.fillStyle = `rgba(255, 200, 128, ${0.3 + glow * 0.4})`;
    ctx.beginPath();
    ctx.arc(centerX, y + r * 0.96, r * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#736054";
    ctx.fillRect(x + r * 0.72, y + r * 0.4, r * 0.18, r * 0.24);
    ctx.fillRect(x + r * 1.1, y + r * 0.38, r * 0.16, r * 0.28);
  } else if (building.id === "iceExtractor") {
    const spin = state.timeSeconds * 6 + tile.x;
    ctx.fillStyle = "#a6efff";
    ctx.fillRect(x + r * 0.66, y + r * 0.68, r * 0.66, r * 0.66);
    ctx.strokeStyle = "rgba(226, 249, 255, 0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, y + r * 0.46);
    ctx.lineTo(centerX + Math.cos(spin) * 6, y + r * 0.82 + Math.sin(spin) * 4);
    ctx.stroke();
  } else if (building.id === "metalMine") {
    ctx.fillStyle = "#3d2c24";
    ctx.fillRect(x + r * 0.52, y + r * 0.92, r * 0.96, r * 0.52);
    ctx.fillStyle = "#171114";
    ctx.beginPath();
    ctx.ellipse(centerX, y + r * 1.18, r * 0.3, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7b5e4f";
    ctx.fillRect(x + r * 0.92, y + r * 0.66, r * 0.16, r * 0.34);
  } else if (building.id === "researchStation") {
    const sweep = state.timeSeconds * 2 + tile.x * 0.4;
    ctx.fillStyle = "#ece7d8";
    ctx.fillRect(x + r * 0.88, y + r * 0.42, r * 0.3, r * 0.8);
    ctx.fillStyle = "#7a909f";
    ctx.fillRect(x + r * 0.62, y + r * 1.1, r * 0.76, r * 0.22);
    ctx.strokeStyle = "rgba(137, 235, 255, 0.85)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(centerX, y + r * 0.46);
    ctx.lineTo(centerX + Math.cos(sweep) * 10, y + r * 0.32 + Math.sin(sweep) * 5);
    ctx.stroke();
  } else if (building.id === "atmoProcessor") {
    const pulse = 0.4 + 0.6 * Math.sin(state.timeSeconds * 2.7 + tile.y);
    ctx.fillStyle = "#465b54";
    ctx.fillRect(x + r * 0.58, y + r * 0.66, r * 0.84, r * 0.68);
    ctx.fillStyle = `rgba(152, 228, 196, ${0.24 + pulse * 0.38})`;
    ctx.fillRect(x + r * 0.74, y + r * 0.82, r * 0.52, r * 0.36);
    ctx.fillStyle = "#7d9488";
    ctx.fillRect(x + r * 0.92, y + r * 0.48, r * 0.16, r * 0.24);
  } else if (building.id === "greenhouse") {
    ctx.fillStyle = "rgba(111, 166, 104, 0.86)";
    ctx.beginPath();
    ctx.arc(centerX, y + r * 1.04, r * 0.38, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4d5a46";
    ctx.fillRect(x + r * 0.62, y + r * 1.04, r * 0.76, r * 0.22);
  } else if (building.id === "habitatDome") {
    const glow = 0.4 + 0.6 * Math.sin(state.timeSeconds * 2.1 + tile.x * 0.3);
    ctx.fillStyle = "rgba(175, 206, 222, 0.9)";
    ctx.beginPath();
    ctx.arc(centerX, y + r * 1.02, r * 0.4, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#5f5f67";
    ctx.fillRect(x + r * 0.58, y + r * 1.02, r * 0.84, r * 0.25);
    ctx.fillStyle = `rgba(255, 241, 178, ${0.2 + glow * 0.38})`;
    ctx.fillRect(x + r * 0.74, y + r * 1.14, r * 0.12, r * 0.06);
    ctx.fillRect(x + r * 0.94, y + r * 1.14, r * 0.12, r * 0.06);
    ctx.fillRect(x + r * 1.14, y + r * 1.14, r * 0.12, r * 0.06);
  }

  ctx.strokeStyle = "rgba(249, 225, 181, 0.28)";
  ctx.lineWidth = 1;
  drawHexTilePath(centerX, centerY, r * 0.42);
  ctx.stroke();
}

function drawHoverTile() {
  if (!pointerState.hoverTile || state.mode !== "playing") {
    return;
  }

  const tile = getTile(pointerState.hoverTile.x, pointerState.hoverTile.y);
  if (!tile) {
    return;
  }

  const center = getHexCenter(tile.x, tile.y);

  const preview = getPlacementPreview(tile.x, tile.y);
  const valid = preview.status === "valid";

  ctx.fillStyle = valid ? "rgba(129, 225, 255, 0.16)" : "rgba(255, 150, 139, 0.16)";
  drawHexTilePath(center.x, center.y, HEX.radius - 1.5);
  ctx.fill();

  const pulse = 0.55 + 0.45 * Math.sin(state.timeSeconds * 6);
  ctx.strokeStyle = valid
    ? `rgba(136, 238, 255, ${0.45 + pulse * 0.42})`
    : `rgba(255, 149, 142, ${0.48 + pulse * 0.36})`;
  ctx.lineWidth = 2;
  drawHexTilePath(center.x, center.y, HEX.radius - 1.5);
  ctx.stroke();
}

function drawTileInspector() {
  if (!pointerState.hoverTile) {
    return;
  }

  const tile = getTile(pointerState.hoverTile.x, pointerState.hoverTile.y);
  if (!tile) {
    return;
  }

  const preview = getPlacementPreview(tile.x, tile.y);
  const buildingName = tile.building ? BUILDING_BY_ID[tile.building.id].name : "Empty";
  const text = `${TERRAIN_TYPES[tile.terrain].name} | ${buildingName} | ${preview.label}`;

  const width = clamp(text.length * 6.8 + 18, 220, viewState.width - 32);
  const x = 16;
  const y = viewState.height - 36;

  ctx.fillStyle = "rgba(37, 24, 18, 0.8)";
  pathRoundedRect(ctx, x, y, width, 24, 8);
  ctx.fill();

  ctx.strokeStyle = preview.status === "valid" ? "rgba(161, 222, 155, 0.84)" : "rgba(237, 151, 114, 0.78)";
  ctx.lineWidth = 1.1;
  pathRoundedRect(ctx, x, y, width, 24, 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(244, 228, 198, 0.97)";
  ctx.font = '12px "Palatino Linotype", "Book Antiqua", serif';
  ctx.fillText(text, x + 9, y + 16);
}

function drawDustStormOverlay() {
  const alpha = clamp(state.event.timer / 20, 0.22, 0.42);
  ctx.fillStyle = `rgba(204, 146, 96, ${alpha})`;
  ctx.fillRect(0, 0, viewState.width, viewState.height);

  ctx.strokeStyle = "rgba(255, 226, 168, 0.22)";
  ctx.lineWidth = 1.3;
  const t = state.timeSeconds * 120;
  for (let i = 0; i < 64; i += 1) {
    const y = (i * 12 + t * 0.2 + Math.sin(i + t * 0.02) * 8) % viewState.height;
    const x = ((i * 74 + t) % (viewState.width + 160)) - 120;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 68, y + 8);
    ctx.stroke();
  }
}

function drawSolarFlareOverlay() {
  const alpha = clamp(state.event.timer / 14, 0.08, 0.2);
  const flare = ctx.createRadialGradient(
    viewState.width * 0.86,
    viewState.height * 0.1,
    12,
    viewState.width * 0.86,
    viewState.height * 0.1,
    220
  );
  flare.addColorStop(0, `rgba(255, 222, 155, ${alpha * 2.2})`);
  flare.addColorStop(1, "rgba(255, 222, 155, 0)");
  ctx.fillStyle = flare;
  ctx.fillRect(0, 0, viewState.width, viewState.height);
}

function drawCameraBadge() {
  const text = `Zoom ${state.camera.zoom.toFixed(2)}x | Pan: WASD/Arrows or drag Right Mouse | Build keys 1-8`;
  const width = clamp(text.length * 6.9 + 18, 280, viewState.width - 32);
  const x = viewState.width - width - 16;
  const y = viewState.height - 36;

  ctx.fillStyle = "rgba(37, 24, 18, 0.78)";
  pathRoundedRect(ctx, x, y, width, 24, 8);
  ctx.fill();

  ctx.strokeStyle = "rgba(238, 188, 125, 0.66)";
  ctx.lineWidth = 1;
  pathRoundedRect(ctx, x, y, width, 24, 8);
  ctx.stroke();

  ctx.fillStyle = "rgba(248, 227, 194, 0.95)";
  ctx.font = '12px "Palatino Linotype", "Book Antiqua", serif';
  ctx.fillText(text, x + 9, y + 16);
}

function getPlacementPreview(tileX, tileY) {
  const tile = getTile(tileX, tileY);
  if (!tile) {
    return { status: "out", label: "Out of bounds" };
  }

  const building = BUILDING_BY_ID[state.selectedBuildingId];
  if (!building) {
    return { status: "none", label: "No structure selected" };
  }

  if (tile.building) {
    return { status: "occupied", label: "Tile occupied" };
  }

  if (!building.terrain.includes(tile.terrain)) {
    return {
      status: "terrain",
      label: `Requires: ${building.terrain.map((terrain) => TERRAIN_TYPES[terrain].name).join("/")}`,
    };
  }

  if (!canAfford(building.cost)) {
    return { status: "cost", label: "Insufficient resources" };
  }

  return { status: "valid", label: `Ready for ${building.name}` };
}

function formatEventName(eventType) {
  if (eventType === "dustStorm") {
    return "Dust Storm";
  }
  if (eventType === "equipmentFailure") {
    return "Equipment Failure";
  }
  if (eventType === "solarFlare") {
    return "Solar Flare";
  }
  return "Event";
}

function syncUi() {
  setText("res-energy", Math.round(state.resources.energy));
  setText("res-metals", Math.round(state.resources.metals));
  setText("res-waterIce", Math.round(state.resources.waterIce));
  setText("res-carbon", Math.round(state.resources.carbon));
  setText("res-science", Math.round(state.resources.science));

  setText("stat-temperature", `${state.stats.temperature.toFixed(1)} C`);
  setText("stat-pressure", `${state.stats.pressure.toFixed(1)} kPa`);
  setText("stat-oxygen", `${state.stats.oxygen.toFixed(1)}%`);
  setText("stat-biomass", `${state.stats.biomass.toFixed(1)}%`);
  setText("stat-population", `${Math.floor(state.stats.population)} / ${state.colony.capacity}`);

  const eventLabel = state.event.type ? `${formatEventName(state.event.type)} (${Math.ceil(state.event.timer)}s)` : "Stable";

  const missionStatus =
    state.mode === "menu"
      ? "Pre-Launch"
      : state.mode === "win"
      ? "Success"
      : state.mode === "lose"
      ? "Mission Failed"
      : state.paused
      ? `Paused | ${eventLabel}`
      : `Active ${state.speed}x | ${eventLabel}`;

  missionStatusEl.textContent = missionStatus;
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";

  speedButtons.forEach((button) => {
    const selected = Number(button.dataset.speed) === state.speed;
    button.classList.toggle("active", selected);
  });

  updateCriticalNotice();
  renderBuildMenuState();
  renderLog();
}

function updateCriticalNotice() {
  if (state.colony.criticalTimer > 0 && state.mode === "playing") {
    const remaining = Math.max(0, CONFIG.loseThresholdSeconds - state.colony.criticalTimer);
    criticalTextEl.textContent = `Critical life-support shortage: ${remaining.toFixed(1)}s remaining`;
    criticalTextEl.classList.remove("hidden");
  } else {
    criticalTextEl.classList.add("hidden");
  }
}

function renderBuildMenuState() {
  const buttons = [...buildMenuEl.querySelectorAll("button")];
  buttons.forEach((button) => {
    const buildingId = button.dataset.buildingId;
    const selected = buildingId === state.selectedBuildingId;
    button.classList.toggle("selected", selected);
  });
}

function renderLog() {
  eventLogEl.innerHTML = "";
  for (const entry of state.logs) {
    const item = document.createElement("li");
    item.className = entry.level;
    item.textContent = `[${entry.time}] ${entry.message}`;
    eventLogEl.appendChild(item);
  }
}

function addLog(message, level = "") {
  const minutes = Math.floor(state.timeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(state.timeSeconds % 60)
    .toString()
    .padStart(2, "0");

  state.logs.unshift({
    message,
    level,
    time: `${minutes}:${seconds}`,
  });

  if (state.logs.length > 12) {
    state.logs.pop();
  }
}

function startMission() {
  state = createInitialState("playing");
  fixedStepAccumulator = 0;
  lastTimestamp = 0;
  pointerState.hoverTile = null;
  pointerState.leftDown = false;
  pointerState.leftMoved = false;
  pointerState.panning = false;

  hideOverlay();
  addLog("Mission started. Build power, water, then habitats.", "good");
  syncUi();
}

function showOverlay(title, description, buttonLabel = "Start Mission") {
  overlayEl.classList.add("visible");
  overlayEl.innerHTML = `
    <div class="overlay-card">
      <h2>${title}</h2>
      <p>${description}</p>
      <button id="overlayAction" type="button">${buttonLabel}</button>
    </div>
  `;

  const actionButton = document.getElementById("overlayAction");
  if (actionButton) {
    actionButton.addEventListener("click", () => {
      startMission();
    });
  }
}

function hideOverlay() {
  overlayEl.classList.remove("visible");
  overlayEl.innerHTML = "";
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {
      addLog("Fullscreen request was blocked by the browser.", "alert");
      syncUi();
    });
  } else {
    document.exitFullscreen();
  }
}

function getTile(x, y) {
  if (x < 0 || x >= CONFIG.grid.cols || y < 0 || y >= CONFIG.grid.rows) {
    return null;
  }
  return state.map[y * CONFIG.grid.cols + x];
}

function formatCost(cost) {
  return Object.entries(cost)
    .map(([resource, amount]) => `${resourceLabel(resource)} ${amount}`)
    .join(" | ");
}

function resourceLabel(resource) {
  if (resource === "waterIce") {
    return "Water";
  }
  return resource.charAt(0).toUpperCase() + resource.slice(1);
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) {
    node.textContent = String(value);
  }
}

function blendColor(fromRgb, toRgb, t) {
  const safeT = clamp01(t);
  const r = Math.round(fromRgb[0] + (toRgb[0] - fromRgb[0]) * safeT);
  const g = Math.round(fromRgb[1] + (toRgb[1] - fromRgb[1]) * safeT);
  const b = Math.round(fromRgb[2] + (toRgb[2] - fromRgb[2]) * safeT);
  return [r, g, b];
}

function multiplyRgb(rgb, multiplier) {
  return [
    clamp(Math.round(rgb[0] * multiplier), 0, 255),
    clamp(Math.round(rgb[1] * multiplier), 0, 255),
    clamp(Math.round(rgb[2] * multiplier), 0, 255),
  ];
}

function rgbToCss(rgb) {
  return `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})`;
}

function hash2D(a, b) {
  const value = Math.sin(a * 127.1 + b * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function pathRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

function renderGameToText() {
  const buildings = [];
  for (const tile of state.map) {
    if (tile.building) {
      buildings.push({
        x: tile.x,
        y: tile.y,
        terrain: tile.terrain,
        type: tile.building.id,
        efficiency: Number((tile.building.efficiency || 1).toFixed(2)),
      });
    }
  }

  return JSON.stringify({
    coordinateSystem: "odd-q hex grid origin top-left, x right, y down",
    mode: state.mode,
    paused: state.paused,
    speed: state.speed,
    timeSeconds: Number(state.timeSeconds.toFixed(2)),
    camera: {
      x: Number(state.camera.x.toFixed(2)),
      y: Number(state.camera.y.toFixed(2)),
      zoom: Number(state.camera.zoom.toFixed(2)),
    },
    hoverTile: pointerState.hoverTile,
    selectedBuildingId: state.selectedBuildingId,
    event: {
      type: state.event.type,
      timer: Number(state.event.timer.toFixed(2)),
      nextEventIn: Number(state.event.nextEventIn.toFixed(2)),
    },
    resources: {
      energy: Number(state.resources.energy.toFixed(2)),
      metals: Number(state.resources.metals.toFixed(2)),
      waterIce: Number(state.resources.waterIce.toFixed(2)),
      carbon: Number(state.resources.carbon.toFixed(2)),
      science: Number(state.resources.science.toFixed(2)),
    },
    stats: {
      temperature: Number(state.stats.temperature.toFixed(2)),
      pressure: Number(state.stats.pressure.toFixed(2)),
      oxygen: Number(state.stats.oxygen.toFixed(2)),
      biomass: Number(state.stats.biomass.toFixed(2)),
      population: Number(state.stats.population.toFixed(2)),
      capacity: state.colony.capacity,
      criticalTimer: Number(state.colony.criticalTimer.toFixed(2)),
      winTimer: Number(state.colony.winTimer.toFixed(2)),
    },
    buildingCounts: { ...state.counts },
    buildings,
    latestLog: state.logs[0] ? state.logs[0].message : null,
  });
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  if (typeof ms !== "number" || ms <= 0) {
    draw();
    return;
  }

  const seconds = ms / 1000;
  if (state.mode === "playing") {
    updateCameraFromKeys(seconds);
    if (!state.paused) {
      advanceSimulation(seconds * state.speed);
      syncUi();
    }
  }

  draw();
};
