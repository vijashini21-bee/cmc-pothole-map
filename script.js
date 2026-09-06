// ---- 1. Initialize the map, centered on CMC ----
const map = L.map('map').setView([6.9271, 79.8612], 12);

// Basic OpenStreetMap background tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);


// ---- 2. Color function for the DSD/GND gradient ----
// Takes a damage_score (0-10) and returns a color.
// Low score = light yellow, high score = dark red.
function getColor(score) {
  return score > 8 ? '#800026' :
         score > 6 ? '#BD0026' :
         score > 4 ? '#E31A1C' :
         score > 2 ? '#FD8D3C' :
         score > 0 ? '#FED976' :
                      '#FFEDA0';
}

function styleDSD(feature) {
  return {
    fillColor: getColor(feature.properties.damage_score),
    weight: 1,
    opacity: 1,
    color: '#555',
    fillOpacity: 0.6
  };
}


// ---- 3. Load the DSD/GND gradient layer ----
// Put your exported GeoJSON file at: data/dsd.geojson
fetch('data/dsd.geojson')
  .then(response => {
    if (!response.ok) throw new Error('dsd.geojson not found in data/ folder');
    return response.json();
  })
  .then(data => {
    L.geoJSON(data, {
      style: styleDSD,
      onEachFeature: function (feature, layer) {
        const name = feature.properties.name || 'Unnamed area';
        const score = feature.properties.damage_score;
        layer.bindPopup(`<b>${name}</b><br>Damage score: ${score}`);
      }
    }).addTo(map);
  })
  .catch(err => console.error('Error loading DSD layer:', err));


// ---- 4. Load the road network layer ----
// Put your exported GeoJSON file at: data/roads.geojson
fetch('data/roads.geojson')
  .then(response => {
    if (!response.ok) throw new Error('roads.geojson not found in data/ folder');
    return response.json();
  })
  .then(data => {
    L.geoJSON(data, {
      style: {
        color: '#666',
        weight: 1
      }
    }).addTo(map);
  })
  .catch(err => console.error('Error loading roads layer:', err));


// ---- Baseline pothole points and public reporting will be added here in Day 2 ----
