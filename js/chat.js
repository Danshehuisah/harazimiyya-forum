// js/chat.js - Complete Group Chat with Voice Recording Controls and Online Counter
console.log("💬 Chat page loading...");

// Global variables
let currentUser = null;
let isAdmin = false;
let messagesSubscription = null;
let presenceSubscription = null;
let onlineUsers = new Set();
let mediaRecorder = null;
let audioChunks = [];
let recordingTimer = null;
let recordingSeconds = 0;
let recordedAudio = null;
let recordedAudioUrl = null;
let currentFile = null;
let currentFileType = 'image';
let selectedMemberId = null;
let messageReadTimer = null;
let currentChatPartner = null; // Track who we're currently chatting with

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM loaded, initializing chat...");
    
    function initializeChat() {
        if (!window.supabase) {
            console.log("⏳ Waiting for connection...");
            setTimeout(initializeChat, 100);
            return;
        }
        
        setupSidebar();
        loadChatData();
    }
    
    initializeChat();
});

// ================= SIDEBAR SETUP =================
function setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('openSidebar');
    const closeBtn = document.getElementById('closeSidebar');
    const overlay = document.getElementById('overlay');
    
    if (!sidebar) return;
    
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            sidebar.classList.add('active');
            if (overlay) overlay.classList.add('active');
        });
    }
    
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebar.classList.remove('active');
            if (overlay) overlay.classList.remove('active');
        });
    }
    
    if (overlay) {
        overlay.addEventListener('click', () => {
            sidebar.classList.remove('active');
            overlay.classList.remove('active');
        });
    }
}

// ================= ONLINE COUNTER =================
async function setupPresenceTracking() {
    try {
        const channel = window.supabase.channel('online-users', {
            config: { presence: { key: currentUser.id } }
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const presenceState = channel.presenceState();
                onlineUsers.clear();
                
                Object.values(presenceState).forEach(users => {
                    users.forEach(user => {
                        if (user.user_id !== currentUser.id) {
                            onlineUsers.add(user.user_id);
                        }
                    });
                });
                
                updateOnlineCount();
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                newPresences.forEach(p => { if (p.user_id !== currentUser.id) onlineUsers.add(p.user_id); });
                updateOnlineCount();
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                leftPresences.forEach(p => { if (p.user_id !== currentUser.id) onlineUsers.delete(p.user_id); });
                updateOnlineCount();
            });

        await channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
            }
        });

        presenceSubscription = channel;
    } catch (err) {
        console.error("Error setting up presence tracking:", err);
    }
}

function updateOnlineCount() {
    const onlineCountEl = document.getElementById('onlineCount');
    if (onlineCountEl) {
        const count = onlineUsers.size + 1;
        onlineCountEl.textContent = `${count} online`;
    }
}

// ================= MAIN CHAT FUNCTIONS =================
async function loadChatData() {
    try {
        const { data: { user }, error: userError } = await window.supabase.auth.getUser();
        if (userError || !user) {
            window.location.href = '../index.html';
            return;
        }
        
        currentUser = user;
        console.log("User logged in:", user.email);
        console.log("User ID:", currentUser.id);
        
        await loadUserProfile(user.id);
        await setupPresenceTracking();
        setupRealtimeSubscription();
        setupChatListeners();
        setupLogoutButtons();
        
        // Setup scroll listener for marking messages as read
        setupScrollListener();
        
    } catch (err) {
        console.error("Chat initialization error:", err);
    }
}

async function loadUserProfile(userId) {
    try {
        const { data, error } = await window.supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) throw error;
        
        isAdmin = data.role === 'admin';
        console.log("User role:", data.role, "isAdmin:", isAdmin);
        
        const userNameEl = document.getElementById('userName');
        if (userNameEl) userNameEl.textContent = data.full_name || 'Member';
        
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
            if (isAdmin) {
                userSelect.style.display = 'block';
                await loadMembers();
            } else {
                userSelect.style.display = 'none';
            }
        }
        
        await loadGroupMessages();
        
    } catch (err) {
        console.error("Error loading profile:", err);
    }
}

