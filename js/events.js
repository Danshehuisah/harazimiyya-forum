// ============================================
// HARAZIMIYYA FORUM - EVENTS DASHBOARD
// Admin: Create, Edit, Delete Events
// Members: View Events, RSVP
// ============================================

// Global variables
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let allEvents = [];
let currentTab = 'upcoming';
let selectedEventId = null;

// DOM Elements
const eventsContainer = document.getElementById("eventsContainer");
const createEventBtn = document.getElementById("createEventBtn");
const tabs = document.querySelectorAll(".tab");
const logoutBtn = document.getElementById("logoutBtn");

// Sidebar elements
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");

// Modal elements (will be created dynamically)
let eventModal = null;
let deleteModal = null;
let attendeesModal = null;

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

// ================= NOTIFICATION FUNCTION =================
function showNotification(message, type = 'success') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ================= CREATE MODALS =================
function createModals() {
  // Create Event Modal
  const modalHTML = `
    <div id="eventModal" class="modal hidden">
      <div class="modal-content">
        <h2 id="modalTitle">Create New Event</h2>
        
        <div class="form-group">
          <label><i class="fas fa-heading"></i> Event Title *</label>
          <input type="text" id="eventTitle" placeholder="e.g., Weekly Moulud at Kano" required>
        </div>
        
        <div class="form-group">
          <label><i class="fas fa-align-left"></i> Description</label>
          <textarea id="eventDescription" placeholder="Event details, program schedule..."></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label><i class="fas fa-calendar"></i> Date *</label>
            <input type="date" id="eventDate" required>
          </div>
          <div class="form-group">
            <label><i class="fas fa-clock"></i> Time</label>
            <input type="time" id="eventTime">
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label><i class="fas fa-map-pin"></i> Location *</label>
            <input type="text" id="eventLocation" placeholder="Venue name" required>
          </div>
          <div class="form-group">
            <label><i class="fas fa-map-marker-alt"></i> State</label>
            <input type="text" id="eventState" placeholder="e.g., Kano">
          </div>
        </div>
        
        <div class="form-group">
          <label><i class="fas fa-address-card"></i> Address</label>
          <input type="text" id="eventAddress" placeholder="Full address">
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label><i class="fas fa-users"></i> Max Attendees</label>
            <input type="number" id="eventMaxAttendees" placeholder="Optional" min="1">
          </div>
          <div class="form-group">
            <label><i class="fas fa-tag"></i> Status</label>
            <select id="eventStatus">
              <option value="upcoming">Upcoming</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
        
        <div class="modal-actions">
          <button id="saveEventBtn" class="primary-btn"><i class="fas fa-save"></i> Save Event</button>
          <button id="closeModalBtn" class="ghost-btn"><i class="fas fa-times"></i> Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  // Delete Modal
  const deleteModalHTML = `
    <div id="deleteModal" class="modal hidden">
      <div class="modal-content delete-modal">
        <i class="fas fa-exclamation-triangle" style="font-size: 48px;"></i>
        <h3>Delete Event?</h3>
        <p>This action cannot be undone. All RSVPs will be lost.</p>
        <div class="modal-actions">
          <button id="confirmDeleteBtn" class="primary-btn" style="background: #dc3545;">Delete</button>
          <button id="cancelDeleteBtn" class="ghost-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  // Attendees Modal
  const attendeesModalHTML = `
    <div id="attendeesModal" class="modal hidden">
      <div class="modal-content">
        <h2><i class="fas fa-users"></i> Event Attendees</h2>
        <div id="attendeesList" class="attendees-list"></div>
        <div class="modal-actions">
          <button id="closeAttendeesBtn" class="ghost-btn">Close</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  document.body.insertAdjacentHTML('beforeend', deleteModalHTML);
  document.body.insertAdjacentHTML('beforeend', attendeesModalHTML);
  
  eventModal = document.getElementById('eventModal');
  deleteModal = document.getElementById('deleteModal');
  attendeesModal = document.getElementById('attendeesModal');
  
  // Modal close buttons
  document.getElementById('closeModalBtn').onclick = () => {
    eventModal.classList.add('hidden');
  };
  
  document.getElementById('cancelDeleteBtn').onclick = () => {
    deleteModal.classList.add('hidden');
    selectedEventId = null;
  };
  
  document.getElementById('closeAttendeesBtn').onclick = () => {
    attendeesModal.classList.add('hidden');
  };
  
  // Save event button
  document.getElementById('saveEventBtn').onclick = saveEvent;
  
  // Confirm delete button
  document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === eventModal) eventModal.classList.add('hidden');
    if (e.target === deleteModal) deleteModal.classList.add('hidden');
    if (e.target === attendeesModal) attendeesModal.classList.add('hidden');
  });
}

// ================= INITIALIZATION =================
async function initEvents() {
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
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

    // Create modals
    createModals();

    // Show create button only for admin
    if (createEventBtn) {
      if (isAdmin) {
        createEventBtn.style.display = 'flex';
        createEventBtn.onclick = openCreateModal;
      } else {
        createEventBtn.style.display = 'none';
      }
    }

    // Setup tab listeners
    setupTabs();

    // Load events
    await loadEvents();

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

// ================= SETUP TABS =================
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      filterAndDisplayEvents();
    });
  });
}

// ================= LOAD EVENTS (FIXED VERSION) =================
async function loadEvents() {
  showSkeleton();
  
  try {
    // First, get all events (simple query)
    const { data: eventsData, error: eventsError } = await supabase
      .from("events")
      .select("*")
      .order("date", { ascending: true });

    if (eventsError) {
      console.error("Events query error:", eventsError);
      throw eventsError;
    }

    console.log("Events loaded:", eventsData);

    if (!eventsData || eventsData.length === 0) {
      eventsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-calendar-plus"></i>
          <h3>No Events Yet</h3>
          <p>${isAdmin ? 'Click "Create Event" to add your first event' : 'Check back later for upcoming events'}</p>
        </div>
      `;
      return;
    }

    // Get host profiles for each event
    const hostIds = [...new Set(eventsData.map(e => e.host_id))];
    
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", hostIds);

    if (profilesError) {
      console.error("Profiles query error:", profilesError);
    }

    // Create host map
    const hostMap = {};
    if (profiles) {
      profiles.forEach(p => {
        hostMap[p.id] = p;
      });
    }

    // Get attendance counts for each event
    const eventIds = eventsData.map(e => e.id);
    
    const { data: counts, error: countsError } = await supabase
      .from("event_attendees")
      .select("event_id, status")
      .in("event_id", eventIds);

    if (countsError) {
      console.error("Counts query error:", countsError);
    }

    // Calculate counts per event
    const attendeeCounts = {};
    if (counts) {
      counts.forEach(a => {
        if (!attendeeCounts[a.event_id]) {
          attendeeCounts[a.event_id] = { attending: 0, maybe: 0 };
        }
        if (a.status === 'attending') attendeeCounts[a.event_id].attending++;
        if (a.status === 'maybe') attendeeCounts[a.event_id].maybe++;
      });
    }

    // Combine data
    allEvents = eventsData.map(event => ({
      ...event,
      host: hostMap[event.host_id] || { full_name: 'Unknown', email: '' },
      attendees: [{ count: attendeeCounts[event.id]?.attending || 0 }]
    }));

    // Get attendance status for current user
    if (currentUser) {
      const { data: attendance } = await supabase
        .from("event_attendees")
        .select("event_id, status")
        .eq("user_id", currentUser.id);
      
      if (attendance) {
        window.userAttendance = {};
        attendance.forEach(a => {
          window.userAttendance[a.event_id] = a.status;
        });
      }
    }

    filterAndDisplayEvents();

  } catch (err) {
    console.error("Error loading events:", err);
    eventsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Events</h3>
        <p>Please try again later</p>
        <small>${err.message || 'Unknown error'}</small>
      </div>
    `;
  }
}

// ================= FILTER AND DISPLAY EVENTS =================
function filterAndDisplayEvents() {
  let filtered = [...allEvents];
  const now = new Date();
  
  // Apply tab filter
  filtered = filtered.filter(event => {
    const eventDate = new Date(event.date);
    
    switch(currentTab) {
      case 'upcoming':
        return eventDate >= now && event.status !== 'cancelled' && event.status !== 'completed';
      case 'past':
        return eventDate < now || event.status === 'completed' || event.status === 'cancelled';
      case 'mine':
        return event.host_id === currentUser.id;
      default:
        return true;
    }
  });
  
  displayEvents(filtered);
}

// ================= DISPLAY EVENTS =================
function displayEvents(events) {
  eventsContainer.innerHTML = "";

  if (!events || events.length === 0) {
    eventsContainer.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calendar-times"></i>
        <h3>No Events Found</h3>
        <p>${currentTab === 'upcoming' ? 'Check back later for upcoming events' : 
            currentTab === 'past' ? 'No past events to show' : 
            isAdmin ? 'Click "Create Event" to add your first event' : 'You haven\'t created any events'}</p>
      </div>
    `;
    return;
  }

  events.forEach(event => {
    const card = createEventCard(event);
    eventsContainer.appendChild(card);
  });
}

