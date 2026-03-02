// ============================================
// HARAZIMIYYA FORUM - MAP DASHBOARD
// Only Admin Can Add/Edit Locations
// Members Can View All Locations
// ============================================

// Global variables
let map;
let markers = [];
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let allLocations = [];
let allMembers = [];
let selectedLocationId = null;
let previewMap = null;
let previewMarker = null;
let touchTimer = null;

// Nigeria states for filter
const nigeriaStates = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno",
  "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe",
  "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi", "Kogi", "Kwara",
  "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau",
  "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara"
];

// DOM Elements
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const logoutBtn = document.getElementById("logoutBtn");
const addLocationBtn = document.getElementById("addLocationBtn");
const locationModal = document.getElementById("locationModal");
const closeLocationBtn = document.getElementById("closeLocationBtn");
const saveLocationBtn = document.getElementById("saveLocationBtn");
const deleteModal = document.getElementById("deleteModal");
const confirmDeleteBtn = document.getElementById("confirmDeleteBtn");
const cancelDeleteBtn = document.getElementById("cancelDeleteBtn");
const searchInput = document.getElementById("searchInput");
const stateFilter = document.getElementById("stateFilter");
const dateFilter = document.getElementById("dateFilter");
const locationsList = document.getElementById("locationsList");
const locationsCount = document.getElementById("locationsCount");
const adminActions = document.getElementById("adminActions");
const hostSelect = document.getElementById("hostSelect");
const mapCard = document.querySelector(".map-card");

// Modal input fields
const modalTitle = document.getElementById("modalTitle");
const locationTitle = document.getElementById("locationTitle");
const locationDescription = document.getElementById("locationDescription");
const locationState = document.getElementById("locationState");
const locationAddress = document.getElementById("locationAddress");
const locationLat = document.getElementById("locationLat");
const locationLng = document.getElementById("locationLng");
const programDate = document.getElementById("programDate");
const startTime = document.getElementById("startTime");
const endTime = document.getElementById("endTime");

// ================= SIDEBAR TOGGLE =================
openSidebar.onclick = () => {
  sidebar.classList.add("active");
  overlay.classList.add("active");
};

closeSidebar.onclick = () => {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
};

overlay.onclick = () => {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
};

// ================= ZOOM CONTROLS TOUCH HANDLER =================
function setupTouchZoom() {
  if (!mapCard) return;

  // Show controls on touch
  mapCard.addEventListener("touchstart", () => {
    mapCard.classList.add("touch-active");
    
    // Clear previous timer
    if (touchTimer) clearTimeout(touchTimer);
  });

  // Hide controls after touch ends
  mapCard.addEventListener("touchend", () => {
    touchTimer = setTimeout(() => {
      mapCard.classList.remove("touch-active");
    }, 2000);
  });

  mapCard.addEventListener("touchcancel", () => {
    touchTimer = setTimeout(() => {
      mapCard.classList.remove("touch-active");
    }, 2000);
  });

  // Also handle mouse for desktop
  mapCard.addEventListener("mouseenter", () => {
    mapCard.classList.add("touch-active");
  });

  mapCard.addEventListener("mouseleave", () => {
    mapCard.classList.remove("touch-active");
  });
}

// ================= INITIALIZATION =================
async function init() {
  try {
    // Check if user is logged in
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.log("No user found, redirecting to login");
      window.location.href = "../index.html";
      return;
    }

    currentUser = user;
    console.log("Current user:", user.email);

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Profile error:", profileError);
      return;
    }

    currentProfile = profile;
    isAdmin = profile.role === "admin";
    console.log("Is admin:", isAdmin);

    // Show admin actions if admin
    if (isAdmin && adminActions) {
      adminActions.style.display = "block";
    }

    // Load members for host selection (only for admin)
    if (isAdmin) {
      await loadMembers();
    }

    // Initialize map with zoom limits
    initMainMap();

    // Setup touch zoom controls
    setupTouchZoom();

    // Load locations
    await loadLocations();

    // Setup event listeners
    setupEventListeners();

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

