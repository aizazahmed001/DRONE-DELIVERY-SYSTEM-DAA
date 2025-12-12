/**
 * DRONE DELIVERY SYSTEM - MAIN APPLICATION
 * Handles UI, map visualization, and user interactions
 */

// Global variables
let map;
let optimizer;
let baseMarker;
let zoneMarkers = [];
let routePolylines = [];
let isAddingZone = false;

// Location presets
const locationPresets = {
    pakistan: { lat: 34.0151, lng: 73.0169, zoom: 9, name: '2005 Earthquake Region (Muzaffarabad)' },
    islamabad: { lat: 33.6844, lng: 73.0479, zoom: 12, name: 'Islamabad' },
    lahore: { lat: 31.5204, lng: 74.3587, zoom: 12, name: 'Lahore' },
    karachi: { lat: 24.8607, lng: 67.0011, zoom: 12, name: 'Karachi' },
    custom: { lat: 33.6844, lng: 73.0479, zoom: 10, name: 'Custom Location' }
};

// Color schemes for different priorities and drones
const priorityColors = {
    1: '#dc2626', // Critical - Red
    2: '#f59e0b', // Moderate - Yellow
    3: '#10b981' // Low - Green
};

const droneColors = [
    '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#65a30d',
    '#0891b2', '#4f46e5', '#be123c', '#c026d3', '#0d9488'
];

/**
 * Initialize the application
 */
document.addEventListener('DOMContentLoaded', function() {
    initializeMap();
    initializeOptimizer();
    attachEventListeners();

    // Load default location
    changeLocation('pakistan');

    // Show welcome message
    showToast('Welcome! Select a disaster area and configure your drone fleet.', 'info');
});

/**
 * Initialize Leaflet map
 */