// ================= CREATE EVENT CARD =================
function createEventCard(event) {
  const card = document.createElement("div");
  card.className = `event-card ${event.status || 'upcoming'}`;
  
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  const isHost = event.host_id === currentUser.id;
  const userAttendStatus = window.userAttendance?.[event.id];
  const attendeeCount = event.attendees?.[0]?.count || 0;
  
  let attendButtonClass = 'attend-btn';
  let attendButtonText = '<i class="fas fa-calendar-check"></i> Attend';
  
  if (userAttendStatus === 'attending') {
    attendButtonClass += ' attending';
    attendButtonText = '<i class="fas fa-check"></i> Attending';
  } else if (userAttendStatus === 'maybe') {
    attendButtonClass += ' maybe';
    attendButtonText = '<i class="fas fa-clock"></i> Maybe';
  }
  
  card.innerHTML = `
    <div class="event-badge ${event.status || 'upcoming'}">${event.status || 'upcoming'}</div>
    <h3 class="event-title">${event.title}</h3>
    
    <div class="event-details">
      <div class="event-detail">
        <i class="fas fa-calendar"></i>
        <span class="label">Date:</span>
        <span class="value">${formattedDate} ${event.time ? 'at ' + event.time.substring(0,5) : ''}</span>
      </div>
      
      <div class="event-detail">
        <i class="fas fa-map-pin"></i>
        <span class="label">Location:</span>
        <span class="value">${event.location}</span>
      </div>
      
      ${event.state ? `
        <div class="event-detail">
          <i class="fas fa-map-marker-alt"></i>
          <span class="label">State:</span>
          <span class="value">${event.state}</span>
        </div>
      ` : ''}
    </div>
    
    ${event.description ? `
      <div class="event-description">
        <i class="fas fa-align-left"></i>
        <p>${event.description}</p>
      </div>
    ` : ''}
    
    <div class="event-host">
      <i class="fas fa-user"></i>
      <span>Hosted by <strong>${event.host?.full_name || 'Unknown'}</strong></span>
    </div>
    
    <div class="event-stats">
      <div class="event-stat">
        <i class="fas fa-users"></i>
        <strong>${attendeeCount}</strong> attending
      </div>
      ${event.max_attendees ? `
        <div class="event-stat">
          <i class="fas fa-user-plus"></i>
          <strong>${event.max_attendees - attendeeCount}</strong> spots left
        </div>
      ` : ''}
    </div>
    
    <div class="event-actions">
      <button class="${attendButtonClass}" onclick="toggleAttendance('${event.id}')">
        ${attendButtonText}
      </button>
      <button class="view-btn" onclick="viewEventDetails('${event.id}')">
        <i class="fas fa-eye"></i> Details
      </button>
    </div>
    
    ${isAdmin ? `
      <div class="admin-actions">
        <button class="admin-btn edit-btn" onclick="editEvent('${event.id}')">
          <i class="fas fa-edit"></i>
        </button>
        <button class="admin-btn delete-btn" onclick="openDeleteModal('${event.id}')">
          <i class="fas fa-trash"></i>
        </button>
        <button class="admin-btn view-btn" onclick="viewAttendees('${event.id}')">
          <i class="fas fa-users"></i>
        </button>
      </div>
    ` : isHost ? `
      <div class="admin-actions">
        <button class="admin-btn view-btn" onclick="viewAttendees('${event.id}')">
          <i class="fas fa-users"></i> View RSVPs
        </button>
      </div>
    ` : ''}
  `;
  
  return card;
}

