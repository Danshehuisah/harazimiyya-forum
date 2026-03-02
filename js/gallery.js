// ============================================
// HARAZIMIYYA FORUM - GALLERY
// All members can upload images/videos
// Members can delete their own content
// Admins can delete any content
// ============================================

// Global variables
let currentUser = null;
let currentProfile = null;
let isAdmin = false;
let allMedia = [];
let selectedFile = null;

// DOM Elements
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const openSidebar = document.getElementById("openSidebar");
const closeSidebar = document.getElementById("closeSidebar");
const logoutBtn = document.getElementById("logoutBtn");
const addMediaBtn = document.getElementById("addMediaBtn");
const galleryGrid = document.getElementById("galleryGrid");
const galleryModal = document.getElementById("galleryModal");
const closeGalleryModalBtn = document.getElementById("closeGalleryModalBtn");
const saveMediaBtn = document.getElementById("saveMediaBtn");
const mediaType = document.getElementById("mediaType");
const mediaTitle = document.getElementById("mediaTitle");
const mediaFile = document.getElementById("mediaFile");

// Delete modal (will be created dynamically)
let deleteModal = null;
let selectedMediaId = null;

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
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
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
                <h3>Delete Media?</h3>
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
        selectedMediaId = null;
    };
    
    document.getElementById('confirmDeleteBtn').onclick = confirmDelete;
}

// ================= CREATE LIGHTBOX =================
function createLightbox(src, type) {
    const lightbox = document.createElement('div');
    lightbox.className = 'lightbox-modal';
    
    if (type === 'image') {
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <img src="${src}" alt="Gallery image">
                <button class="lightbox-close">&times;</button>
            </div>
        `;
    } else {
        lightbox.innerHTML = `
            <div class="lightbox-content">
                <video src="${src}" controls autoplay></video>
                <button class="lightbox-close">&times;</button>
            </div>
        `;
    }
    
    document.body.appendChild(lightbox);
    
    lightbox.querySelector('.lightbox-close').onclick = () => {
        lightbox.remove();
    };
    
    lightbox.onclick = (e) => {
        if (e.target === lightbox) {
            lightbox.remove();
        }
    };
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

        // Show add button for all authenticated users
        if (addMediaBtn) {
            addMediaBtn.classList.remove("hidden");
        }

        // Load gallery
        await loadGallery();

    } catch (err) {
        console.error("Initialization error:", err);
    }
}

// ================= LOAD GALLERY =================
async function loadGallery() {
    // Show loading spinner
    galleryGrid.innerHTML = `
        <div class="loading-spinner">
            <i class="fas fa-spinner fa-spin"></i> Loading gallery...
        </div>
    `;

    try {
        const { data, error } = await supabase
            .from("gallery")
            .select(`
                *,
                uploader:profiles!uploaded_by(full_name, email, role)
            `)
            .order("created_at", { ascending: false });

        if (error) throw error;

        allMedia = data || [];
        displayGallery(allMedia);

    } catch (err) {
        console.error("Error loading gallery:", err);
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-circle"></i>
                <h3>Error Loading Gallery</h3>
                <p>Please try again later</p>
            </div>
        `;
    }
}