// ================= LOAD MEMBERS (for admin) =================
async function loadMembers() {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, state")
      .eq("is_approved", true)
      .order("full_name");

    if (error) throw error;
    
    allMembers = data || [];
    
    // Populate host select dropdown
    hostSelect.innerHTML = '<option value="">Select a member...</option>';
    allMembers.forEach(member => {
      hostSelect.innerHTML += `<option value="${member.id}">${member.full_name} (${member.state || 'State not set'})</option>`;
    });

  } catch (err) {
    console.error("Error loading members:", err);
  }
}

// ================= INIT MAIN MAP =================
function initMainMap() {
  // Center on Nigeria with zoom limits
  map = L.map("map", {
    center: [9.0820, 8.6753],
    zoom: 6,
    minZoom: 5,
    maxZoom: 18,
    zoomControl: true,
    fadeAnimation: true,
    zoomAnimation: true
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 18,
    minZoom: 5
  }).addTo(map);
}

// ================= CREATE SAMPLE LOCATIONS =================
async function createSampleLocations() {
  console.log("Creating sample locations...");
  
  // Get admin user for host_id
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .single();
  
  if (!adminProfile) {
    console.log("No admin found for sample data");
    return [];
  }
  
  const sampleLocations = [
    {
      title: "Weekly Moulud - Kano Central",
      description: "Weekly remembrance gathering at Kano Central Mosque",
      state: "Kano",
      address: "Kano Central Mosque, Kano",
      latitude: 12.0023,
      longitude: 8.5921,
      host_id: adminProfile.id,
      program_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_time: "19:00",
      end_time: "21:00"
    },
    {
      title: "Zikr Session - Lagos",
      description: "Evening zikr and spiritual gathering",
      state: "Lagos",
      address: "Ikeja, Lagos",
      latitude: 6.5244,
      longitude: 3.3792,
      host_id: adminProfile.id,
      program_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_time: "18:30",
      end_time: "20:30"
    },
    {
      title: "Friday Sermon - Abuja",
      description: "Weekly Friday sermon and gathering",
      state: "FCT",
      address: "Central Area, Abuja",
      latitude: 9.0765,
      longitude: 7.3986,
      host_id: adminProfile.id,
      program_date: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_time: "13:00",
      end_time: "14:30"
    },
    {
      title: "Moulud Celebration - Kaduna",
      description: "Special Moulud celebration with community",
      state: "Kaduna",
      address: "Kaduna Township",
      latitude: 10.5264,
      longitude: 7.4388,
      host_id: adminProfile.id,
      program_date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_time: "20:00",
      end_time: "22:00"
    },
    {
      title: "Islamic Lecture - Sokoto",
      description: "Educational lecture on spiritual growth",
      state: "Sokoto",
      address: "Sokoto City Center",
      latitude: 13.0059,
      longitude: 5.2476,
      host_id: adminProfile.id,
      program_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      start_time: "16:00",
      end_time: "18:00"
    }
  ];
  
  try {
    // Insert sample locations
    const { data, error } = await supabase
      .from("locations")
      .insert(sampleLocations)
      .select();
    
    if (error) {
      console.log("Sample data may already exist:", error.message);
      return [];
    }
    
    console.log("Sample locations created:", data);
    return data || [];
    
  } catch (err) {
    console.error("Error creating sample locations:", err);
    return [];
  }
}

