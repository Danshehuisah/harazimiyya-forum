// ============================================
// HARAZIMIYYA FORUM - ANNOUNCEMENTS DASHBOARD
// Admin: Create, Edit, Delete, Pin Announcements
// Members: View All Announcements
// ============================================

// Global variables
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let allAnnouncements = [];
let selectedAnnouncementId = null;

// DOM Elements
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const logoutBtn = document.getElementById("logoutBtn");
const announcementArea = document.getElementById("announcementArea");
const addAnnouncementBtn = document.getElementById("addAnnouncementBtn");

// Modal elements (will be created dynamically)
let announcementModal = null;
let deleteModal = null;

// ================= SIDEBAR TOGGLE =================
openSidebar.addEventListener("click", () => {
  sidebar.classList.add("active");
  overlay.classList.add("active");
});

closeSidebar.addEventListener("click", () => {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
});

overlay.addEventListener("click", () => {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
});

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
  // Create Announcement Modal
  const modalHTML = `
    <div id="announcementModal" class="modal hidden">
      <div class="modal-content">
        <h2 id="modalTitle">Create Announcement</h2>
        
        <div class="form-group">
          <label><i class="fas fa-heading"></i> Title *</label>
          <input type="text" id="announcementTitle" placeholder="Announcement title..." required>
        </div>
        
        <div class="form-group">
          <label><i class="fas fa-align-left"></i> Content *</label>
          <textarea id="announcementContent" placeholder="Write your announcement here..." rows="6"></textarea>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label><i class="fas fa-calendar"></i> Expiry Date (Optional)</label>
            <input type="date" id="announcementExpiry">
          </div>
        </div>
        
        <div class="form-row">
          <div class="checkbox-group">
            <input type="checkbox" id="announcementPinned">
            <label for="announcementPinned"><i class="fas fa-thumbtack"></i> Pin this announcement</label>
          </div>
          <div class="checkbox-group">
            <input type="checkbox" id="announcementImportant">
            <label for="announcementImportant"><i class="fas fa-exclamation-circle"></i> Mark as important</label>
          </div>
        </div>
        
        <div class="modal-actions">
          <button id="saveAnnouncementBtn" class="primary-btn"><i class="fas fa-save"></i> Save</button>
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
        <h3>Delete Announcement?</h3>
        <p>This action cannot be undone.</p>
        <div class="modal-actions">
          <button id="confirmDeleteBtn" class="primary-btn" style="background: #dc3545;">Delete</button>
          <button id="cancelDeleteBtn" class="ghost-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  document.body.insertAdjacentHTML('beforeend', deleteModalHTML);
  
  announcementModal = document.getElementById('announcementModal');
  deleteModal = document.getElementById('deleteModal');
  
  // Modal close buttons
  document.getElementById('closeModalBtn').onclick = () => {
    announcementModal.classList.add('hidden');
  };
  
  document.getElementById('cancelDeleteBtn').onclick = () => {
    deleteModal.classList.add('hidden');
    selectedAnnouncementId = null;
  };
  
  // Save announcement button
  document.getElementById('saveAnnouncementBtn').onclick = saveAnnouncement;
  
  // Confirm delete button
  document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
  
  // Close modals when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === announcementModal) announcementModal.classList.add('hidden');
    if (e.target === deleteModal) deleteModal.classList.add('hidden');
  });
}

// ================= INITIALIZATION =================
async function init() {
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

    // Show add button only for admin
    if (addAnnouncementBtn) {
      if (isAdmin) {
        addAnnouncementBtn.classList.remove("hidden");
        addAnnouncementBtn.addEventListener("click", openCreateModal);
      }
    }

    // Load announcements
    await loadAnnouncements();

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

// ================= LOAD ANNOUNCEMENTS (SIMPLIFIED) =================
async function loadAnnouncements() {
  // Show skeleton loading
  showSkeleton();
  
  try {
    // Simple query first - get all announcements
    const { data, error } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading announcements:", error);
      throw error;
    }

    console.log("Announcements loaded:", data);

    if (!data || data.length === 0) {
      announcementArea.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-bullhorn"></i>
          <h3>No Announcements Yet</h3>
          <p>${isAdmin ? 'Click "Add Announcement" to create the first announcement' : 'Check back later for updates'}</p>
        </div>
      `;
      return;
    }

    // Sort by pinned first, then by date
    data.sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    allAnnouncements = data;
    displayAnnouncements(data);

  } catch (err) {
    console.error("Error loading announcements:", err);
    announcementArea.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Announcements</h3>
        <p>Please try again later</p>
        <small>${err.message || 'Unknown error'}</small>
      </div>
    `;
  }
}

// ================= SHOW SKELETON =================
function showSkeleton() {
  announcementArea.innerHTML = "";
  for (let i = 0; i < 3; i++) {
    const skeleton = document.createElement("div");
    skeleton.className = "skeleton";
    announcementArea.appendChild(skeleton);
  }
}

// ================= DISPLAY ANNOUNCEMENTS =================
function displayAnnouncements(announcements) {
  announcementArea.innerHTML = "";

  announcements.forEach(item => {
    const card = createAnnouncementCard(item);
    announcementArea.appendChild(card);
  });
}

// ================= CREATE ANNOUNCEMENT CARD =================
function createAnnouncementCard(item) {
  const card = document.createElement("div");
  card.className = "announcement-card";
  
  if (item.is_pinned) card.classList.add("pinned");
  if (item.is_important) card.classList.add("important");
  
  const date = new Date(item.created_at).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  
  const authorName = item.author_name || 'Admin';
  const isExpired = item.expiry_date && new Date(item.expiry_date) < new Date();
  
  if (isExpired) {
    card.style.opacity = '0.6';
  }
  
  let badges = '';
  if (item.is_pinned) badges += '<span class="badge pinned"><i class="fas fa-thumbtack"></i> Pinned</span>';
  if (item.is_important) badges += '<span class="badge important"><i class="fas fa-exclamation-circle"></i> Important</span>';
  if (isExpired) badges += '<span class="badge" style="background: #666;">Expired</span>';
  
  card.innerHTML = `
    <div class="announcement-header">
      <div class="announcement-title">
        <h3>${item.title}</h3>
        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
          ${badges}
        </div>
      </div>
      <div class="announcement-meta">
        <span><i class="fas fa-user"></i> ${authorName}</span>
        <span><i class="fas fa-clock"></i> ${date}</span>
        ${item.expiry_date ? `<span><i class="fas fa-hourglass-end"></i> Expires: ${new Date(item.expiry_date).toLocaleDateString()}</span>` : ''}
      </div>
    </div>
    
    <div class="announcement-content">
      ${item.content.split('\n').map(p => `<p>${p}</p>`).join('')}
    </div>
    
    ${isAdmin ? `
      <div class="admin-actions">
        <button class="admin-btn edit-btn" onclick="editAnnouncement('${item.id}')" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button class="admin-btn pin-btn" onclick="togglePin('${item.id}')" title="${item.is_pinned ? 'Unpin' : 'Pin'}">
          <i class="fas fa-thumbtack"></i>
        </button>
        <button class="admin-btn delete-btn" onclick="openDeleteModal('${item.id}')" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    ` : ''}
  `;
  
  return card;
}

// ================= OPEN CREATE MODAL =================
function openCreateModal() {
  document.getElementById('modalTitle').textContent = 'Create Announcement';
  document.getElementById('announcementTitle').value = '';
  document.getElementById('announcementContent').value = '';
  document.getElementById('announcementExpiry').value = '';
  document.getElementById('announcementPinned').checked = false;
  document.getElementById('announcementImportant').checked = false;
  
  selectedAnnouncementId = null;
  announcementModal.classList.remove('hidden');
}

// ================= EDIT ANNOUNCEMENT =================
window.editAnnouncement = function(id) {
  const announcement = allAnnouncements.find(a => a.id === id);
  if (!announcement) return;
  
  document.getElementById('modalTitle').textContent = 'Edit Announcement';
  document.getElementById('announcementTitle').value = announcement.title || '';
  document.getElementById('announcementContent').value = announcement.content || '';
  document.getElementById('announcementExpiry').value = announcement.expiry_date || '';
  document.getElementById('announcementPinned').checked = announcement.is_pinned || false;
  document.getElementById('announcementImportant').checked = announcement.is_important || false;
  
  selectedAnnouncementId = id;
  announcementModal.classList.remove('hidden');
};

// ================= TOGGLE PIN =================
window.togglePin = async function(id) {
  const announcement = allAnnouncements.find(a => a.id === id);
  if (!announcement) return;
  
  try {
    const { error } = await supabase
      .from('announcements')
      .update({ is_pinned: !announcement.is_pinned })
      .eq('id', id);
    
    if (error) throw error;
    
    showNotification(announcement.is_pinned ? 'Announcement unpinned' : 'Announcement pinned');
    await loadAnnouncements();
    
  } catch (err) {
    console.error("Error toggling pin:", err);
    showNotification('Error updating announcement', 'error');
  }
};

// ================= SAVE ANNOUNCEMENT =================
async function saveAnnouncement() {
  const title = document.getElementById('announcementTitle').value.trim();
  const content = document.getElementById('announcementContent').value.trim();
  
  if (!title || !content) {
    showNotification('Please fill in all required fields', 'error');
    return;
  }
  
  const announcementData = {
    title,
    content,
    created_by: currentUser.id,
    author_name: currentProfile.full_name,
    is_pinned: document.getElementById('announcementPinned').checked,
    is_important: document.getElementById('announcementImportant').checked,
    expiry_date: document.getElementById('announcementExpiry').value || null
  };
  
  try {
    let error;
    
    if (selectedAnnouncementId) {
      // Update existing
      ({ error } = await supabase
        .from('announcements')
        .update(announcementData)
        .eq('id', selectedAnnouncementId));
    } else {
      // Create new
      ({ error } = await supabase
        .from('announcements')
        .insert([announcementData]));
    }
    
    if (error) {
      console.error("Supabase error:", error);
      throw error;
    }
    
    announcementModal.classList.add('hidden');
    showNotification(selectedAnnouncementId ? 'Announcement updated' : 'Announcement created');
    await loadAnnouncements();
    
  } catch (err) {
    console.error("Error saving announcement:", err);
    showNotification('Error saving announcement: ' + (err.message || 'Unknown error'), 'error');
  }
}

// ================= OPEN DELETE MODAL =================
window.openDeleteModal = function(id) {
  selectedAnnouncementId = id;
  deleteModal.classList.remove('hidden');
};

// ================= CONFIRM DELETE =================
async function confirmDelete() {
  if (!selectedAnnouncementId) return;
  
  try {
    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', selectedAnnouncementId);
    
    if (error) throw error;
    
    deleteModal.classList.add('hidden');
    showNotification('Announcement deleted');
    await loadAnnouncements();
    
  } catch (err) {
    console.error("Error deleting announcement:", err);
    showNotification('Error deleting announcement', 'error');
  }
}

// ================= LOGOUT =================
logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  window.location.href = "../index.html";
});

// ================= START APPLICATION =================
init();