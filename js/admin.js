// js/admin.js - Complete with Islamic Green Theme & Friendly Messages

document.addEventListener('DOMContentLoaded', function() {
    console.log("📊 Admin dashboard is getting ready for you...");
    
    function checkAdminAuth() {
        if (!window.supabase) {
            console.log("⏳ Waiting for connection...");
            setTimeout(checkAdminAuth, 100);
            return;
        }
        
        initializeAdmin();
        initializeSidebar();
    }
    
    checkAdminAuth();
});

function initializeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');
    const overlay = document.getElementById('overlay');
    const mainContent = document.getElementById('mainContent');
    
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            overlay.classList.add('active');
            mainContent.classList.add('sidebar-open');
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            mainContent.classList.remove('sidebar-open');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
            mainContent.classList.remove('sidebar-open');
        });
    }
}

async function initializeAdmin() {
    try {
        console.log("🔐 Checking your admin access...");
        
        const { data: { user }, error: userError } = await window.supabase.auth.getUser();
        
        if (userError || !user) {
            console.log("No session found, redirecting to login");
            showIslamicNotification("Please log in first", "info");
            window.location.href = '../index.html';
            return;
        }
        
        console.log("👋 Welcome back,", user.email);
        
        // Get user profile
        const { data: profile, error: profileError } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        
        if (profileError) {
            console.error("Profile error:", profileError);
            
            // If profile doesn't exist, create one
            if (profileError.code === 'PGRST116') {
                console.log("Setting up your admin profile...");
                
                const { error: insertError } = await window.supabase
                    .from('profiles')
                    .insert([{
                        id: user.id,
                        email: user.email,
                        full_name: user.user_metadata?.full_name || 'Admin User',
                        role: 'admin',
                        is_approved: true
                    }]);
                
                if (insertError) {
                    console.error("Failed to create profile:", insertError);
                    showIslamicNotification("Couldn't set up your profile. Please contact support.", "error");
                    window.location.href = '../index.html';
                    return;
                }
                
                // Reload to get the new profile
                window.location.reload();
                return;
            }
            
            showIslamicNotification("Error loading your profile. Please try again.", "error");
            window.location.href = '../index.html';
            return;
        }
        
        // Check if admin
        if (!profile || profile.role !== 'admin') {
            console.log("User is not admin, redirecting to home");
            showIslamicNotification("This area is for admins only", "warning");
            window.location.href = 'home.html';
            return;
        }
        
        console.log("✅ Welcome, Admin", profile.full_name);
        
        // Update UI with admin name
        const adminNameElements = document.querySelectorAll('#adminName, #headerAdminName');
        adminNameElements.forEach(el => {
            if (el) el.textContent = profile.full_name || 'Admin';
        });
        
        // Load all sections
        showIslamicNotification("Loading your dashboard...", "info", 2000);
        await loadStats();
        await loadPendingUsers();
        await loadAllMembers();
        await loadRecentActivity();
        
        // Setup listeners
        setupAdminListeners();
        setupSearch();
        
    } catch (err) {
        console.error("Admin initialization error:", err);
        showIslamicNotification("Authentication error: " + err.message, "error");
    }
}