async function loadMembers() {
    if (!isAdmin) return;
    
    try {
        console.log("Loading members for admin private messaging...");
        
        const { data, error } = await window.supabase
            .from('profiles')
            .select('id, full_name, email')
            .eq('is_approved', true)
            .order('full_name');
        
        if (error) throw error;
        
        const userSelect = document.getElementById('userSelect');
        if (!userSelect) return;
        
        // Clear existing options
        userSelect.innerHTML = '';
        
        // Add default group option with empty value
        const defaultOption = document.createElement('option');
        defaultOption.value = '';  // Empty value = group chat
        defaultOption.textContent = '👥 Group Chat (All Members)';
        defaultOption.selected = true;
        userSelect.appendChild(defaultOption);
        
        // Add separator
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '──────────';
        userSelect.appendChild(separator);
        
        // Add individual members
        data.forEach(user => {
            if (user.id === currentUser?.id) return;
            const option = document.createElement('option');
            option.value = user.id;  // Member ID = private chat
            option.textContent = `👤 ${user.full_name || user.email} (Private)`;
            userSelect.appendChild(option);
        });
        
        // Set default to group
        selectedMemberId = null;
        currentChatPartner = null;
        console.log("Members loaded. Default: group chat");
        
    } catch (err) {
        console.error("Error loading members:", err);
    }
}

// ================= FIXED LOAD MESSAGES - SHOWS PRIVATE MESSAGES CORRECTLY =================
async function loadGroupMessages() {
    try {
        const messagesContainer = document.getElementById('messages');
        if (!messagesContainer) return;
        
        messagesContainer.innerHTML = `<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading messages...</div>`;
        
        let query;
        
        if (isAdmin && currentChatPartner) {
            // Admin viewing private chat with specific member
            console.log("Loading private messages between admin and member:", currentChatPartner);
            query = window.supabase
                .from('chat_messages')
                .select(`*, sender:sender_id(id, full_name, email, role)`)
                .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${currentChatPartner}),and(sender_id.eq.${currentChatPartner},receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });
        } else if (!isAdmin) {
            // Regular member - show group messages AND their private messages
            console.log("Loading messages for regular member");
            query = window.supabase
                .from('chat_messages')
                .select(`*, sender:sender_id(id, full_name, email, role)`)
                .or(`receiver_id.is.null,and(sender_id.eq.${currentUser.id}),and(receiver_id.eq.${currentUser.id})`)
                .order('created_at', { ascending: true });
        } else {
            // Admin viewing group chat (default)
            console.log("Loading group messages for admin");
            query = window.supabase
                .from('chat_messages')
                .select(`*, sender:sender_id(id, full_name, email, role)`)
                .is('receiver_id', null)
                .order('created_at', { ascending: true });
        }
        
        const { data: messages, error } = await query;
        
        if (error) throw error;
        
        if (!messages || messages.length === 0) {
            if (isAdmin && currentChatPartner) {
                // Get the member's name for better message
                const { data: member } = await window.supabase
                    .from('profiles')
                    .select('full_name')
                    .eq('id', currentChatPartner)
                    .single();
                
                messagesContainer.innerHTML = `<div class="empty-chat"><i class="fas fa-comments"></i><h3>No messages yet</h3><p>Start a private conversation with ${member?.full_name || 'this member'}!</p></div>`;
            } else {
                messagesContainer.innerHTML = `<div class="empty-chat"><i class="fas fa-comments"></i><h3>No messages yet</h3><p>Be the first to send a message!</p></div>`;
            }
            return;
        }
        
        renderMessages(messages);
        
        // Mark messages as read after loading
        setTimeout(() => {
            markAllVisibleMessagesAsRead();
        }, 1000);
        
    } catch (err) {
        console.error("Error loading messages:", err);
        messagesContainer.innerHTML = `<div class="empty-chat"><i class="fas fa-exclamation-triangle"></i><h3>Error loading messages</h3><p>Please refresh the page</p></div>`;
    }
}