// ================= TOGGLE ATTENDANCE =================
window.toggleAttendance = async function(eventId) {
  if (!currentUser) return;
  
  const currentStatus = window.userAttendance?.[eventId];
  let newStatus;
  
  if (!currentStatus) {
    newStatus = 'attending';
  } else if (currentStatus === 'attending') {
    newStatus = 'maybe';
  } else if (currentStatus === 'maybe') {
    newStatus = null; // Remove attendance
  }
  
  try {
    if (newStatus === null) {
      // Remove attendance
      const { error } = await supabase
        .from('event_attendees')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', currentUser.id);
      
      if (error) throw error;
      
      delete window.userAttendance[eventId];
      showNotification('You are no longer attending this event');
      
    } else {
      // Upsert attendance
      const { error } = await supabase
        .from('event_attendees')
        .upsert({
          event_id: eventId,
          user_id: currentUser.id,
          status: newStatus
        });
      
      if (error) throw error;
      
      window.userAttendance[eventId] = newStatus;
      showNotification(newStatus === 'attending' ? 'You are now attending!' : 'Status updated to Maybe');
    }
    
    // Update event counts
    await updateEventAttendeeCount(eventId);
    
  } catch (err) {
    console.error("Error toggling attendance:", err);
    showNotification('Error updating attendance', 'error');
  }
};