// Islamic Green Theme Notification
function showIslamicNotification(message, type = 'info', duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `islamic-notification ${type}`;
    
    let icon = 'fa-info-circle';
    let emoji = 'ℹ️';
    let bgColor = '#3b82f6';
    
    if (type === 'success') {
        icon = 'fa-check-circle';
        emoji = '✅';
        bgColor = '#10b981';
    } else if (type === 'error') {
        icon = 'fa-exclamation-circle';
        emoji = '❌';
        bgColor = '#ef4444';
    } else if (type === 'warning') {
        icon = 'fa-exclamation-triangle';
        emoji = '⚠️';
        bgColor = '#f59e0b';
    }
    
    notification.innerHTML = `
        <i class="fas ${icon}"></i>
        <span>${emoji} ${message}</span>
    `;
    
    notification.style.backgroundColor = bgColor;
    notification.style.color = 'white';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

async function loadStats() {
    try {
        console.log("📊 Counting your community members...");
        
        // Get all counts with error handling
        let totalUsers = 0;
        let pendingUsers = 0;
        let adminCount = 0;
        let activeUsers = 0;
        
        try {
            const { count } = await window.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true });
            totalUsers = count || 0;
        } catch (e) {
            console.log("Still counting total members...");
        }
        
        try {
            const { count } = await window.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('is_approved', false);
            pendingUsers = count || 0;
        } catch (e) {
            console.log("Still counting pending approvals...");
        }
        
        try {
            const { count } = await window.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('role', 'admin');
            adminCount = count || 0;
        } catch (e) {
            console.log("Still counting admins...");
        }
        
        try {
            const { count } = await window.supabase
                .from('profiles')
                .select('*', { count: 'exact', head: true })
                .eq('is_approved', true);
            activeUsers = count || 0;
        } catch (e) {
            console.log("Still counting active members...");
        }
        
        console.log("📊 Community stats ready:", { totalUsers, pendingUsers, activeUsers, adminCount });
        
        // Update all stat displays
        const elements = {
            'totalUsers': totalUsers,
            'pendingUsers': pendingUsers,
            'activeUsers': activeUsers,
            'adminCount': adminCount,
            'pendingCount': pendingUsers,
            'approvedCount': activeUsers,
            'adminCountSmall': adminCount,
            'totalCount': totalUsers,
            'pendingBadge': pendingUsers,
            'notificationCount': pendingUsers
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value || 0;
        });
        
        // Show friendly message if there are pending approvals
        if (pendingUsers > 0) {
            showIslamicNotification(`🕌 You have ${pendingUsers} member${pendingUsers > 1 ? 's' : ''} waiting for approval`, 'info', 4000);
        }
        
    } catch (err) {
        console.error("Error loading stats:", err);
    }
}