// ================= MARK MESSAGES AS READ =================
function setupScrollListener() {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    messagesContainer.addEventListener('scroll', () => {
        if (messageReadTimer) clearTimeout(messageReadTimer);
        messageReadTimer = setTimeout(markAllVisibleMessagesAsRead, 500);
    });
}

async function markAllVisibleMessagesAsRead() {
    // Get ALL messages that are visible (both sent and received)
    const messageElements = document.querySelectorAll('.message');
    if (messageElements.length === 0) {
        console.log("No messages found");
        return;
    }
    
    const unreadMessageIds = [];
    
    messageElements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
        
        if (isVisible) {
            const messageId = el.dataset.messageId;
            const timeSpan = el.querySelector('.time');
            
            // Check if already marked as read (has ✓✓) - only for received messages
            if (el.classList.contains('received')) {
                if (timeSpan && !timeSpan.innerHTML.includes('✓✓')) {
                    unreadMessageIds.push(messageId);
                }
            }
        }
    });
    
    if (unreadMessageIds.length === 0) {
        console.log("No unread messages to mark");
        return;
    }
    
    console.log(`📖 Attempting to mark ${unreadMessageIds.length} messages as read:`, unreadMessageIds);
    
    // Update ALL these messages regardless of receiver_id
    const { error } = await window.supabase
        .from('chat_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadMessageIds)
        .is('read_at', null);
    
    if (error) {
        console.error("❌ Error marking messages as read:", error);
    } else {
        console.log(`✅ Successfully marked ${unreadMessageIds.length} messages as read`);
        
        // Update UI for all marked messages
        unreadMessageIds.forEach(id => {
            const msgEl = document.querySelector(`.message[data-message-id="${id}"]`);
            if (msgEl && msgEl.classList.contains('received')) {
                const timeSpan = msgEl.querySelector('.time');
                if (timeSpan && !timeSpan.innerHTML.includes('✓✓')) {
                    timeSpan.innerHTML = timeSpan.innerHTML.replace('✓', '✓✓');
                }
            }
        });
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messages');
    if (!container) return;
    
    let html = '';
    let lastDate = '';
    
    messages.forEach(msg => {
        const isSent = msg.sender_id === currentUser.id;
        const isGroup = !msg.receiver_id;
        const isPrivate = msg.receiver_id && (msg.receiver_id === currentUser.id || msg.sender_id === currentUser.id);
        
        const date = new Date(msg.created_at);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        let dateStr;
        if (date.toDateString() === today.toDateString()) dateStr = 'Today';
        else if (date.toDateString() === yesterday.toDateString()) dateStr = 'Yesterday';
        else dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        if (lastDate !== dateStr) {
            html += `<div class="date-separator"><span>${dateStr}</span></div>`;
            lastDate = dateStr;
        }
        
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const senderName = msg.sender?.full_name || msg.sender?.email || 'Unknown';
        const isAdminSender = msg.sender?.role === 'admin';
        const crown = isAdminSender ? ' 👑' : '';
        
        let messageLabel = '';
        if (isGroup) messageLabel = '📢 Group';
        else if (isPrivate) messageLabel = '🔒 Private';
        
        // Check if message is read
        const isRead = msg.read_at !== null;
        const readIndicator = !isSent ? (isRead ? ' ✓✓' : ' ✓') : '';
        
        html += `
            <div class="message ${isSent ? 'sent' : 'received'}" data-message-id="${msg.id}">
                ${!isSent ? `<small>${senderName}${crown} ${messageLabel}</small>` : ''}
                ${isSent && messageLabel ? `<small style="text-align: right;">${messageLabel}</small>` : ''}
                <div>${renderMessageContent(msg)}</div>
                <span class="time">${timeStr}${readIndicator}</span>
            </div>
        `;
    });
    
    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
}

function renderMessageContent(msg) {
    if (msg.message_type === 'text') return `<p>${msg.content}</p>`;
    if (msg.message_type === 'image') return `<img src="${msg.file_url}" alt="Image" onclick="window.open('${msg.file_url}')" style="max-width: 100%; cursor: pointer;">`;
    if (msg.message_type === 'video') return `<video controls style="max-width: 100%;"><source src="${msg.file_url}"></video>`;
    if (msg.message_type === 'audio') return `<audio controls style="width: 100%;"><source src="${msg.file_url}"></audio>`;
    return '<p>Unsupported message type</p>';
}

function setupRealtimeSubscription() {
    if (messagesSubscription) messagesSubscription.unsubscribe();
    
    messagesSubscription = window.supabase
        .channel('chat_messages_channel')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
            handleNewMessage(payload.new);
        })
        .subscribe();
}