// ================= UPDATE EVENT ATTENDEE COUNT =================
async function updateEventAttendeeCount(eventId) {
  try {
    const { count, error } = await supabase
      .from('event_attendees')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .eq('status', 'attending');
    
    if (error) throw error;
    
    await supabase
      .from('events')
      .update({ current_attendees: count })
      .eq('id', eventId);
    
    // Reload events to reflect changes
    await loadEvents();
    
  } catch (err) {
    console.error("Error updating attendee count:", err);
  }
}

// ================= VIEW EVENT DETAILS =================
window.viewEventDetails = function(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;
  
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  alert(`
📅 EVENT DETAILS
━━━━━━━━━━━━━━━━
Title: ${event.title}
Date: ${formattedDate}
Time: ${event.time || 'Not specified'}
Location: ${event.location}
Address: ${event.address || 'Not specified'}
State: ${event.state || 'Not specified'}
Host: ${event.host?.full_name || 'Unknown'}

📝 Description:
${event.description || 'No description provided'}

👥 Attendees: ${event.attendees?.[0]?.count || 0} attending
  `);
};

// ================= VIEW ATTENDEES =================
window.viewAttendees = async function(eventId) {
  try {
    const { data, error } = await supabase
      .from('event_attendees')
      .select(`
        *,
        user:profiles!user_id(full_name, email, state)
      `)
      .eq('event_id', eventId)
      .order('created_at');
    
    if (error) throw error;
    
    const attendeesList = document.getElementById('attendeesList');
    if (!attendeesList) return;
    
    if (!data || data.length === 0) {
      attendeesList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <p>No attendees yet</p>
        </div>
      `;
    } else {
      let html = '';
      data.forEach(a => {
        html += `
          <div class="attendee-item">
            <div class="attendee-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="attendee-info">
              <h4>${a.user?.full_name || 'Unknown'}</h4>
              <p>${a.user?.email || ''} ${a.user?.state ? '• ' + a.user.state : ''}</p>
            </div>
            <span class="attendee-status ${a.status}">${a.status}</span>
          </div>
        `;
      });
      attendeesList.innerHTML = html;
    }
    
    attendeesModal.classList.remove('hidden');
    
  } catch (err) {
    console.error("Error loading attendees:", err);
    showNotification('Error loading attendees', 'error');
  }
};

// ================= OPEN CREATE MODAL =================
function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'Create New Event';
  document.getElementById('eventTitle').value = '';
  document.getElementById('eventDescription').value = '';
  document.getElementById('eventDate').value = '';
  document.getElementById('eventTime').value = '';
  document.getElementById('eventLocation').value = '';
  document.getElementById('eventState').value = '';
  document.getElementById('eventAddress').value = '';
  document.getElementById('eventMaxAttendees').value = '';
  document.getElementById('eventStatus').value = 'upcoming';
  
  selectedEventId = null;
  eventModal.classList.remove('hidden');
}

// ================= EDIT EVENT =================
window.editEvent = function(eventId) {
  const event = allEvents.find(e => e.id === eventId);
  if (!event) return;
  
  document.getElementById('modalTitle').textContent = 'Edit Event';
  document.getElementById('eventTitle').value = event.title || '';
  document.getElementById('eventDescription').value = event.description || '';
  document.getElementById('eventDate').value = event.date || '';
  document.getElementById('eventTime').value = event.time || '';
  document.getElementById('eventLocation').value = event.location || '';
  document.getElementById('eventState').value = event.state || '';
  document.getElementById('eventAddress').value = event.address || '';
  document.getElementById('eventMaxAttendees').value = event.max_attendees || '';
  document.getElementById('eventStatus').value = event.status || 'upcoming';
  
  selectedEventId = eventId;
  eventModal.classList.remove('hidden');
};

// ================= SAVE EVENT =================
async function saveEvent() {
  const title = document.getElementById('eventTitle').value.trim();
  const date = document.getElementById('eventDate').value;
  const location = document.getElementById('eventLocation').value.trim();
  
  if (!title || !date || !location) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  const eventData = {
    title,
    description: document.getElementById('eventDescription').value.trim() || null,
    date,
    time: document.getElementById('eventTime').value || null,
    location,
    state: document.getElementById('eventState').value.trim() || null,
    address: document.getElementById('eventAddress').value.trim() || null,
    max_attendees: document.getElementById('eventMaxAttendees').value ? 
                   parseInt(document.getElementById('eventMaxAttendees').value) : null,
    status: document.getElementById('eventStatus').value,
    host_id: currentUser.id,
    host_name: currentProfile.full_name
  };
  
  try {
    let error;
    
    if (selectedEventId) {
      // Update existing event
      ({ error } = await supabase
        .from('events')
        .update(eventData)
        .eq('id', selectedEventId));
    } else {
      // Create new event
      ({ error } = await supabase
        .from('events')
        .insert([eventData]));
    }
    
    if (error) throw error;
    
    eventModal.classList.add('hidden');
    showNotification(selectedEventId ? 'Event updated successfully' : 'Event created successfully');
    await loadEvents();
    
  } catch (err) {
    console.error("Error saving event:", err);
    showNotification('Error saving event: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ================= OPEN DELETE MODAL =================
window.openDeleteModal = function(eventId) {
  selectedEventId = eventId;
  deleteModal.classList.remove('hidden');
};

// ================= CONFIRM DELETE =================
async function confirmDelete() {
  if (!selectedEventId) return;
  
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', selectedEventId);
    
    if (error) throw error;
    
    deleteModal.classList.add('hidden');
    showNotification('Event deleted successfully');
    await loadEvents();
    
  } catch (err) {
    console.error("Error deleting event:", err);
    showNotification('Error deleting event', 'error');
  }
}

// ================= SHOW SKELETON =================
function showSkeleton() {
  eventsContainer.innerHTML = "";
  for (let i = 0; i < 6; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton";
    eventsContainer.appendChild(skeleton);
  }
}

// ================= LOGOUT =================
logoutBtn.onclick = async () => {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
};

// ================= START APPLICATION =================
initEvents();