// ================= DISPLAY GALLERY =================
function displayGallery(media) {
    galleryGrid.innerHTML = "";

    if (!media || media.length === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-images"></i>
                <h3>No Media Yet</h3>
                <p>Be the first to share an image or video from our programs!</p>
            </div>
        `;
        return;
    }

    media.forEach(item => {
        const card = createMediaCard(item);
        galleryGrid.appendChild(card);
    });
}

// ================= CREATE MEDIA CARD =================
function createMediaCard(item) {
    const card = document.createElement("div");
    card.className = `media-card ${item.media_type}`;
    
    const date = new Date(item.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const uploaderName = item.uploader?.full_name || 'Unknown';
    const canDelete = isAdmin || item.uploaded_by === currentUser.id;
    
    card.innerHTML = `
        <span class="media-badge">${item.media_type}</span>
        ${item.media_type === 'image' 
            ? `<img src="${item.media_url}" alt="${item.title}" class="media-preview" onclick="viewMedia('${item.media_url}', 'image')">`
            : `<video src="${item.media_url}" class="media-preview" onclick="viewMedia('${item.media_url}', 'video')"></video>`
        }
        <div class="media-info">
            <h4>${item.title}</h4>
            <div class="media-meta">
                <span><i class="fas fa-calendar"></i> ${date}</span>
                <span><i class="fas fa-eye"></i> ${item.views || 0}</span>
                <span><i class="fas fa-heart"></i> ${item.likes || 0}</span>
            </div>
            <div class="media-uploader">
                <i class="fas fa-user"></i>
                <span>Uploaded by: <strong>${uploaderName}</strong></span>
            </div>
            ${canDelete ? `
                <div class="media-actions">
                    <button class="media-btn delete-btn" onclick="openDeleteModal('${item.id}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            ` : ''}
        </div>
    `;
    
    return card;
}

// ================= VIEW MEDIA =================
window.viewMedia = function(url, type) {
    createLightbox(url, type);
    
    // Increment view count
    const media = allMedia.find(m => m.media_url === url);
    if (media) {
        supabase
            .from('gallery')
            .update({ views: (media.views || 0) + 1 })
            .eq('id', media.id)
            .then(({ error }) => {
                if (error) console.error("Error updating views:", error);
            });
    }
};

// ================= SETUP EVENT LISTENERS =================
function setupEventListeners() {
    // Add media button
    addMediaBtn.onclick = openAddModal;
    
    // Close modal button
    closeGalleryModalBtn.onclick = closeModal;
    
    // Save media button
    saveMediaBtn.onclick = saveMedia;
    
    // File input change
    mediaFile.onchange = (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            // Show file info
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            fileInfo.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <span>Selected: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(2)} KB)</span>
            `;
            
            // Remove existing file info
            const existingInfo = document.querySelector('.file-info');
            if (existingInfo) existingInfo.remove();
            
            mediaFile.parentNode.insertBefore(fileInfo, mediaFile.nextSibling);
            
            // Show preview for images
            if (mediaType.value === 'image' && selectedFile.type.startsWith('image/')) {
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
    
    // Media type change
    mediaType.onchange = () => {
        // Clear file input and preview
        mediaFile.value = '';
        selectedFile = null;
        
        const fileInfo = document.querySelector('.file-info');
        if (fileInfo) fileInfo.remove();
        
        const preview = document.querySelector('.preview-image');
        if (preview) preview.remove();
    };
    
    // Logout
    logoutBtn.onclick = async () => {
        await supabase.auth.signOut();
        window.location.href = "../index.html";
    };
}

// ================= OPEN ADD MODAL =================
function openAddModal() {
    mediaTitle.value = '';
    mediaType.value = 'image';
    mediaFile.value = '';
    selectedFile = null;
    
    // Clear file info and preview
    const fileInfo = document.querySelector('.file-info');
    if (fileInfo) fileInfo.remove();
    
    const preview = document.querySelector('.preview-image');
    if (preview) preview.remove();
    
    galleryModal.classList.remove('hidden');
}

// ================= SAVE MEDIA =================
async function saveMedia() {
    const title = mediaTitle.value.trim();
    if (!title) {
        showNotification('Please enter a title', 'error');
        return;
    }

    if (!selectedFile) {
        showNotification('Please select a file', 'error');
        return;
    }

    // Validate file size (50MB max)
    if (selectedFile.size > 50 * 1024 * 1024) {
        showNotification('File too large. Maximum size is 50MB.', 'error');
        return;
    }

    // Validate file type
    const type = mediaType.value;
    if (type === 'image' && !selectedFile.type.startsWith('image/')) {
        showNotification('Please select a valid image file', 'error');
        return;
    }
    if (type === 'video' && !selectedFile.type.startsWith('video/')) {
        showNotification('Please select a valid video file', 'error');
        return;
    }

    saveMediaBtn.disabled = true;
    saveMediaBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';

    try {
        // Upload file to storage
        const fileExt = selectedFile.name.split('.').pop();
        const fileName = `${currentUser.id}/${Date.now()}_${selectedFile.name}`;
        
        const { error: uploadError } = await supabase.storage
            .from('gallery-media')
            .upload(fileName, selectedFile);
        
        if (uploadError) throw uploadError;
        
        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('gallery-media')
            .getPublicUrl(fileName);
        
        // Save to database
        const { error: dbError } = await supabase
            .from('gallery')
            .insert([{
                title,
                media_type: type,
                media_url: publicUrl,
                uploaded_by: currentUser.id,
                uploader_name: currentProfile.full_name
            }]);
        
        if (dbError) throw dbError;
        
        closeModal();
        showNotification('Media uploaded successfully');
        await loadGallery();
        
    } catch (err) {
        console.error("Error uploading media:", err);
        showNotification('Error: ' + err.message, 'error');
    } finally {
        saveMediaBtn.disabled = false;
        saveMediaBtn.innerHTML = 'Save';
    }
}

// ================= OPEN DELETE MODAL =================
window.openDeleteModal = function(id) {
    selectedMediaId = id;
    deleteModal.classList.remove('hidden');
};

// ================= CONFIRM DELETE =================
async function confirmDelete() {
    if (!selectedMediaId) return;

    try {
        // Get media info to delete file
        const media = allMedia.find(m => m.id === selectedMediaId);
        
        // Delete from database
        const { error } = await supabase
            .from('gallery')
            .delete()
            .eq('id', selectedMediaId);

        if (error) throw error;

        // Try to delete file from storage
        if (media?.media_url) {
            try {
                const fileName = media.media_url.split('/').pop();
                const filePath = `${media.uploaded_by}/${fileName}`;
                await supabase.storage
                    .from('gallery-media')
                    .remove([filePath]);
            } catch (storageErr) {
                console.log("Could not delete file:", storageErr);
            }
        }

        deleteModal.classList.add('hidden');
        showNotification('Media deleted');
        await loadGallery();

    } catch (err) {
        console.error("Error deleting media:", err);
        showNotification('Error deleting media', 'error');
    }
}

// ================= CLOSE MODAL =================
function closeModal() {
    galleryModal.classList.add('hidden');
    mediaTitle.value = '';
    mediaType.value = 'image';
    mediaFile.value = '';
    selectedFile = null;
    
    const fileInfo = document.querySelector('.file-info');
    if (fileInfo) fileInfo.remove();
    
    const preview = document.querySelector('.preview-image');
    if (preview) preview.remove();
}