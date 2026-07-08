const basemap = {
  version: 8,
  sources: {
    "carto-voyager": {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        "https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        "https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        "https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }
  },
  layers: [
    {
      id: "carto-voyager",
      type: "raster",
      source: "carto-voyager"
    }
  ]
};

const agesciMap = new maplibregl.Map({
  container: "map",
  style: basemap,
  center: [8.80, 45.82],
  zoom: 9.15,
  minZoom: 8,
  maxZoom: 17,
  attributionControl: false
});
window.agesciMap = agesciMap;
let activePopup = null;

agesciMap.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
agesciMap.addControl(new maplibregl.ScaleControl({ maxWidth: 110, unit: "metric" }), "bottom-left");
agesciMap.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function popupHtml(properties) {
  const name = properties.nome || "Gruppo AGESCI";
  const address = properties.indirizzo || "";
  const city = properties.citta || properties.comune || "";
  const site = properties.sito_web || properties.url || "";
  const logo = properties.logo || "https://www.agesci.it/wp-content/themes/agesci/img/logo50---POS.png";

  return `
    <div class="popup-group">
      <img class="popup-group-emblem" src="${escapeHtml(logo)}" alt="Logo ${escapeHtml(name)}">
      <div class="popup-title">${escapeHtml(name)}</div>
      ${(address || city) ? `<div class="popup-address">${address ? escapeHtml(address) : ""}${address && city ? "<br>" : ""}${city ? escapeHtml(city) : ""}</div>` : ""}
      ${site ? `<div class="popup-link"><a href="${escapeHtml(site)}" target="_blank" rel="noopener noreferrer">Apri sito del gruppo</a></div>` : ""}
    </div>
  `;
}

function markerElement(properties, popup) {
  const element = document.createElement("button");
  element.className = "group-marker";
  element.type = "button";
  element.setAttribute("aria-label", properties.nome || "Gruppo AGESCI");

  const dot = document.createElement("span");
  dot.className = "group-marker-dot";
  dot.setAttribute("aria-hidden", "true");

  const label = document.createElement("span");
  label.className = "group-marker-label";
  label.textContent = properties.nome || "Gruppo AGESCI";

  element.append(dot, label);
  dot.addEventListener("click", event => {
    event.stopPropagation();
    if (activePopup && activePopup !== popup) {
      activePopup.remove();
    }
    activePopup = popup;
    popup.addTo(agesciMap);
  });
  return element;
}

async function addBoundaryLayer() {
  if (document.documentElement.dataset.agesciBoundaryReady === "true") return;
  const response = await fetch("data/confine_zona.geojson");
  const boundary = await response.json();

  agesciMap.addSource("confine-zona", {
    type: "geojson",
    data: boundary
  });

  agesciMap.addLayer({
    id: "confine-zona-fill",
    type: "fill",
    source: "confine-zona",
    paint: {
      "fill-color": "#6a3d9a",
      "fill-opacity": 0
    }
  });

  agesciMap.addLayer({
    id: "confine-zona-line",
    type: "line",
    source: "confine-zona",
    paint: {
      "line-color": "#6a3d9a",
      "line-width": 2,
      "line-opacity": 0.75
    }
  });

  document.documentElement.dataset.agesciBoundaryReady = "true";
}

async function addGroupLayers() {
  if (document.documentElement.dataset.agesciGroupsReady === "true") return;
  const response = await fetch("data/gruppi_scout.geojson");
  const groups = await response.json();
  window.agesciGroupsData = groups;
  document.documentElement.dataset.agesciGroups = String(groups.features.length);
  document.documentElement.dataset.agesciGroupsReady = "true";

  const bounds = new maplibregl.LngLatBounds();
  groups.features.forEach(feature => {
    bounds.extend(feature.geometry.coordinates);
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true })
      .setLngLat(feature.geometry.coordinates)
      .setHTML(popupHtml(feature.properties || {}));
    popup.on("close", () => {
      if (activePopup === popup) activePopup = null;
    });

    new maplibregl.Marker({
      element: markerElement(feature.properties || {}, popup),
      anchor: "left",
      offset: [-8, 0]
    })
      .setLngLat(feature.geometry.coordinates)
      .addTo(agesciMap);
  });

  agesciMap.fitBounds(bounds, {
    padding: { top: 84, right: 42, bottom: 42, left: 42 },
    maxZoom: 10.5,
    duration: 0
  });
}

async function initializeMapLayers() {
  await addBoundaryLayer();
  await addGroupLayers();
}

if (agesciMap.loaded()) {
  initializeMapLayers();
} else {
  agesciMap.on("load", initializeMapLayers);
}