// ================= LOAD LOCATIONS =================
async function loadLocations() {
  try {
    // Try to get locations from database
    const { data, error } = await supabase
      .from("locations")
      .select(`
        *,
        host:profiles!host_id(full_name, state, email)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading locations:", error);
      
      // If table doesn't exist or no data, show empty state
      if (error.code === '42P01') { // Table doesn't exist
        locationsList.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-map-marked-alt"></i>
            <h3>No Locations Yet</h3>
            <p>${isAdmin ? 'Click "Add Location" to create the first location' : 'Check back later for updates'}</p>
          </div>
        `;
        return;
      }
      
      throw error;
    }

    // If no locations exist and user is admin, offer to create sample data
    if ((!data || data.length === 0) && isAdmin) {
      locationsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-map-marked-alt"></i>
          <h3>No Locations Yet</h3>
          <p>Click "Add Location" to create your first program location.</p>
          <button id="createSampleBtn" class="primary-btn" style="margin-top: 15px;">
            <i class="fas fa-magic"></i> Create Sample Locations
          </button>
        </div>
      `;
      
      // Add event listener for sample button
      const createSampleBtn = document.getElementById('createSampleBtn');
      if (createSampleBtn) {
        createSampleBtn.onclick = async () => {
          createSampleBtn.disabled = true;
          createSampleBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
          
          const samples = await createSampleLocations();
          if (samples.length > 0) {
            await loadLocations(); // Reload
          } else {
            createSampleBtn.disabled = false;
            createSampleBtn.innerHTML = '<i class="fas fa-magic"></i> Create Sample Locations';
            alert('Sample locations already exist or could not be created.');
          }
        };
      }
      return;
    }

    allLocations = data || [];
    console.log("Locations loaded:", allLocations.length);
    
    // Update states filter
    updateStateFilter();
    
    // Update locations list
    filterAndDisplayLocations();
    
    // Update markers on map
    updateMapMarkers();

  } catch (err) {
    console.error("Error loading locations:", err);
    locationsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Locations</h3>
        <p>Please try again later</p>
        <small>${err.message}</small>
      </div>
    `;
  }
}

// ================= UPDATE STATE FILTER =================
function updateStateFilter() {
  // Get unique states from locations
  const states = [...new Set(allLocations.map(loc => loc.state).filter(Boolean))];
  
  // If no states, use all Nigeria states
  const options = states.length > 0 ? states : nigeriaStates;
  
  stateFilter.innerHTML = '<option value="">All States</option>';
  options.sort().forEach(state => {
    stateFilter.innerHTML += `<option value="${state}">${state}</option>`;
  });
}

// ================= FILTER AND DISPLAY LOCATIONS =================
function filterAndDisplayLocations() {
  const searchTerm = searchInput?.value.toLowerCase() || "";
  const selectedState = stateFilter?.value || "";
  const selectedDate = dateFilter?.value || "all";

  let filtered = allLocations;

  // Apply search filter
  if (searchTerm) {
    filtered = filtered.filter(loc => 
      loc.title?.toLowerCase().includes(searchTerm) ||
      loc.state?.toLowerCase().includes(searchTerm) ||
      (loc.host?.full_name?.toLowerCase() || "").includes(searchTerm) ||
      loc.address?.toLowerCase().includes(searchTerm)
    );
  }

  // Apply state filter
  if (selectedState) {
    filtered = filtered.filter(loc => loc.state === selectedState);
  }

  // Apply date filter
  if (selectedDate !== "all") {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    filtered = filtered.filter(loc => {
      if (!loc.program_date) return false;
      
      const progDate = new Date(loc.program_date);
      progDate.setHours(0, 0, 0, 0);
      
      switch(selectedDate) {
        case "today":
          return progDate.getTime() === today.getTime();
        case "tomorrow":
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          return progDate.getTime() === tomorrow.getTime();
        case "week":
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          return progDate >= today && progDate <= nextWeek;
        case "month":
          const nextMonth = new Date(today);
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          return progDate >= today && progDate <= nextMonth;
        default:
          return true;
      }
    });
  }

  // Update count
  if (locationsCount) {
    locationsCount.textContent = `${filtered.length} location${filtered.length !== 1 ? 's' : ''}`;
  }

  // Display locations
  displayLocationsList(filtered);
}

