// js/auth.js - COMPLETE FIXED VERSION WITH FRIENDLY MESSAGES AND AUTO PROFILE CREATION
document.addEventListener('DOMContentLoaded', function() {
    console.log("✨ Getting things ready for you...");
    
    // Wait for Supabase to be ready
    function waitForSupabase() {
        if (window.supabase && window.supabase.auth) {
            console.log("✅ All set! Let's get you started...");
            initializeAuth();
        } else {
            console.log("⏳ Just a moment...");
            setTimeout(waitForSupabase, 100);
        }
    }
    
    waitForSupabase();
});

function initializeAuth() {
    // Get DOM elements
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const forgotPassword = document.getElementById('forgotPassword');
    const backToLogin = document.getElementById('backToLogin');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const authCard = document.getElementById('authCard');
    const registerCard = document.getElementById('registerCard');
    const forgotCard = document.getElementById('forgotCard');
    
    // Password toggle elements
    const togglePassword = document.getElementById('togglePassword');
    const toggleRegPassword = document.getElementById('toggleRegPassword');
    const toggleRegConfirmPassword = document.getElementById('toggleRegConfirmPassword');
    
    const password = document.getElementById('password');
    const regPassword = document.getElementById('regPassword');
    const regConfirmPassword = document.getElementById('regConfirmPassword');

    // ================= PASSWORD VISIBILITY TOGGLE =================
    function setupPasswordToggle(toggleBtn, inputField) {
        if (toggleBtn && inputField) {
            toggleBtn.addEventListener('click', function() {
                const type = inputField.getAttribute('type') === 'password' ? 'text' : 'password';
                inputField.setAttribute('type', type);
                
                const icon = this.querySelector('i');
                if (type === 'text') {
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            });
        }
    }

    setupPasswordToggle(togglePassword, password);
    setupPasswordToggle(toggleRegPassword, regPassword);
    setupPasswordToggle(toggleRegConfirmPassword, regConfirmPassword);

    // ================= SWITCH FORMS =================
    if (showRegister) {
        showRegister.addEventListener('click', () => {
            authCard.classList.add('hidden');
            registerCard.classList.remove('hidden');
            if (forgotCard) forgotCard.classList.add('hidden');
        });
    }

    if (showLogin) {
        showLogin.addEventListener('click', () => {
            registerCard.classList.add('hidden');
            authCard.classList.remove('hidden');
            if (forgotCard) forgotCard.classList.add('hidden');
        });
    }
    
    if (forgotPassword) {
        forgotPassword.addEventListener('click', () => {
            authCard.classList.add('hidden');
            forgotCard.classList.remove('hidden');
        });
    }
    
    if (backToLogin) {
        backToLogin.addEventListener('click', () => {
            forgotCard.classList.add('hidden');
            authCard.classList.remove('hidden');
        });
    }

    // ================= EMAIL VALIDATION =================
    function isValidGmail(email) {
        const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
        return gmailRegex.test(email);
    }

    // ================= FRIENDLY CUSTOM ALERT =================
    function showCustomAlert(message, type = 'info') {
        const existingAlert = document.querySelector('.custom-alert');
        if (existingAlert) existingAlert.remove();
        
        const alert = document.createElement('div');
        alert.className = `custom-alert ${type}`;
        
        // Get appropriate icon and color based on message type
        let icon = 'fa-info-circle';
        let bgColor = '#3b82f6'; // blue for info
        
        if (type === 'success' || message.includes('✅') || message.includes('CHECK YOUR GMAIL')) {
            icon = 'fa-check-circle';
            bgColor = '#10b981'; // green for success
        } else if (type === 'error' || message.includes('❌') || message.includes('sorry')) {
            icon = 'fa-exclamation-circle';
            bgColor = '#ef4444'; // red for error
        } else if (type === 'warning') {
            icon = 'fa-exclamation-triangle';
            bgColor = '#f59e0b'; // orange for warning
        }
        
        alert.innerHTML = `
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        `;
        
        alert.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${bgColor};
            color: white;
            padding: 15px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
            font-size: 15px;
            line-height: 1.5;
        `;
        
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => alert.remove(), 300);
        }, 5000);
    }

    // ================= FORGOT PASSWORD =================
    if (resetPasswordBtn) {
        resetPasswordBtn.addEventListener('click', async () => {
            const email = document.getElementById('resetEmail').value.trim();
            
            if (!email) {
                showCustomAlert('🤔 Oops! Please enter your email address so we can help you.', 'error');
                return;
            }
            
            if (!isValidGmail(email)) {
                showCustomAlert('📧 For now, we only support Gmail addresses. Please use your Gmail account.', 'error');
                return;
            }
            
            resetPasswordBtn.disabled = true;
            resetPasswordBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

            try {
                const { error } = await window.supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: window.location.origin + 'html/reset-password.html',
                });
                
                if (error) throw error;
                
                showCustomAlert('✅ Done! We\'ve sent a password reset link to your email. Please check your inbox (and spam folder just in case!).', 'success');
                
                setTimeout(() => {
                    forgotCard.classList.add('hidden');
                    authCard.classList.remove('hidden');
                    document.getElementById('resetEmail').value = '';
                }, 3000);
                
            } catch (err) {
                console.error("Reset password error:", err);
                
                // Friendly error messages
                if (err.message.includes('Email not found')) {
                    showCustomAlert('🤷 Hmm, we don\'t have an account with that email. Would you like to create one?', 'error');
                } else if (err.message.includes('rate limit')) {
                    showCustomAlert('⏰ Too many attempts! Please wait a few minutes before trying again.', 'error');
                } else {
                    showCustomAlert('😕 Something went wrong. Please try again in a moment.', 'error');
                }
            } finally {
                resetPasswordBtn.disabled = false;
                resetPasswordBtn.innerHTML = 'Send Reset Link';
            }
        });
    }

    // ================= LOGIN WITH PROPER UNAPPROVED HANDLING =================
    if (loginBtn) {
        loginBtn.addEventListener('click', async () => {
            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            if (!email || !password) {
                showCustomAlert('🔑 Please enter both your email and password to continue.', 'error');
                return;
            }

            loginBtn.disabled = true;
            loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

            try {
                const { data, error } = await window.supabase.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) throw error;

                console.log("✅ Login successful, checking approval status...");

                // Check if user has a profile
                const { data: profile, error: profileError } = await window.supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                if (profileError) {
                    console.warn("Profile fetch warning:", profileError);
                    // If no profile, something is wrong - log them out
                    await window.supabase.auth.signOut();
                    showCustomAlert('❌ Account setup incomplete. Please contact admin.', 'error');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'Login';
                    return;
                }

                // Check if user is approved
                if (!profile.is_approved) {
                    console.log("User not approved yet");
                    await window.supabase.auth.signOut();
                    showCustomAlert('⏳ Your account is waiting for admin approval. You\'ll receive an email once approved!', 'warning');
                    loginBtn.disabled = false;
                    loginBtn.innerHTML = 'Login';
                    return;
                }

                // User is approved - redirect based on role
                console.log("✅ User approved, redirecting...");
                if (profile.role === 'admin') {
                    window.location.href = 'html/admin.html';
                } else {
                    window.location.href = 'html/home.html';
                }

            } catch (err) {
                console.error("Login error:", err);
                
                // Friendly login error messages
                if (err.message.includes('Email not confirmed')) {
                    showCustomAlert('📧 Please check your email and click the confirmation link to activate your account.', 'error');
                } else if (err.message.includes('Invalid login credentials')) {
                    showCustomAlert('🔐 Hmm, the email or password doesn\'t match. Want to try again or reset your password?', 'error');
                } else {
                    showCustomAlert('😓 Sorry, we couldn\'t log you in. Please try again.', 'error');
                }
                
                loginBtn.disabled = false;
                loginBtn.innerHTML = 'Login';
            }
        });
    }

    // ================= REGISTER WITH AUTO PROFILE CREATION =================
    if (registerBtn) {
        registerBtn.addEventListener('click', async () => {
            const name = document.getElementById('regName').value.trim();
            const email = document.getElementById('regEmail').value.trim();
            const password = document.getElementById('regPassword').value;
            const confirm = document.getElementById('regConfirmPassword').value;

            // Friendly validation messages
            if (!name || !email || !password) {
                showCustomAlert('📝 Please fill in all the fields to create your account.', 'error');
                return;
            }

            if (name.length < 2) {
                showCustomAlert('👤 Please enter your full name so we know what to call you!', 'error');
                return;
            }

            if (!isValidGmail(email)) {
                showCustomAlert('📧 For now, we only support Gmail addresses. Please use your Gmail account.', 'error');
                return;
            }

            if (password.length < 6) {
                showCustomAlert('🔒 For your security, please use at least 6 characters for your password.', 'error');
                return;
            }

            if (password !== confirm) {
                showCustomAlert('🤔 The passwords don\'t match. Let\'s try again!', 'error');
                return;
            }

            registerBtn.disabled = true;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating your account...';

            try {
                const { data, error } = await window.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: name
                        }
                    }
                });

                if (error) throw error;

                // Check if this was a real registration or an existing user
                const isRealRegistration = data?.user?.identities && data.user.identities.length > 0;
                const hasConfirmationSent = data?.user?.confirmation_sent_at !== null;
                
                if (isRealRegistration && hasConfirmationSent) {
                    // ===== AUTO-CREATE PROFILE =====
                    try {
                        console.log("📝 Creating profile for new user:", data.user.id);
                        
                        const { error: profileError } = await window.supabase
                            .from('profiles')
                            .insert([{
                                id: data.user.id,
                                email: email,
                                full_name: name,
                                role: 'member',
                                is_approved: false,
                                created_at: new Date().toISOString()
                            }]);
                        
                        if (profileError) {
                            console.error("Error creating profile:", profileError);
                            showCustomAlert('⚠️ Account created but profile setup had an issue. Please contact admin.', 'warning');
                        } else {
                            console.log("✅ Profile created successfully");
                        }
                    } catch (profileErr) {
                        console.error("Profile creation error:", profileErr);
                    }
                    
                    showCustomAlert('🎉 Awesome! We\'ve sent a confirmation email to ' + email + '. Please check your inbox (and spam folder) to verify your account!', 'success');
                    
                    setTimeout(() => {
                        registerCard.classList.add('hidden');
                        authCard.classList.remove('hidden');
                        document.getElementById('email').value = email;
                    }, 4000);
                    
                    // Clear form
                    document.getElementById('regName').value = '';
                    document.getElementById('regEmail').value = '';
                    document.getElementById('regPassword').value = '';
                    document.getElementById('regConfirmPassword').value = '';
                    
                } else {
                    // This email is already registered but Supabase won't tell us directly
                    showCustomAlert('📧 This email is already registered. Would you like to log in instead?', 'error');
                    registerBtn.disabled = false;
                    registerBtn.innerHTML = 'Create Account';
                    
                    // Show login form after a moment
                    setTimeout(() => {
                        registerCard.classList.add('hidden');
                        authCard.classList.remove('hidden');
                        document.getElementById('email').value = email;
                    }, 3000);
                }

            } catch (err) {
                console.error("Registration error:", err);
                
                // Friendly registration error messages
                if (err.message.includes('User already registered')) {
                    showCustomAlert('👋 Hey! You already have an account with this email. Want to log in instead?', 'error');
                    
                    // Switch to login form
                    setTimeout(() => {
                        registerCard.classList.add('hidden');
                        authCard.classList.remove('hidden');
                        document.getElementById('email').value = email;
                    }, 2000);
                } else {
                    showCustomAlert('😕 Something went wrong. Please try again in a moment.', 'error');
                }
                
                registerBtn.disabled = false;
                registerBtn.innerHTML = 'Create Account';
            }
        });
    }

    // ================= CHECK EXISTING SESSION =================
    window.supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session) {
            try {
                const { data: profile } = await window.supabase
                    .from('profiles')
                    .select('role, is_approved')
                    .eq('id', session.user.id)
                    .single();
                
                if (profile && profile.is_approved) {
                    if (profile.role === 'admin') {
                        window.location.href = 'html/admin.html';
                    } else {
                        window.location.href = 'html/home.html';
                    }
                }
            } catch (err) {
                console.log("👋 Welcome back!");
            }
        }
    });
}

// Add animation styles with unique name
const authStyles = document.createElement('style');
authStyles.textContent = `
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
document.head.appendChild(authStyles);