async function handleNewMessage(newMessage) {
    // Only reload if message is relevant to current view
    const isRelevant = 
        (!newMessage.receiver_id && !currentChatPartner) || // Group message and viewing group
        (newMessage.receiver_id === currentUser.id && newMessage.sender_id === currentChatPartner) || // Received private
        (newMessage.sender_id === currentUser.id && newMessage.receiver_id === currentChatPartner) || // Sent private
        (!isAdmin && (newMessage.receiver_id === currentUser.id || !newMessage.receiver_id)); // Regular member
    
    if (isRelevant) {
        loadGroupMessages();
    }
}

// ================= FIXED CHAT LISTENERS =================
function setupChatListeners() {
    const sendBtn = document.getElementById('sendBtn');
    const messageInput = document.getElementById('messageInput');
    const imageBtn = document.getElementById('imageBtn');
    const videoBtn = document.getElementById('videoBtn');
    const voiceBtn = document.getElementById('voiceBtn');
    const fileInput = document.getElementById('fileInput');
    const userSelect = document.getElementById('userSelect');
    
    if (sendBtn) sendBtn.addEventListener('click', sendMessage);
    if (messageInput) {
        messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }
    
    if (userSelect) {
        userSelect.addEventListener('change', async (e) => {
            const value = e.target.value;
            console.log("Dropdown changed to value:", value);
            
            if (value === '' || value === 'group') {
                selectedMemberId = null;
                currentChatPartner = null;
                console.log("Selected: Group Chat - showing all group messages");
            } else {
                selectedMemberId = value;
                currentChatPartner = value;
                console.log("Selected: Private chat with member ID:", value, "- showing private messages only");
            }
            
            // Reload messages based on new selection
            await loadGroupMessages();
        });
    }
    
    if (imageBtn && fileInput) {
        imageBtn.addEventListener('click', () => {
            fileInput.accept = 'image/*';
            fileInput.click();
        });
    }
    
    if (videoBtn && fileInput) {
        videoBtn.addEventListener('click', () => {
            fileInput.accept = 'video/*';
            fileInput.click();
        });
    }
    
    if (fileInput) fileInput.addEventListener('change', handleFileSelect);
    if (voiceBtn) voiceBtn.addEventListener('click', toggleVoiceRecording);
}

// ================= VOICE RECORDING =================
async function toggleVoiceRecording() {
    const voiceBtn = document.getElementById('voiceBtn');
    const timerDiv = document.getElementById('recordingTimer');
    
    if (!mediaRecorder) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                recordedAudio = audioBlob;
                recordedAudioUrl = URL.createObjectURL(audioBlob);
                showAudioPreview(recordedAudioUrl);
                stream.getTracks().forEach(track => track.stop());
                mediaRecorder = null;
            };
            
            mediaRecorder.start();
            voiceBtn.innerHTML = '<i class="fas fa-stop"></i>';
            voiceBtn.style.backgroundColor = '#dc2626';
            
            recordingSeconds = 0;
            timerDiv.style.display = 'block';
            timerDiv.innerHTML = '🔴 Recording: 0s';
            
            recordingTimer = setInterval(() => {
                recordingSeconds++;
                timerDiv.innerHTML = `🔴 Recording: ${recordingSeconds}s`;
            }, 1000);
            
        } catch (err) {
            console.error("Error accessing microphone:", err);
            alert("Couldn't access microphone");
        }
    } else {
        mediaRecorder.stop();
        clearInterval(recordingTimer);
        recordingSeconds = 0;
        timerDiv.style.display = 'none';
        voiceBtn.innerHTML = '<i class="fas fa-microphone"></i>';
        voiceBtn.style.backgroundColor = '';
    }
}