async function loadPendingUsers() {
    try {
        console.log("🔍 Looking for members waiting for approval...");
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('is_approved', false)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('pendingUsersGrid');
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <h3>All Caught Up! 🕌</h3>
                    <p>No pending approvals. May Allah bless your community.</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        data.forEach(user => {
            const date = new Date(user.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            html += `
                <div class="user-card pending" data-user-id="${user.id}">
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <div style="display: flex; gap: 1rem; flex: 1;">
                            <div class="user-avatar pending">
                                <i class="fas fa-user-clock"></i>
                            </div>
                            <div class="user-details">
                                <h4>${user.full_name || 'Waiting for Name'}</h4>
                                <p><i class="fas fa-envelope"></i> ${user.email}</p>
                                <p><i class="fas fa-map-marker-alt"></i> ${user.state || 'Location not shared'}</p>
                                <p class="meta-text"><i class="fas fa-clock"></i> Requested: ${date}</p>
                            </div>
                        </div>
                        <div class="user-actions">
                            <button class="btn-islamic btn-approve" onclick="approveUser('${user.id}')">
                                <i class="fas fa-check"></i> ✅ Approve
                            </button>
                            <button class="btn-islamic btn-reject" onclick="rejectUser('${user.id}')">
                                <i class="fas fa-times"></i> ❌ Decline
                            </button>
                            <button class="btn-islamic btn-view" onclick="viewUserDetails('${user.id}', '${user.full_name || ''}', '${user.email}', '${date}')">
                                <i class="fas fa-eye"></i> 👁️ Details
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
        if (data.length > 0) {
            showIslamicNotification(`📬 Found ${data.length} member${data.length > 1 ? 's' : ''} waiting for your approval`, 'info');
        }
        
    } catch (err) {
        console.error("Error loading pending users:", err);
        const container = document.getElementById('pendingUsersGrid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Requests</h3>
                    <p>Please refresh the page or try again later.</p>
                    <button class="btn-islamic btn-view" onclick="loadPendingUsers()">
                        <i class="fas fa-sync-alt"></i> Try Again
                    </button>
                </div>
            `;
        }
    }
}

// View user details function
window.viewUserDetails = function(userId, name, email, date) {
    showIslamicNotification(`
        👤 Member Details:
        • Name: ${name || 'Not provided'}
        • Email: ${email}
        • Requested: ${date}
    `, 'info', 5000);
};

async function loadAllMembers() {
    try {
        console.log("👥 Loading all community members...");
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const container = document.getElementById('membersGrid');
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <h3>Community Starting Fresh 🌱</h3>
                    <p>No members yet. Share your platform to grow your community.</p>
                </div>
            `;
            return;
        }
        
        // Store data for search and filtering
        window.allMembersData = data;
        
        // Show all members initially
        renderMembers(data);
        
    } catch (err) {
        console.error("Error loading members:", err);
        const container = document.getElementById('membersGrid');
        if (container) {
            container.innerHTML = `
                <div class="empty-state error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>Unable to Load Members</h3>
                    <p>Please refresh the page to try again.</p>
                </div>
            `;
        }
    }
}

function renderMembers(members) {
    const container = document.getElementById('membersGrid');
    if (!container) return;
    
    if (!members || members.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Members Found</h3>
                <p>Try a different filter or search term</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    members.forEach(user => {
        const isAdmin = user.role === 'admin';
        const isPending = !user.is_approved;
        const date = new Date(user.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        let cardClass = 'user-card';
        if (isPending) cardClass += ' pending';
        else if (isAdmin) cardClass += ' admin';
        
        html += `
            <div class="${cardClass}" data-user-id="${user.id}">
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <div style="display: flex; gap: 1rem; flex: 1;">
                        <div class="user-avatar ${isAdmin ? 'admin' : isPending ? 'pending' : ''}">
                            ${isAdmin ? '👑' : isPending ? '⏳' : '✅'}
                        </div>
                        <div class="user-details">
                            <h4>
                                ${user.full_name || 'Unnamed Member'}
                                ${isAdmin ? '<span class="admin-badge">👑 Admin</span>' : ''}
                            </h4>
                            <p><i class="fas fa-envelope"></i> ${user.email}</p>
                            <p><i class="fas fa-map-marker-alt"></i> ${user.state || 'Location not shared'}</p>
                            <div class="user-meta">
                                <span class="badge ${isAdmin ? 'admin' : ''}">
                                    ${isAdmin ? '👑' : '👤'} ${user.role || 'member'}
                                </span>
                                <span class="badge ${isPending ? 'pending' : 'approved'}">
                                    ${isPending ? '⏳' : '✅'} ${user.is_approved ? 'Approved' : 'Pending'}
                                </span>
                                <span class="badge">
                                    📅 Joined ${date}
                                </span>
                            </div>
                        </div>
                    </div>
                    <div class="user-actions">
                        ${isPending ? `
                            <button class="btn-islamic btn-approve" onclick="approveUser('${user.id}')">
                                <i class="fas fa-check"></i> ✅ Approve
                            </button>
                            <button class="btn-islamic btn-reject" onclick="rejectUser('${user.id}')">
                                <i class="fas fa-times"></i> ❌ Decline
                            </button>
                        ` : `
                            ${!isAdmin ? `
                                <button class="btn-islamic btn-admin" onclick="makeAdmin('${user.id}')">
                                    <i class="fas fa-crown"></i> 👑 Make Admin
                                </button>
                            ` : `
                                <button class="btn-islamic btn-remove-admin" onclick="removeAdmin('${user.id}')">
                                    <i class="fas fa-user-minus"></i> ⬇️ Remove Admin
                                </button>
                            `}
                            <button class="btn-islamic btn-revoke" onclick="revokeAccess('${user.id}')">
                                <i class="fas fa-ban"></i> ⏳ Revoke Access
                            </button>
                        `}
                    </div>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;
}

// Filter function for stat cards and tabs
window.filterMembers = function(filterType) {
    console.log("🔍 Filtering members:", filterType);
    
    // Update active tab
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.classList.remove('active');
        if (filterType === 'all' && tab.textContent.includes('All')) {
            tab.classList.add('active');
        } else if (filterType === 'pending' && tab.textContent.includes('Pending')) {
            tab.classList.add('active');
        } else if (filterType === 'approved' && tab.textContent.includes('Approved')) {
            tab.classList.add('active');
        } else if (filterType === 'admin' && tab.textContent.includes('Admins')) {
            tab.classList.add('active');
        }
    });
    
    if (!window.allMembersData) {
        loadAllMembers();
        return;
    }
    
    let filtered = [];
    let filterEmoji = '';
    
    switch(filterType) {
        case 'pending':
            filtered = window.allMembersData.filter(u => !u.is_approved);
            filterEmoji = '⏳';
            break;
        case 'approved':
            filtered = window.allMembersData.filter(u => u.is_approved === true && u.role === 'member');
            filterEmoji = '✅';
            break;
        case 'admin':
            filtered = window.allMembersData.filter(u => u.role === 'admin');
            filterEmoji = '👑';
            break;
        case 'all':
        default:
            filtered = window.allMembersData;
            filterEmoji = '👥';
            break;
    }
    
    renderMembers(filtered);
    showIslamicNotification(`${filterEmoji} Showing ${filtered.length} member${filtered.length !== 1 ? 's' : ''}`, 'info', 2000);
    
    // Scroll to members section
    document.getElementById('membersSection').scrollIntoView({ behavior: 'smooth' });
};

function setupSearch() {
    const searchBox = document.getElementById('memberSearch');
    if (!searchBox) return;
    
    searchBox.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!window.allMembersData) return;
        
        if (searchTerm.length < 2) {
            renderMembers(window.allMembersData);
            return;
        }
        
        const filtered = window.allMembersData.filter(user => 
            (user.full_name && user.full_name.toLowerCase().includes(searchTerm)) ||
            (user.email && user.email.toLowerCase().includes(searchTerm)) ||
            (user.state && user.state.toLowerCase().includes(searchTerm))
        );
        
        renderMembers(filtered);
        if (filtered.length > 0) {
            showIslamicNotification(`🔍 Found ${filtered.length} member${filtered.length !== 1 ? 's' : ''} matching "${searchTerm}"`, 'info', 2000);
        }
    });
}

