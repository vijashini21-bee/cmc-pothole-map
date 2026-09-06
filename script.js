// ---- 1. Map setup ----
const map = L.map('map').setView([6.9271, 79.8612], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
  maxZoom: 19
}).addTo(map);

map.createPane('roadsPane');
map.getPane('roadsPane').style.zIndex = 350;
map.createPane('dsdPane');
map.getPane('dsdPane').style.zIndex = 380;
map.createPane('pointsPane');
map.getPane('pointsPane').style.zIndex = 450;


// ---- 2. Infrastructure Index layer ----
function getColor(score) {
  if (score === null || score === undefined || score === '' || isNaN(score)) {
    return '#B2FF00'; // no data -> treat as Low
  }
  return score > 8 ? '#FF00A0' :
         score > 6 ? '#FF3D00' :
         score > 4 ? '#FF9100' :
         score > 2 ? '#FFEA00' :
                      '#B2FF00';
}

function styleDSD(feature) {
  return {
    fillColor: getColor(feature.properties.damage_sco),
    weight: 1,
    opacity: 1,
    color: '#111',
    fillOpacity: 0.55,
    pane: 'dsdPane'
  };
}

function getAreaName(props) {
  if (props.ADM4_EN && props.ADM4_EN.trim() !== '') return props.ADM4_EN;
  if (props.ADM3_EN && props.ADM3_EN.trim() !== '') return props.ADM3_EN + ' (DSD)';
  return 'Unnamed area';
}

fetch('data/dsd.geojson')
  .then(r => { if (!r.ok) throw new Error('dsd.geojson not found'); return r.json(); })
  .then(data => {
    L.geoJSON(data, {
      pane: 'dsdPane',
      style: styleDSD,
      onEachFeature: function (feature, layer) {
        const name = getAreaName(feature.properties);
        const rawScore = feature.properties.damage_sco;
        const score = (rawScore === null || rawScore === undefined || rawScore === '' || isNaN(rawScore))
          ? 'No data (treated as Low)'
          : rawScore;

        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
          const popupContent = `
            <div style="font-family:'Inter',sans-serif; min-width:180px;">
              <b>${name}</b><br>
              Infrastructure Index: ${score}
              <br><br>
              <button onclick="openReportFormAt(${e.latlng.lat}, ${e.latlng.lng})" style="cursor:pointer; width:100%; padding:6px; border-radius:6px; border:1px solid #ccc; background:#f5f5f5;">
                Report an issue here
              </button>
            </div>
          `;
          L.popup().setLatLng(e.latlng).setContent(popupContent).openOn(map);
        });
      }
    }).addTo(map);
  })
  .catch(err => console.error('Error loading DSD layer:', err));


// ---- 3. Roads ----
fetch('data/roads.geojson')
  .then(r => { if (!r.ok) throw new Error('roads.geojson not found'); return r.json(); })
  .then(data => {
    L.geoJSON(data, { pane: 'roadsPane', style: { color: '#999', weight: 1 } }).addTo(map);
  })
  .catch(err => console.error('Error loading roads layer:', err));


const typeSeverityColor = {
  'Pothole':          { Low: '#90CAF9', Medium: '#1E88E5', High: '#0D47A1' },
  'Damaged Pavement': { Low: '#A5D6A7', Medium: '#2E7D32', High: '#1B3B1E' },
  'Damaged Drainage': { Low: '#F48FB1', Medium: '#D81B60', High: '#880E4F' },
  'Damaged road':      { Low: '#FFCC80', Medium: '#EF6C00', High: '#8D4004' },
  'Other':            { Low: '#CE93D8', Medium: '#8E24AA', High: '#4A148C' }
};

function normalizeType(rawType) {
  const t = (rawType || '').toLowerCase();
  if (t.includes('pothole')) return 'Pothole';
  if (t.includes('pavement')) return 'Damaged Pavement';
  if (t.includes('drainage')) return 'Damaged Drainage';
  if (t.includes('road')) return 'Damaged road';
  return 'Other';
}

function getPointColor(type, severity) {
  const family = typeSeverityColor[normalizeType(type)];
  return family[severity] || family['Medium'];
}

