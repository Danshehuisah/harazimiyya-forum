// ============================================
// HARAZIMIYYA FORUM - SHEIKH HISTORY
// Admin: Add, Edit, Delete Content (Text, Images, Videos)
// Members: View All Content
// ============================================

// Global variables
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let allContent = [];
let selectedContentId = null;
let selectedFile = null;

// DOM Elements
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const logoutBtn = document.getElementById("logoutBtn");
const contentArea = document.getElementById("contentArea");
const addSectionBtn = document.getElementById("addSectionBtn");
const uploadModal = document.getElementById("uploadModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const saveContentBtn = document.getElementById("saveContentBtn");
const selectFileBtn = document.getElementById("selectFileBtn");
const fileInput = document.getElementById("fileInput");
const contentType = document.getElementById("contentType");
const contentTitle = document.getElementById("contentTitle");
const contentText = document.getElementById("contentText");

// Delete modal (will be created dynamically)
let deleteModal = null;

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

// ================= CREATE DELETE MODAL =================
function createDeleteModal() {
  const deleteModalHTML = `
    <div id="deleteModal" class="modal hidden">
      <div class="modal-content delete-modal">
        <i class="fas fa-exclamation-triangle" style="font-size: 48px;"></i>
        <h3>Delete Content?</h3>
        <p>This action cannot be undone.</p>
        <div class="modal-actions">
          <button id="confirmDeleteBtn" class="primary-btn" style="background: #dc3545;">Delete</button>
          <button id="cancelDeleteBtn" class="ghost-btn">Cancel</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', deleteModalHTML);
  deleteModal = document.getElementById('deleteModal');
  
  document.getElementById('cancelDeleteBtn').onclick = () => {
    deleteModal.classList.add('hidden');
    selectedContentId = null;
  };
  
  document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
}

// ================= INITIALIZATION =================
document.addEventListener("DOMContentLoaded", async () => {
  await init();
  createDeleteModal();
  setupEventListeners();
});

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

    // Show add button only for admin
    if (addSectionBtn) {
      if (isAdmin) {
        addSectionBtn.classList.remove("hidden");
      }
    }

    // Load content
    await loadContent();

  } catch (err) {
    console.error("Initialization error:", err);
  }
}

// ================= LOAD CONTENT =================
async function loadContent() {
  // Show loading spinner
  contentArea.innerHTML = `
    <div class="loading-spinner">
      <i class="fas fa-spinner fa-spin"></i> Loading content...
    </div>
  `;

  try {
    const { data, error } = await supabase
      .from("sheikh_history")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    allContent = data || [];
    displayContent(allContent);

  } catch (err) {
    console.error("Error loading content:", err);
    contentArea.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-exclamation-circle"></i>
        <h3>Error Loading Content</h3>
        <p>Please try again later</p>
      </div>
    `;
  }
}