function showAudioPreview(audioUrl) {
    const existingPreview = document.getElementById('audioPreview');
    if (existingPreview) existingPreview.remove();
    
    const chatInput = document.querySelector('.chat-input-area');
    const previewDiv = document.createElement('div');
    previewDiv.id = 'audioPreview';
    previewDiv.style.cssText = `display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px; width: 100%;`;
    
    previewDiv.innerHTML = `
        <audio controls src="${audioUrl}" style="flex: 1; height: 40px;"></audio>
        <button id="deletePreviewBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-trash"></i></button>
        <button id="sendPreviewBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
    `;
    
    chatInput.parentNode.insertBefore(previewDiv, chatInput);
    
    document.getElementById('deletePreviewBtn').addEventListener('click', () => {
        if (recordedAudioUrl) URL.revokeObjectURL(recordedAudioUrl);
        recordedAudio = null;
        recordedAudioUrl = null;
        previewDiv.remove();
    });
    
    document.getElementById('sendPreviewBtn').addEventListener('click', async () => {
        if (recordedAudio) {
            currentFile = new File([recordedAudio], 'voice-message.webm', { type: 'audio/webm' });
            currentFileType = 'audio';
            previewDiv.remove();
            await sendMessage();
        }
    });
}

// ================= FILE HANDLING =================
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    currentFile = file;
    
    if (file.type.startsWith('image/')) {
        currentFileType = 'image';
        showImagePreview(file);
    } else if (file.type.startsWith('video/')) {
        currentFileType = 'video';
        showVideoPreview(file);
    } else {
        alert("File type not supported");
        currentFile = null;
    }
}

function showImagePreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const existingPreview = document.getElementById('mediaPreview');
        if (existingPreview) existingPreview.remove();
        
        const chatInput = document.querySelector('.chat-input-area');
        const previewDiv = document.createElement('div');
        previewDiv.id = 'mediaPreview';
        previewDiv.style.cssText = `display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px; width: 100%;`;
        
        previewDiv.innerHTML = `
            <img src="${e.target.result}" style="max-width: 100px; max-height: 100px; border-radius: 4px;">
            <span style="flex: 1; color: var(--text-light);">${file.name}</span>
            <button id="deletePreviewBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-trash"></i></button>
            <button id="sendPreviewBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
        `;
        
        chatInput.parentNode.insertBefore(previewDiv, chatInput);
        
        document.getElementById('deletePreviewBtn').addEventListener('click', () => {
            currentFile = null;
            previewDiv.remove();
        });
        
        document.getElementById('sendPreviewBtn').addEventListener('click', async () => {
            previewDiv.remove();
            await sendMessage();
        });
    };
    reader.readAsDataURL(file);
}

function showVideoPreview(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const existingPreview = document.getElementById('mediaPreview');
        if (existingPreview) existingPreview.remove();
        
        const chatInput = document.querySelector('.chat-input-area');
        const previewDiv = document.createElement('div');
        previewDiv.id = 'mediaPreview';
        previewDiv.style.cssText = `display: flex; align-items: center; gap: 10px; padding: 10px; background: var(--card-bg); border-radius: 8px; margin-bottom: 10px; width: 100%;`;
        
        previewDiv.innerHTML = `
            <video src="${e.target.result}" style="max-width: 100px; max-height: 100px; border-radius: 4px;" controls></video>
            <span style="flex: 1; color: var(--text-light);">${file.name}</span>
            <button id="deletePreviewBtn" class="media-btn" style="background: var(--danger);"><i class="fas fa-trash"></i></button>
            <button id="sendPreviewBtn" class="media-btn" style="background: var(--primary-color);"><i class="fas fa-paper-plane"></i></button>
        `;
        
        chatInput.parentNode.insertBefore(previewDiv, chatInput);
        
        document.getElementById('deletePreviewBtn').addEventListener('click', () => {
            currentFile = null;
            previewDiv.remove();
        });
        
        document.getElementById('sendPreviewBtn').addEventListener('click', async () => {
            previewDiv.remove();
            await sendMessage();
        });
    };
    reader.readAsDataURL(file);
}