// ================= DISPLAY LOCATIONS LIST =================
function displayLocationsList(locations) {
  if (!locationsList) return;

  if (!locations || locations.length === 0) {
    locationsList.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-map-marked-alt"></i>
        <p>No locations match your filters</p>
        <small>Try adjusting your search criteria</small>
      </div>
    `;
    return;
  }

  let html = "";
  locations.forEach(loc => {
    const date = loc.program_date ? new Date(loc.program_date).toLocaleDateString() : "Date TBA";
    const time = loc.start_time ? loc.start_time.substring(0, 5) : "";
    const hostName = loc.host?.full_name || "Unknown";
    
    html += `
      <div class="location-item ${isAdmin ? 'admin-controls' : ''}" onclick="focusOnLocation('${loc.id}')">
        <div class="location-header">
          <h4>${loc.title}</h4>
          ${loc.program_date ? '<span class="location-badge"><i class="fas fa-calendar"></i> ' + date + '</span>' : ''}
        </div>
        
        <div class="location-details">
          <p><i class="fas fa-map-pin"></i> ${loc.state || 'State not set'}${loc.address ? ' - ' + loc.address : ''}</p>
          ${time ? `<p><i class="fas fa-clock"></i> ${time}</p>` : ''}
          ${loc.description ? `<p><i class="fas fa-align-left"></i> ${loc.description}</p>` : ''}
        </div>
        
        <div class="location-host">
          <i class="fas fa-user"></i>
          <span>Hosted by: <strong>${hostName}</strong></span>
        </div>
        
        ${isAdmin ? `
          <div class="admin-actions">
            <button class="edit-btn" onclick="editLocation('${loc.id}'); event.stopPropagation();">
              <i class="fas fa-edit"></i>
            </button>
            <button class="delete-btn" onclick="confirmDelete('${loc.id}'); event.stopPropagation();">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        ` : ''}
      </div>
    `;
  });

  locationsList.innerHTML = html;
}

// ================= UPDATE MAP MARKERS =================
function updateMapMarkers() {
  // Clear existing markers
  markers.forEach(marker => map.removeLayer(marker));
  markers = [];

  if (!allLocations || allLocations.length === 0) {
    // Add a default marker for Nigeria if no locations
    const defaultMarker = L.marker([9.0820, 8.6753])
      .addTo(map)
      .bindPopup("<strong>Harazimiyya Forum</strong><br>Add locations to see them on the map");
    markers.push(defaultMarker);
    return;
  }

  allLocations.forEach(loc => {
    if (loc.latitude && loc.longitude) {
      const marker = L.marker([loc.latitude, loc.longitude])
        .addTo(map)
        .bindPopup(`
          <strong>${loc.title}</strong><br>
          <i class="fas fa-map-pin"></i> ${loc.state || ''}<br>
          <i class="fas fa-user"></i> Host: ${loc.host?.full_name || 'Unknown'}<br>
          ${loc.program_date ? `<i class="fas fa-calendar"></i> ${new Date(loc.program_date).toLocaleDateString()}` : ''}
        `);

      markers.push(marker);
    }
  });
}

// ================= FOCUS ON LOCATION =================
window.focusOnLocation = function(locationId) {
  const loc = allLocations.find(l => l.id === locationId);
  if (loc && loc.latitude && loc.longitude) {
    map.setView([loc.latitude, loc.longitude], 13);
    
    // Find and open the popup for this marker
    const marker = markers.find(m => 
      m.getLatLng().lat === loc.latitude && 
      m.getLatLng().lng === loc.longitude
    );
    if (marker) {
      marker.openPopup();
    }
  }
};

// ================= INIT PREVIEW MAP =================
function initPreviewMap(lat = 9.0820, lng = 8.6753) {
  if (previewMap) {
    previewMap.remove();
  }

  previewMap = L.map("mapPreview").setView([lat, lng], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '© OpenStreetMap'
  }).addTo(previewMap);

  // Add click handler to set coordinates
  previewMap.on("click", (e) => {
    locationLat.value = e.latlng.lat.toFixed(6);
    locationLng.value = e.latlng.lng.toFixed(6);
    
    if (previewMarker) {
      previewMap.removeLayer(previewMarker);
    }
    
    previewMarker = L.marker([e.latlng.lat, e.latlng.lng]).addTo(previewMap);
  });

  if (lat && lng) {
    previewMarker = L.marker([lat, lng]).addTo(previewMap);
  }
}

// ================= OPEN ADD MODAL =================
function openAddModal() {
  modalTitle.textContent = "Add Program Location";
  
  // Clear form
  locationTitle.value = "";
  locationDescription.value = "";
  locationState.value = "";
  locationAddress.value = "";
  locationLat.value = "";
  locationLng.value = "";
  programDate.value = "";
  startTime.value = "";
  endTime.value = "";
  hostSelect.value = "";
  
  selectedLocationId = null;
  
  // Initialize preview map
  setTimeout(() => initPreviewMap(), 100);
  
  locationModal.classList.remove("hidden");
}

// ================= EDIT LOCATION =================
window.editLocation = function(locationId) {
  const loc = allLocations.find(l => l.id === locationId);
  if (!loc) return;

  modalTitle.textContent = "Edit Location";
  
  // Fill form
  locationTitle.value = loc.title || "";
  locationDescription.value = loc.description || "";
  locationState.value = loc.state || "";
  locationAddress.value = loc.address || "";
  locationLat.value = loc.latitude || "";
  locationLng.value = loc.longitude || "";
  programDate.value = loc.program_date || "";
  startTime.value = loc.start_time || "";
  endTime.value = loc.end_time || "";
  hostSelect.value = loc.host_id || "";
  
  selectedLocationId = locationId;
  
  // Initialize preview map with existing coordinates
  setTimeout(() => initPreviewMap(loc.latitude || 9.0820, loc.longitude || 8.6753), 100);
  
  locationModal.classList.remove("hidden");
};

// ================= CONFIRM DELETE =================
window.confirmDelete = function(locationId) {
  selectedLocationId = locationId;
  deleteModal.classList.remove("hidden");
};

// ================= SAVE LOCATION =================
saveLocationBtn.onclick = async () => {
  // Validate required fields
  if (!locationTitle.value || !locationState.value || !locationLat.value || !locationLng.value || !hostSelect.value) {
    alert("Please fill in all required fields (Title, State, Coordinates, and Host)");
    return;
  }

  const locationData = {
    title: locationTitle.value,
    description: locationDescription.value || null,
    state: locationState.value,
    address: locationAddress.value || null,
    latitude: Number(locationLat.value),
    longitude: Number(locationLng.value),
    host_id: hostSelect.value,
    host_name: allMembers.find(m => m.id === hostSelect.value)?.full_name,
    program_date: programDate.value || null,
    start_time: startTime.value || null,
    end_time: endTime.value || null,
    is_active: true
  };

  try {
    let error;

    if (selectedLocationId) {
      // Update existing location
      ({ error } = await supabase
        .from("locations")
        .update(locationData)
        .eq("id", selectedLocationId));
    } else {
      // Insert new location
      ({ error } = await supabase
        .from("locations")
        .insert([locationData]));
    }

    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }

    // Close modal and refresh
    locationModal.classList.add("hidden");
    await loadLocations();

  } catch (err) {
    console.error("Error saving location:", err);
    alert("Error saving location: " + (err.message || "Permission denied"));
  }
};

// ================= CONFIRM DELETE =================
confirmDeleteBtn.onclick = async () => {
  if (!selectedLocationId) return;

  try {
    const { error } = await supabase
      .from("locations")
      .delete()
      .eq("id", selectedLocationId);

    if (error) throw error;

    deleteModal.classList.add("hidden");
    await loadLocations();

  } catch (err) {
    console.error("Error deleting location:", err);
    alert("Error deleting location: " + err.message);
  }
};

// ================= CLOSE MODALS =================
closeLocationBtn.onclick = () => {
  locationModal.classList.add("hidden");
};

cancelDeleteBtn.onclick = () => {
  deleteModal.classList.add("hidden");
  selectedLocationId = null;
};

// ================= SETUP EVENT LISTENERS =================
function setupEventListeners() {
  // Add location button
  if (addLocationBtn) {
    addLocationBtn.onclick = openAddModal;
  }

  // Search input
  if (searchInput) {
    searchInput.addEventListener("input", filterAndDisplayLocations);
  }

  // State filter
  if (stateFilter) {
    stateFilter.addEventListener("change", filterAndDisplayLocations);
  }

  // Date filter
  if (dateFilter) {
    dateFilter.addEventListener("change", filterAndDisplayLocations);
  }

  // Logout
  if (logoutBtn) {
    logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      window.location.href = "../index.html";
    };
  }

  // Close modal when clicking outside
  window.onclick = (e) => {
    if (e.target === locationModal) {
      locationModal.classList.add("hidden");
    }
    if (e.target === deleteModal) {
      deleteModal.classList.add("hidden");
    }
  };
}

// ================= START APPLICATION =================
init();