// ================= DISPLAY CONTENT =================
function displayContent(content) {
  contentArea.innerHTML = "";

  if (!content || content.length === 0) {
    contentArea.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-book-open"></i>
        <h3>No Content Yet</h3>
        <p>${isAdmin ? 'Click "Add Content" to share the Sheikh\'s history' : 'Check back later for updates'}</p>
      </div>
    `;
    return;
  }

  content.forEach(item => {
    const card = createContentCard(item);
    contentArea.appendChild(card);
  });
}

// ================= CREATE CONTENT CARD =================
function createContentCard(item) {
  const card = document.createElement("div");
  card.className = `content-card ${item.content_type}`;
  
  const date = new Date(item.created_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
  
  let content = '';
  
  if (item.content_type === 'text') {
    content = `
      <div class="card-content">
        <h3>${item.title}</h3>
        <p>${item.content || ''}</p>
        <div class="card-meta">
          <span><i class="fas fa-calendar"></i> ${date}</span>
          ${item.location ? `<span><i class="fas fa-map-marker-alt"></i> ${item.location}</span>` : ''}
          ${item.event_date ? `<span><i class="fas fa-calendar-alt"></i> ${new Date(item.event_date).toLocaleDateString()}</span>` : ''}
        </div>
      </div>
    `;
  } else if (item.content_type === 'image') {
    content = `
      <img src="${item.media_url}" alt="${item.title}" class="card-media">
      <div class="card-content">
        <h3>${item.title}</h3>
        <div class="card-meta">
          <span><i class="fas fa-calendar"></i> ${date}</span>
        </div>
      </div>
    `;
  } else if (item.content_type === 'video') {
    content = `
      <video controls class="card-media">
        <source src="${item.media_url}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
      <div class="card-content">
        <h3>${item.title}</h3>
        <div class="card-meta">
          <span><i class="fas fa-calendar"></i> ${date}</span>
        </div>
      </div>
    `;
  }
  
  card.innerHTML = `
    <span class="card-badge">${item.content_type}</span>
    ${content}
    ${isAdmin ? `
      <div class="admin-actions">
        <button class="admin-btn edit-btn" onclick="editContent('${item.id}')" title="Edit">
          <i class="fas fa-edit"></i>
        </button>
        <button class="admin-btn delete-btn" onclick="openDeleteModal('${item.id}')" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    ` : ''}
  `;
  
  return card;
}

// ================= SETUP EVENT LISTENERS =================
function setupEventListeners() {
  // Modal controls
  addSectionBtn.onclick = openAddModal;
  closeModalBtn.onclick = closeModal;
  selectFileBtn.onclick = () => fileInput.click();
  
  fileInput.onchange = (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
      // Show file info
      const fileInfo = document.createElement('div');
      fileInfo.className = 'file-info';
      fileInfo.innerHTML = `
        <i class="fas fa-check-circle" style="color: var(--success);"></i>
        <span>Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)</span>
      `;
      
      // Remove existing file info
      const existingInfo = document.querySelector('.file-info');
      if (existingInfo) existingInfo.remove();
      
      selectFileBtn.parentNode.insertBefore(fileInfo, selectFileBtn.nextSibling);
      
      // Show preview for images
      if (contentType.value === 'image' && selectedFile.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const preview = document.createElement('img');
          preview.src = e.target.result;
          preview.className = 'preview-image';
          
          const existingPreview = document.querySelector('.preview-image');
          if (existingPreview) existingPreview.remove();
          
          fileInfo.insertAdjacentElement('afterend', preview);
        };
        reader.readAsDataURL(selectedFile);
      }
    }
  };
  
  // Content type change
  contentType.onchange = () => {
    const isText = contentType.value === 'text';
    contentText.style.display = isText ? 'block' : 'none';
    selectFileBtn.style.display = isText ? 'none' : 'inline-block';
    fileInput.value = '';
    selectedFile = null;
    
    // Remove file info and preview
    const fileInfo = document.querySelector('.file-info');
    if (fileInfo) fileInfo.remove();
    
    const preview = document.querySelector('.preview-image');
    if (preview) preview.remove();
  };
  
  // Save content
  saveContentBtn.onclick = saveContent;
  
  // Logout
  logoutBtn.onclick = async () => {
    await supabase.auth.signOut();
    window.location.href = "../index.html";
  };
}

// ================= OPEN ADD MODAL =================
function openAddModal() {
  document.querySelector('#uploadModal h3').textContent = 'Add Sheikh Content';
  contentTitle.value = '';
  contentText.value = '';
  contentType.value = 'text';
  selectedFile = null;
  fileInput.value = '';
  selectedContentId = null;
  
  // Reset UI
  contentText.style.display = 'block';
  selectFileBtn.style.display = 'none';
  
  const fileInfo = document.querySelector('.file-info');
  if (fileInfo) fileInfo.remove();
  
  const preview = document.querySelector('.preview-image');
  if (preview) preview.remove();
  
  uploadModal.classList.remove('hidden');
}

// ================= EDIT CONTENT =================
window.editContent = function(id) {
  const item = allContent.find(c => c.id === id);
  if (!item) return;
  
  document.querySelector('#uploadModal h3').textContent = 'Edit Content';
  contentTitle.value = item.title || '';
  contentText.value = item.content || '';
  contentType.value = item.content_type;
  selectedContentId = id;
  selectedFile = null;
  
  const isText = item.content_type === 'text';
  contentText.style.display = isText ? 'block' : 'none';
  selectFileBtn.style.display = isText ? 'none' : 'inline-block';
  
  // Show existing file info for media
  if (!isText && item.media_url) {
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.innerHTML = `
      <i class="fas fa-check-circle" style="color: var(--success);"></i>
      <span>Current file: ${item.media_url.split('/').pop()}</span>
    `;
    
    const existingInfo = document.querySelector('.file-info');
    if (existingInfo) existingInfo.remove();
    
    selectFileBtn.parentNode.insertBefore(fileInfo, selectFileBtn.nextSibling);
    
    // Show preview for images
    if (item.content_type === 'image') {
      const preview = document.createElement('img');
      preview.src = item.media_url;
      preview.className = 'preview-image';
      
      const existingPreview = document.querySelector('.preview-image');
      if (existingPreview) existingPreview.remove();
      
      fileInfo.insertAdjacentElement('afterend', preview);
    }
  }
  
  uploadModal.classList.remove('hidden');
};

// ================= SAVE CONTENT =================
async function saveContent() {
  const title = contentTitle.value.trim();
  if (!title) {
    showNotification('Please enter a title', 'error');
    return;
  }

  const type = contentType.value;
  let mediaUrl = null;
  let content = null;

  try {
    // Handle file upload for images/videos
    if (type !== 'text') {
      if (selectedFile) {
        // Upload new file
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `sheikh/${Date.now()}_${selectedFile.name}`;
        
        const { error: uploadError } = await supabase.storage
          .from('sheikh-media')
          .upload(fileName, selectedFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('sheikh-media')
          .getPublicUrl(fileName);
        
        mediaUrl = publicUrl;
      } else if (selectedContentId) {
        // Keep existing media URL when editing
        const existing = allContent.find(c => c.id === selectedContentId);
        mediaUrl = existing?.media_url;
      } else {
        showNotification('Please select a file', 'error');
        return;
      }
    } else {
      content = contentText.value.trim();
      if (!content) {
        showNotification('Please enter content', 'error');
        return;
      }
    }

    const contentData = {
      title,
      content_type: type,
      content: type === 'text' ? content : null,
      media_url: mediaUrl,
      created_by: currentUser.id
    };

    let error;

    if (selectedContentId) {
      // Update existing
      ({ error } = await supabase
        .from('sheikh_history')
        .update(contentData)
        .eq('id', selectedContentId));
    } else {
      // Insert new
      ({ error } = await supabase
        .from('sheikh_history')
        .insert([contentData]));
    }

    if (error) throw error;

    closeModal();
    showNotification(selectedContentId ? 'Content updated' : 'Content added');
    await loadContent();

  } catch (err) {
    console.error("Error saving content:", err);
    showNotification('Error: ' + err.message, 'error');
  }
}

// ================= OPEN DELETE MODAL =================
window.openDeleteModal = function(id) {
  selectedContentId = id;
  deleteModal.classList.remove('hidden');
};

// ================= CONFIRM DELETE =================
async function confirmDelete() {
  if (!selectedContentId) return;

  try {
    // Get the item to delete its media file if any
    const item = allContent.find(c => c.id === selectedContentId);
    
    // Delete from database
    const { error } = await supabase
      .from('sheikh_history')
      .delete()
      .eq('id', selectedContentId);

    if (error) throw error;

    // Try to delete associated media file if exists
    if (item?.media_url) {
      try {
        const path = item.media_url.split('/').pop();
        await supabase.storage
          .from('sheikh-media')
          .remove([`sheikh/${path}`]);
      } catch (storageErr) {
        console.log("Could not delete media file:", storageErr);
      }
    }

    deleteModal.classList.add('hidden');
    showNotification('Content deleted');
    await loadContent();

  } catch (err) {
    console.error("Error deleting content:", err);
    showNotification('Error deleting content', 'error');
  }
}

// ================= CLOSE MODAL =================
function closeModal() {
  uploadModal.classList.add('hidden');
  contentTitle.value = '';
  contentText.value = '';
  contentType.value = 'text';
  selectedFile = null;
  fileInput.value = '';
  selectedContentId = null;
  
  // Remove file info and preview
  const fileInfo = document.querySelector('.file-info');
  if (fileInfo) fileInfo.remove();
  
  const preview = document.querySelector('.preview-image');
  if (preview) preview.remove();
  
  contentText.style.display = 'block';
  selectFileBtn.style.display = 'none';
}