function initializeMap() {
    map = L.map('map', {
        center: [34.0151, 73.0169],
        zoom: 9,
        zoomControl: true
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(map);

    // Add click handler for manual zone addition
    map.on('click', onMapClick);
}

/**
 * Initialize optimizer
 */
function initializeOptimizer() {
    optimizer = new DroneDeliveryOptimizer();
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
    document.getElementById('locationSelect').addEventListener('change', function() {
        changeLocation(this.value);
    });

    document.getElementById('generateZones').addEventListener('click', generateRandomZones);
    document.getElementById('optimizeBtn').addEventListener('click', optimizeRoutes);
    document.getElementById('clearBtn').addEventListener('click', clearAll);
}

/**
 * Change location on map
 */
function changeLocation(locationKey) {
    const location = locationPresets[locationKey];
    map.setView([location.lat, location.lng], location.zoom);

    // Clear existing markers and set new base
    clearAll();
    setBaseLocation(location.lat, location.lng);

    showToast(`Location changed to ${location.name}`, 'success');
}

/**
 * Set base location
 */
function setBaseLocation(lat, lng) {
    // Remove old base marker
    if (baseMarker) {
        map.removeLayer(baseMarker);
    }

    // Create base marker
    const baseIcon = L.divIcon({
        className: 'base-marker',
        html: '<div style="font-size: 2rem;">🏠</div>',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });

    baseMarker = L.marker([lat, lng], {
        icon: baseIcon,
        draggable: false
    }).addTo(map);

    baseMarker.bindPopup(`
        <div style="text-align: center;">
            <h3 style="margin: 0 0 8px 0; color: #2563eb;">🚁 Drone Base</h3>
            <p style="margin: 4px 0; font-size: 0.9rem;"><strong>Coordinates:</strong></p>
            <p style="margin: 0; font-size: 0.85rem;">${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
        </div>
    `);

    // Set base in optimizer
    optimizer.setBase(lat, lng);
}

/**
 * Generate random zones around base
 */
function generateRandomZones() {
    const numZones = parseInt(document.getElementById('numZones').value);

    if (!baseMarker) {
        showToast('Please select a location first!', 'error');
        return;
    }

    // Clear existing zones
    clearZones();

    const baseLatLng = baseMarker.getLatLng();
    const priorities = [1, 1, 1, 2, 2, 2, 2, 3, 3, 3]; // 30% critical, 40% moderate, 30% low

    for (let i = 0; i < numZones; i++) {
        // Generate random position within radius (5-20 km from base)
        const angle = Math.random() * 2 * Math.PI;
        const radius = (Math.random() * 0.15) + 0.05; // 5-20 km in degrees

        const lat = baseLatLng.lat + (radius * Math.cos(angle));
        const lng = baseLatLng.lng + (radius * Math.sin(angle));

        const priority = priorities[Math.floor(Math.random() * priorities.length)];
        const demand = Math.floor(Math.random() * 40) + 20; // 20-60 units

        addZone(lat, lng, priority, demand);
    }

    showToast(`Generated ${numZones} random zones`, 'success');
}

/**
 * Handle map click for manual zone addition
 */
function onMapClick(e) {
    const priority = parseInt(document.getElementById('zonePriority').value);
    const demand = parseInt(document.getElementById('zoneDemand').value);

    addZone(e.latlng.lat, e.latlng.lng, priority, demand);
    showToast(`Zone added: Priority ${priority}, Demand ${demand} units`, 'success');
}

/**
 * Add a zone to map and optimizer
 */
function addZone(lat, lng, priority, demand) {
    // Create zone object
    const zone = new Zone(0, priority, demand, lat, lng); // ID will be assigned by optimizer

    // Add to optimizer
    optimizer.addZone(zone);

    // Create marker
    const color = priorityColors[priority];
    const markerIcon = L.divIcon({
        className: 'zone-marker',
        html: `<div style="
            background-color: ${color};
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        "></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(map);

    const priorityText = priority === 1 ? '🔴 Critical' : priority === 2 ? '🟡 Moderate' : '🟢 Low';
    marker.bindPopup(`
        <div>
            <h3 style="margin: 0 0 8px 0; color: ${color};">Relief Zone</h3>
            <p style="margin: 4px 0;"><strong>Priority:</strong> ${priorityText}</p>
            <p style="margin: 4px 0;"><strong>Demand:</strong> ${demand} units</p>
            <p style="margin: 4px 0; font-size: 0.85rem;"><strong>Location:</strong> ${lat.toFixed(4)}, ${lng.toFixed(4)}</p>
        </div>
    `);

    zoneMarkers.push({ marker, zone });
}

/**
 * Optimize routes using the algorithm
 */
async function optimizeRoutes() {
    if (!baseMarker) {
        showToast('Please set a base location first!', 'error');
        return;
    }

    if (optimizer.zones.length <= 1) {
        showToast('Please add some zones first!', 'error');
        return;
    }

    // Clear previous routes
    clearRoutes();

    // Show loading
    document.getElementById('loadingOverlay').style.display = 'flex';

    // Get drone configuration
    const numDrones = parseInt(document.getElementById('numDrones').value);
    const batteryCapacity = parseFloat(document.getElementById('batteryCapacity').value);
    const payloadCapacity = parseInt(document.getElementById('payloadCapacity').value);

    // Clear old drones and add new ones
    optimizer.drones = [];
    for (let i = 1; i <= numDrones; i++) {
        optimizer.addDrone(new Drone(i, batteryCapacity, payloadCapacity));
    }

    // Small delay to show loading animation
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        // Run optimization
        const results = optimizer.optimize();

        // Hide loading
        document.getElementById('loadingOverlay').style.display = 'none';

        // Display results
        displayResults(results);
        visualizeRoutes(results);
        updateStats(results);

        showToast('Routes optimized successfully!', 'success');
    } catch (error) {
        console.error('Optimization error:', error);
        document.getElementById('loadingOverlay').style.display = 'none';
        showToast('Error during optimization. Check console.', 'error');
    }
}

/**
 * Display optimization results
 */
function displayResults(results) {
    const resultsCard = document.getElementById('resultsCard');
    const resultsContent = document.getElementById('resultsContent');

    resultsCard.style.display = 'block';
    resultsContent.innerHTML = '';

    // Display each drone's route
    results.drones.forEach((drone, idx) => {
        const droneDiv = document.createElement('div');
        droneDiv.className = 'drone-result';

        const routePath = drone.route.map(zone => {
            if (zone.id === 0) return 'Base';
            return `Zone${zone.id}(P${zone.priority})`;
        }).join(' → ');

        droneDiv.innerHTML = `
            <h4 style="color: ${droneColors[idx % droneColors.length]};">
                🚁 Drone ${drone.id}
            </h4>
            <div class="route-info">
                <p><strong>Distance:</strong> <span>${drone.totalDistance.toFixed(2)} km</span></p>
                <p><strong>Battery Usage:</strong> <span>${drone.batteryUsage}%</span></p>
                <div class="battery-bar">
                    <div class="battery-fill" style="width: ${drone.batteryUsage}%"></div>
                </div>
                <p><strong>Supplies Delivered:</strong> <span>${drone.totalDelivered} units</span></p>
                <p><strong>Zones Visited:</strong> <span>${drone.route.length - 1}</span></p>
            </div>
            <div class="route-path">
                ${routePath}
            </div>
        `;

        resultsContent.appendChild(droneDiv);
    });

    // Add summary
    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'summary-section';
    summaryDiv.innerHTML = `
        <h4>📊 Summary</h4>
        <div class="summary-grid">
            <div class="summary-item">
                <span class="label">Total Zones</span>
                <span class="value">${results.summary.totalZones}</span>
            </div>
            <div class="summary-item">
                <span class="label">Zones Served</span>
                <span class="value">${results.summary.zonesServed}</span>
            </div>
            <div class="summary-item">
                <span class="label">Critical (P1)</span>
                <span class="value">${results.summary.criticalServed}/${results.summary.totalCritical}</span>
            </div>
            <div class="summary-item">
                <span class="label">Moderate (P2)</span>
                <span class="value">${results.summary.moderateServed}/${results.summary.totalModerate}</span>
            </div>
            <div class="summary-item">
                <span class="label">Low (P3)</span>
                <span class="value">${results.summary.lowServed}/${results.summary.totalLow}</span>
            </div>
            <div class="summary-item">
                <span class="label">Total Distance</span>
                <span class="value">${results.summary.totalDistance} km</span>
            </div>
        </div>
    `;

    resultsContent.appendChild(summaryDiv);
}

/**
 * Visualize routes on map
 */
function visualizeRoutes(results) {
    clearRoutes();

    results.drones.forEach((drone, idx) => {
        if (drone.route.length < 2) return;

        const color = droneColors[idx % droneColors.length];
        const coordinates = drone.route.map(zone => [zone.lat, zone.lng]);

        // Add return to base
        coordinates.push([optimizer.baseLocation.lat, optimizer.baseLocation.lng]);

        // Create polyline
        const polyline = L.polyline(coordinates, {
            color: color,
            weight: 3,
            opacity: 0.7,
            dashArray: '10, 5'
        }).addTo(map);

        polyline.bindPopup(`
            <div style="text-align: center;">
                <h3 style="margin: 0 0 8px 0; color: ${color};">Drone ${drone.id} Route</h3>
                <p style="margin: 4px 0;"><strong>Distance:</strong> ${drone.totalDistance.toFixed(2)} km</p>
                <p style="margin: 4px 0;"><strong>Zones:</strong> ${drone.route.length - 1}</p>
            </div>
        `);

        routePolylines.push(polyline);

        // Add directional arrows
        addDirectionalArrows(coordinates, color);
    });

    // Update zone markers to show served status
    updateZoneMarkers(results);
}

/**
 * Add directional arrows to route
 */
function addDirectionalArrows(coordinates, color) {
    for (let i = 0; i < coordinates.length - 1; i++) {
        const midLat = (coordinates[i][0] + coordinates[i + 1][0]) / 2;
        const midLng = (coordinates[i][1] + coordinates[i + 1][1]) / 2;

        const arrowIcon = L.divIcon({
            className: 'arrow-marker',
            html: `<div style="color: ${color}; font-size: 16px; transform: rotate(${calculateAngle(coordinates[i], coordinates[i + 1])}deg);">➤</div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        const arrow = L.marker([midLat, midLng], { icon: arrowIcon }).addTo(map);
        routePolylines.push(arrow);
    }
}

/**
 * Calculate angle between two points
 */
function calculateAngle(from, to) {
    const dx = to[1] - from[1];
    const dy = to[0] - from[0];
    return Math.atan2(dy, dx) * (180 / Math.PI) + 90;
}

/**
 * Update zone markers to show served status
 */
function updateZoneMarkers(results) {
    const servedZones = new Set();
    results.drones.forEach(drone => {
        drone.routeIndices.forEach(idx => {
            if (idx !== 0) servedZones.add(idx - 1); // Adjust for base at index 0
        });
    });

    zoneMarkers.forEach((item, idx) => {
        if (servedZones.has(idx)) {
            item.marker.setOpacity(1);
        } else {
            item.marker.setOpacity(0.4);
        }
    });
}

/**
 * Update statistics bar
 */
function updateStats(results) {
    const statsBar = document.getElementById('statsBar');
    statsBar.style.display = 'flex';

    document.getElementById('execTime').textContent = `${results.summary.executionTime} ms`;
    document.getElementById('totalDist').textContent = `${results.summary.totalDistance} km`;
    document.getElementById('zonesServed').textContent = `${results.summary.zonesServed}/${results.summary.totalZones}`;
    document.getElementById('criticalServed').textContent = `${results.summary.criticalServed}/${results.summary.totalCritical}`;
    document.getElementById('batteryUsage').textContent = `${results.summary.avgBatteryUsage}%`;
}

/**
 * Clear all routes from map
 */
function clearRoutes() {
    routePolylines.forEach(item => map.removeLayer(item));
    routePolylines = [];
}

/**
 * Clear all zones
 */
function clearZones() {
    zoneMarkers.forEach(item => map.removeLayer(item.marker));
    zoneMarkers = [];

    // Keep only base in optimizer
    if (optimizer.zones.length > 0) {
        const base = optimizer.zones[0];
        optimizer.zones = [base];
    }
}

/**
 * Clear everything
 */
function clearAll() {
    clearRoutes();
    clearZones();

    if (baseMarker) {
        map.removeLayer(baseMarker);
        baseMarker = null;
    }

    optimizer.clear();

    document.getElementById('resultsCard').style.display = 'none';
    document.getElementById('statsBar').style.display = 'none';

    showToast('All data cleared', 'info');
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = 'toast';

    const colors = {
        success: '#22c55e',
        error: '#ef4444',
        info: '#2563eb',
        warning: '#f59e0b'
    };

    toast.style.borderLeft = `4px solid ${colors[type]}`;
    toast.innerHTML = `<p style="margin: 0;">${message}</p>`;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}