// ================= FIXED SEND MESSAGE - PRIVATE MESSAGING WORKS =================
async function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    
    if (!message && !currentFile && !recordedAudio) {
        alert("Please enter a message or select a file");
        return;
    }
    
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        let messageData = {
            sender_id: currentUser.id,
            message_type: 'text',
            content: message || '',
            created_at: new Date().toISOString(),
            read_at: null
        };
        
        // DEBUG: Log what's happening
        console.log("isAdmin:", isAdmin);
        console.log("selectedMemberId:", selectedMemberId);
        console.log("currentChatPartner:", currentChatPartner);
        
        // IMPORTANT: If admin selected a specific member, send private message
        if (isAdmin && selectedMemberId) {
            // Admin sending PRIVATE message to specific member
            messageData.receiver_id = selectedMemberId;
            console.log("✅ PRIVATE message to member:", selectedMemberId);
        } else {
            // GROUP message (for everyone)
            messageData.receiver_id = null;
            console.log("📢 GROUP message");
        }
        
        // Handle file
        if (currentFile) {
            const fileUrl = await uploadFile(currentFile);
            messageData.message_type = currentFileType;
            messageData.content = '';
            messageData.file_url = fileUrl;
            messageData.file_name = currentFile.name;
            currentFile = null;
        }
        
        // Handle recorded audio
        if (recordedAudio) {
            const fileUrl = await uploadFile(recordedAudio);
            messageData.message_type = 'audio';
            messageData.content = '';
            messageData.file_url = fileUrl;
            messageData.file_name = 'voice-message.webm';
            
            if (recordedAudioUrl) {
                URL.revokeObjectURL(recordedAudioUrl);
                recordedAudio = null;
                recordedAudioUrl = null;
            }
        }
        
        const { error } = await window.supabase
            .from('chat_messages')
            .insert([messageData]);
        
        if (error) throw error;
        
        messageInput.value = '';
        
    } catch (err) {
        console.error("Error sending message:", err);
        alert("Failed to send message");
    } finally {
        sendBtn.disabled = false;
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

async function uploadFile(file) {
    try {
        const fileExt = file.name.split('.').pop() || 'webm';
        const fileName = `${currentUser.id}/${Date.now()}.${fileExt}`;
        const filePath = `chat/${fileName}`;
        
        const { error: uploadError } = await window.supabase.storage
            .from('chat-files')
            .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = window.supabase.storage
            .from('chat-files')
            .getPublicUrl(filePath);
        
        return publicUrl;
        
    } catch (err) {
        console.error("Error uploading file:", err);
        throw err;
    }
}

// ================= LOGOUT =================
function setupLogoutButtons() {
    const logoutBtns = document.querySelectorAll('#logoutBtn, .logout-btn-sidebar');
    
    logoutBtns.forEach(btn => {
        if (btn) {
            btn.addEventListener('click', async () => {
                if (presenceSubscription) {
                    await presenceSubscription.untrack();
                    await presenceSubscription.unsubscribe();
                }
                await window.supabase.auth.signOut();
                window.location.href = '../index.html';
            });
        }
    });
}

// Add date separator styles
const style = document.createElement('style');
style.textContent = `
    .date-separator {
        text-align: center;
        margin: 20px 0 10px;
    }
    .date-separator span {
        background: var(--card-bg, #12332b);
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 12px;
        color: var(--text-muted, #9ca3af);
    }
`;
document.head.appendChild(style);