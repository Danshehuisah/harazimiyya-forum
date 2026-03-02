// js/reset-password.js - UPDATED VERSION WITH TOKEN HANDLING
document.addEventListener('DOMContentLoaded', function() {
    console.log("🔐 Reset password page loaded");
    
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const tokenHash = urlParams.get('token_hash');
    const type = urlParams.get('type');
    const email = urlParams.get('email');
    
    console.log("URL params:", { tokenHash, type, email });
    
    // DOM elements
    const toggleNew = document.getElementById('toggleNewPassword');
    const toggleConfirm = document.getElementById('toggleConfirmPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const updateBtn = document.getElementById('updatePasswordBtn');
    
    // ===== PASSWORD TOGGLE =====
    if (toggleNew && newPassword) {
        toggleNew.addEventListener('click', () => {
            const type = newPassword.type === 'password' ? 'text' : 'password';
            newPassword.type = type;
            toggleNew.innerHTML = type === 'text' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
    }
    
    if (toggleConfirm && confirmPassword) {
        toggleConfirm.addEventListener('click', () => {
            const type = confirmPassword.type === 'password' ? 'text' : 'password';
            confirmPassword.type = type;
            toggleConfirm.innerHTML = type === 'text' ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
        });
    }
    
    // ===== MESSAGE FUNCTION =====
    function showMessage(text, type = 'info') {
        const msg = document.createElement('div');
        msg.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10b981' : type === 'error' ? '#ef4444' : '#3b82f6'};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        msg.textContent = text;
        document.body.appendChild(msg);
        setTimeout(() => msg.remove(), 4000);
    }
    
    // ===== VERIFY TOKEN AND CREATE SESSION =====
    async function verifyToken() {
        if (!tokenHash || type !== 'recovery') {
            console.log("No recovery token found");
            return false;
        }
        
        try {
            console.log("Attempting to verify token...");
            
            // Verify the OTP and create session
            const { error } = await window.supabase.auth.verifyOtp({
                token_hash: tokenHash,
                type: 'recovery'
            });
            
            if (error) throw error;
            
            console.log("✅ Token verified, session created");
            showMessage('Session verified. You can now reset your password.', 'success');
            return true;
            
        } catch (err) {
            console.error('Token verification error:', err);
            showMessage('Invalid or expired reset link. Please request a new one.', 'error');
            setTimeout(() => window.location.href = 'index.html', 3000);
            return false;
        }
    }
    
    // ===== UPDATE PASSWORD =====
    async function handleUpdatePassword() {
        const newPass = newPassword.value.trim();
        const confirm = confirmPassword.value.trim();
        
        if (!newPass || !confirm) {
            showMessage('Please fill in both fields', 'error');
            return;
        }
        
        if (newPass.length < 6) {
            showMessage('Password must be at least 6 characters', 'error');
            return;
        }
        
        if (newPass !== confirm) {
            showMessage('Passwords do not match', 'error');
            return;
        }
        
        updateBtn.disabled = true;
        updateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating...';
        
        try {
            if (!window.supabase?.auth) {
                throw new Error('Supabase not initialized');
            }
            
            console.log("Attempting to update password...");
            
            const { error } = await window.supabase.auth.updateUser({
                password: newPass
            });
            
            if (error) throw error;
            
            showMessage('✅ Password updated! Redirecting to login...', 'success');
            setTimeout(() => window.location.href = '../index.html', 2000);
            
        } catch (err) {
            console.error('Update error:', err);
            
            if (err.message.includes('session_not_found') || err.message.includes('session missing')) {
                showMessage('Your session has expired. Please request a new reset link.', 'error');
                setTimeout(() => window.location.href = '../index.html', 3000);
            } else {
                showMessage('Error: ' + err.message, 'error');
            }
            
            updateBtn.disabled = false;
            updateBtn.innerHTML = 'Update Password';
        }
    }
    
    // ===== WAIT FOR SUPABASE AND INITIALIZE =====
    function waitForSupabase(callback, maxAttempts = 30) {
        if (window.supabase && window.supabase.auth) {
            console.log("✅ Supabase ready");
            callback();
            return;
        }
        
        let attempts = 0;
        
        function check() {
            attempts++;
            
            if (window.supabase && window.supabase.auth) {
                console.log(`✅ Supabase ready after ${attempts} attempts`);
                callback();
            } else if (attempts >= maxAttempts) {
                console.error(`❌ Supabase not ready after ${maxAttempts} attempts`);
                showMessage('Failed to connect. Please refresh the page.', 'error');
            } else {
                console.log(`⏳ Waiting for Supabase... attempt ${attempts}/${maxAttempts}`);
                setTimeout(check, 200);
            }
        }
        
        check();
    }
    
    // ===== START =====
    waitForSupabase(async () => {
        console.log("🚀 Initializing reset page");
        
        // First, verify the token if present
        if (tokenHash) {
            const verified = await verifyToken();
            if (!verified) return;
        } else {
            // Check if we already have a session
            const { data: { session } } = await window.supabase.auth.getSession();
            if (!session) {
                showMessage('No active session. Please request a new reset link.', 'error');
                setTimeout(() => window.location.href = '../index.html', 3000);
                return;
            }
        }
        
        // Add event listener
        updateBtn.addEventListener('click', handleUpdatePassword);
        
        // Enter key support
        newPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUpdatePassword();
        });
        
        confirmPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleUpdatePassword();
        });
    });
});

// Add animation styles
const resetStyles = document.createElement('style');
resetStyles.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
`;
document.head.appendChild(resetStyles);