fetch('data/points.geojson')
  .then(r => { if (!r.ok) throw new Error('points.geojson not found'); return r.json(); })
  .then(data => {
    L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          pane: 'pointsPane',
          radius: 8,
          fillColor: getPointColor(feature.properties.type, feature.properties.severity),
          color: '#fff',
          weight: 2,
          fillOpacity: 1
        });
      },
      onEachFeature: function (feature, layer) {
        const p = feature.properties;
        layer.on('click', function (e) {
          L.DomEvent.stopPropagation(e);
        });
        layer.bindPopup(`
          <b>${p.road_name}</b><br>
          Type: ${p.type}<br>
          Severity: ${p.severity}<br>
          <img src="${p.image}" width="180" style="margin-top:6px;border-radius:4px;"><br>
          <a href="${p.source}" target="_blank">View location on Google Maps</a>
        `);
      }
    }).addTo(map);
  })
  .catch(err => console.error('Error loading points layer:', err));


// ---- 5. Firebase ----
const firebaseConfig = {
  apiKey: "AIzaSyATLvNXAHru0h5USK2Li5i0iCVGd1FrPiA",
  authDomain: "proj-86565.firebaseapp.com",
  projectId: "proj-86565",
  storageBucket: "proj-86565.firebasestorage.app",
  messagingSenderId: "1000076077407",
  appId: "1:1000076077407:web:0d52bd733e9cc925dbeeea",
  measurementId: "G-JZP2GF49HR"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const storage = firebase.storage();


// ---- 6. Click-to-report ----
function showReportForm(lat, lng) {
  const formHtml = `
    <div style="min-width:210px; font-family:'Inter',sans-serif;">
      <b style="font-family:'Poppins',sans-serif;">Report an issue here</b><br><br>
      Type:<br>
      <select id="reportType" style="width:100%">
        <option value="Pothole">Pothole</option>
        <option value="Damaged Pavement">Damaged Pavement</option>
        <option value="Damaged Drainage">Damaged Drainage</option>
        <option value="Damaged road">Damaged road</option>
        <option value="Other">Other</option>
      </select><br><br>
      Severity:<br>
      <select id="reportSeverity" style="width:100%">
        <option value="Low">Low</option>
        <option value="Medium">Medium</option>
        <option value="High">High</option>
      </select><br><br>
      Description:<br>
      <textarea id="reportDesc" style="width:100%" rows="2"></textarea><br><br>
      Photo (optional):<br>
      <input type="file" id="reportPhoto" accept="image/*" style="width:100%"><br><br>
      <button id="reportSubmitBtn" onclick="submitReport(${lat}, ${lng})">Submit</button>
      <div id="reportStatus" style="margin-top:6px; font-size:12px; color:#666;"></div>
    </div>
  `;
  L.popup().setLatLng([lat, lng]).setContent(formHtml).openOn(map);
}

map.on('click', function (e) {
  showReportForm(e.latlng.lat, e.latlng.lng);
});

// Called from the "Report an issue here" button inside a DSD score popup
function openReportFormAt(lat, lng) {
  showReportForm(lat, lng);
}

function submitReport(lat, lng) {
  const type = document.getElementById('reportType').value;
  const severity = document.getElementById('reportSeverity').value;
  const description = document.getElementById('reportDesc').value;
  const photoInput = document.getElementById('reportPhoto');
  const photoFile = photoInput.files[0];
  const statusEl = document.getElementById('reportStatus');
  const submitBtn = document.getElementById('reportSubmitBtn');

  submitBtn.disabled = true;

  function saveReport(imageUrl) {
    db.collection('reports').add({
      lat, lng, type, severity, description,
      image: imageUrl || null,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => map.closePopup())
      .catch(err => {
        console.error('Error submitting report:', err);
        alert('Something went wrong.');
        submitBtn.disabled = false;
      });
  }

  if (photoFile) {
    if (statusEl) statusEl.textContent = 'Uploading photo...';
    const fileRef = storage.ref('report-photos/' + Date.now() + '_' + photoFile.name);
    fileRef.put(photoFile)
      .then(snapshot => snapshot.ref.getDownloadURL())
      .then(url => saveReport(url))
      .catch(err => {
        console.error('Error uploading photo:', err);
        alert('Photo upload failed. Submitting report without photo.');
        saveReport(null);
      });
  } else {
    saveReport(null);
  }
}

db.collection('reports').onSnapshot((snapshot) => {
  document.getElementById('reportCount').textContent = snapshot.size;
  snapshot.docChanges().forEach((change) => {
    if (change.type === 'added') {
      const r = change.doc.data();
      const marker = L.circleMarker([r.lat, r.lng], {
        pane: 'pointsPane',
        radius: 10,
        fillColor: getPointColor(r.type, r.severity),
        color: '#000',
        weight: 2,
        dashArray: '4,3',
        fillOpacity: 1
      });
      const photoHtml = r.image
        ? `<br><img src="${r.image}" width="180" style="margin-top:6px;border-radius:4px;">`
        : '';
      marker.bindPopup(`<b>Public Report</b><br>Type: ${r.type}<br>Severity: ${r.severity}<br>${r.description ? r.description + '<br>' : ''}${photoHtml}`);
      marker.addTo(map);
    }
  });
});


// ---- 7. Welcome overlay (once) ----
if (!localStorage.getItem('welcomeSeen')) {
  document.getElementById('welcomeOverlay').style.display = 'flex';
}
document.getElementById('welcomeClose').addEventListener('click', function () {
  document.getElementById('welcomeOverlay').style.display = 'none';
  localStorage.setItem('welcomeSeen', 'true');
  startTour();
});


// ---- 8. Guided tour: heading -> legend -> report count, one at a time, right-click to advance ----
const tourSteps = [
  { id: 'titleBar', text: 'This map tracks and reports pothole and infrastructure issues on roads within the CMC area. It combines a surveyed baseline with live public reporting.' },
  { id: 'legend', text: 'The Infrastructure Index shows which areas have better road infrastructure. Point types show reported infrastructure issues.' },
  { id: 'reportCounter', text: 'This shows how many issues the public has reported so far.' }
];
let tourIndex = 0;

function showTourStep(i) {
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));

  const target = document.getElementById(tourSteps[i].id);
  target.classList.add('tour-highlight');

  const rect = target.getBoundingClientRect();
  const card = document.getElementById('tourCard');
  card.textContent = tourSteps[i].text + ' (right-click to continue)';

  card.style.display = 'block';

  let left = rect.left;
  if (left + 260 > window.innerWidth) left = window.innerWidth - 270;
  if (left < 10) left = 10;

  const cardHeight = card.offsetHeight;
  const spaceBelow = window.innerHeight - rect.bottom;
  const spaceAbove = rect.top;

  let top;
  if (spaceBelow >= cardHeight + 14 || spaceBelow >= spaceAbove) {
    top = rect.bottom + 14;
    if (top + cardHeight > window.innerHeight - 10) top = window.innerHeight - cardHeight - 10;
    card.classList.remove('tour-card-arrow-down');
    card.classList.add('tour-card-arrow-up');
  } else {
    top = rect.top - cardHeight - 14;
    if (top < 10) top = 10;
    card.classList.remove('tour-card-arrow-up');
    card.classList.add('tour-card-arrow-down');
  }

  card.style.top = top + 'px';
  card.style.left = left + 'px';
}

function endTour() {
  document.querySelectorAll('.tour-highlight').forEach(el => el.classList.remove('tour-highlight'));
  document.getElementById('tourCard').style.display = 'none';
  localStorage.setItem('tourSeen', 'true');
  document.removeEventListener('contextmenu', advanceTour);
}

function advanceTour(e) {
  e.preventDefault();
  tourIndex++;
  if (tourIndex < tourSteps.length) {
    showTourStep(tourIndex);
  } else {
    endTour();
  }
}

function startTour() {
  if (localStorage.getItem('tourSeen')) return;
  tourIndex = 0;
  showTourStep(0);
  document.addEventListener('contextmenu', advanceTour);
}

if (localStorage.getItem('welcomeSeen') && !localStorage.getItem('tourSeen')) {
  startTour();
}
