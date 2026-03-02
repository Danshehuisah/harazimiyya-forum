// /js/app.js - Simple app script
console.log("App loaded");

document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM ready");
    
    // Wait for Firebase
    setTimeout(initApp, 1000);
});

function initApp() {
    console.log("Initializing app...");
    
    // Get DOM elements
    const showRegister = document.getElementById('showRegister');
    const showLogin = document.getElementById('showLogin');
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const authCard = document.getElementById('authCard');
    const registerCard = document.getElementById('registerCard');
    
    if (!authCard || !registerCard) {
        console.error("DOM elements not found");
        return;
    }
    
    // Switch to register
    if (showRegister) {
        showRegister.addEventListener('click', function() {
            authCard.classList.add('hidden');
            registerCard.classList.remove('hidden');
        });
    }
    
    // Switch to login
    if (showLogin) {
        showLogin.addEventListener('click', function() {
            registerCard.classList.add('hidden');
            authCard.classList.remove('hidden');
        });
    }
    
    // Login button
    if (loginBtn) {
        loginBtn.addEventListener('click', async function() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                alert('Please enter email and password');
                return;
            }
            
            loginBtn.textContent = 'Logging in...';
            loginBtn.disabled = true;
            
            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                console.log("Login successful");
                window.location.href = 'home.html';
            } catch (error) {
                console.error("Login error:", error);
                alert('Login failed: ' + error.message);
                loginBtn.textContent = 'Login';
                loginBtn.disabled = false;
            }
        });
    }
    
    // Register button
    if (registerBtn) {
        registerBtn.addEventListener('click', async function() {
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;
            
            if (!email || !password) {
                alert('Please enter email and password');
                return;
            }
            
            if (password.length < 6) {
                alert('Password must be at least 6 characters');
                return;
            }
            
            registerBtn.textContent = 'Registering...';
            registerBtn.disabled = true;
            
            try {
                // Create user
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Add to Firestore
                await db.collection('users').doc(user.uid).set({
                    uid: user.uid,
                    email: email,
                    role: 'member',
                    approved: false,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                alert('Registration successful! Please login.');
                registerCard.classList.add('hidden');
                authCard.classList.remove('hidden');
                document.getElementById('email').value = email;
                
            } catch (error) {
                console.error("Registration error:", error);
                alert('Registration failed: ' + error.message);
            } finally {
                registerBtn.textContent = 'Register';
                registerBtn.disabled = false;
            }
        });
    }
    
    // Check if already logged in
    if (auth) {
        auth.onAuthStateChanged(function(user) {
            if (user) {
                console.log("User already logged in, redirecting...");
                window.location.href = 'home.html';
            }
        });
    }
    
    console.log("App initialized");
}