async function loadRecentActivity() {
    try {
        console.log("📝 Checking recent community activity...");
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);
        
        if (error) throw error;
        
        const container = document.getElementById('activityTimeline');
        if (!container) return;
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <p>No recent activity to show</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        data.forEach(user => {
            const date = new Date(user.created_at).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            const action = user.is_approved ? 'was approved and joined' : 'requested to join';
            const icon = user.is_approved ? '✅' : '🆕';
            
            html += `
                <div class="timeline-item">
                    <div class="timeline-icon">
                        ${icon}
                    </div>
                    <div class="timeline-content">
                        <p><strong>${user.full_name || 'A new member'}</strong> ${action}</p>
                        <small><i class="fas fa-clock"></i> ${date}</small>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
        
    } catch (err) {
        console.error("Error loading activity:", err);
    }
}

// ============================================
// USER MANAGEMENT FUNCTIONS WITH FRIENDLY MESSAGES
// ============================================

window.approveUser = async function(userId) {
    try {
        console.log("✨ Approving member:", userId);
        
        const { data: user, error: fetchError } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (fetchError) {
            console.error("Error finding user:", fetchError);
            showIslamicNotification("Couldn't find this member. Please refresh and try again.", "error");
            return;
        }
        
        const { data, error } = await window.supabase
            .from('profiles')
            .update({ is_approved: true })
            .eq('id', userId)
            .select();
        
        if (error) {
            console.error("Approve error:", error);
            showIslamicNotification("Unable to approve: " + error.message, "error");
            return;
        }
        
        console.log("✅ Member approved:", data);
        showIslamicNotification(`🎉 Welcome! ${user.full_name || 'Member'} has been approved and can now access the platform!`, 'success');
        
        // Refresh all sections
        await Promise.all([
            loadStats(),
            loadPendingUsers(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Approval error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

// ================= FIXED REJECT USER - COMPLETE DELETION WITH POSTGRES FUNCTION =================
window.rejectUser = async function(userId) {
    if (!confirm('⚠️ Are you sure you want to decline this member? This will permanently delete their account and they can register again with the same email.')) return;
    
    try {
        console.log("Declining member:", userId);
        
        // First, get user details for logging
        const { data: user, error: fetchError } = await window.supabase
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();
        
        if (fetchError) {
            console.error("Error finding user:", fetchError);
            showIslamicNotification("Couldn't find this member request.", "error");
            return;
        }
        
        console.log("Found member to decline:", user);
        
        // Show processing notification
        showIslamicNotification("🔄 Permanently deleting user account...", "info", 3000);
        
        // STEP 1: Delete from profiles table first (due to foreign key)
        const { error: profileError } = await window.supabase
            .from('profiles')
            .delete()
            .eq('id', userId);
        
        if (profileError) {
            console.error("Error deleting profile:", profileError);
            showIslamicNotification("Error deleting profile: " + profileError.message, "error");
            return;
        }
        
        console.log("✅ Profile deleted successfully");
        
        // STEP 2: Call the PostgreSQL function to delete from auth.users
        const { data: fnResult, error: fnError } = await window.supabase
            .rpc('delete_auth_user_admin', { user_id: userId });
        
        if (fnError) {
            console.error("Error calling delete function:", fnError);
            showIslamicNotification(`⚠️ Profile deleted but auth record remains. The user may need to use a different email to register again.`, 'warning');
        } else {
            console.log("✅ Function result:", fnResult);
            
            if (fnResult && fnResult.startsWith('success')) {
                showIslamicNotification(`✅ ${user.full_name || user.email} has been permanently deleted. They can now register again with the same email!`, 'success');
            } else {
                showIslamicNotification(`⚠️ ${fnResult || 'Unknown error'}`, 'warning');
            }
        }
        
        // Refresh all sections
        await Promise.all([
            loadStats(),
            loadPendingUsers(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Rejection error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

window.makeAdmin = async function(userId) {
    if (!confirm('👑 Make this member an admin? They will have full access to the admin panel.')) return;
    
    try {
        console.log("Promoting to admin:", userId);
        
        const { data, error } = await window.supabase
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', userId)
            .select();
        
        if (error) {
            console.error("Make admin error:", error);
            showIslamicNotification("Couldn't make admin: " + error.message, "error");
            return;
        }
        
        console.log("Admin promotion successful:", data);
        showIslamicNotification('👑 Member has been promoted to Admin!', 'success');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Admin promotion error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

window.removeAdmin = async function(userId) {
    if (!confirm('⬇️ Remove admin privileges from this user? They will become a regular member.')) return;
    
    try {
        console.log("Removing admin:", userId);
        
        const { data, error } = await window.supabase
            .from('profiles')
            .update({ role: 'member' })
            .eq('id', userId)
            .select();
        
        if (error) {
            console.error("Remove admin error:", error);
            showIslamicNotification("Couldn't remove admin: " + error.message, "error");
            return;
        }
        
        console.log("Admin removal successful:", data);
        showIslamicNotification('⬇️ Admin privileges removed. User is now a regular member.', 'success');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Admin removal error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

window.revokeAccess = async function(userId) {
    if (!confirm('⏳ Revoke access for this member? They will need approval again to rejoin.')) return;
    
    try {
        console.log("Revoking access:", userId);
        
        const { data, error } = await window.supabase
            .from('profiles')
            .update({ is_approved: false })
            .eq('id', userId)
            .select();
        
        if (error) {
            console.error("Revoke error:", error);
            showIslamicNotification("Couldn't revoke access: " + error.message, "error");
            return;
        }
        
        console.log("Access revoked:", data);
        showIslamicNotification('⏳ Access revoked. Member moved to pending approval.', 'warning');
        
        await Promise.all([
            loadStats(),
            loadAllMembers(),
            loadPendingUsers(),
            loadRecentActivity()
        ]);
        
    } catch (err) {
        console.error("Revoke error:", err);
        showIslamicNotification("Something went wrong. Please try again.", "error");
    }
};

function setupAdminListeners() {
    // Refresh buttons
    const refreshPending = document.getElementById('refreshPending');
    if (refreshPending) {
        refreshPending.addEventListener('click', async function(e) {
            e.preventDefault();
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            
            await loadPendingUsers();
            
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> 🔄 Refresh';
            showIslamicNotification("✨ Pending approvals updated!", "success", 1500);
        });
    }
    
    const refreshMembers = document.getElementById('refreshMembers');
    if (refreshMembers) {
        refreshMembers.addEventListener('click', async function(e) {
            e.preventDefault();
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            
            await loadAllMembers();
            
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> 🔄 Refresh';
            showIslamicNotification("👥 Member list updated!", "success", 1500);
        });
    }
    
    const refreshActivity = document.getElementById('refreshActivity');
    if (refreshActivity) {
        refreshActivity.addEventListener('click', async function(e) {
            e.preventDefault();
            const btn = this;
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            
            await loadRecentActivity();
            
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-sync-alt"></i> 🔄 Refresh';
            showIslamicNotification("📝 Activity timeline updated!", "success", 1500);
        });
    }
    
    // Logout buttons
    const logoutBtns = document.querySelectorAll('#logoutBtn, .logout-btn-sidebar');
    logoutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async function() {
                await window.supabase.auth.signOut();
                showIslamicNotification("👋 See you next time, Admin!", "info", 2000);
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 2000);
            });
        }
    });
}

// Add animation styles dynamically
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);