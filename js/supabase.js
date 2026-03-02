// js/supabase.js - COMPLETE FIXED VERSION
const SUPABASE_URL = "https://lsbgpfvxmngjynvccujw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_JdRC9zq7TZFD-KFz7Shbqw_iDD30d9r";

console.log("🔧 Initializing Supabase...");

// Check if Supabase library is loaded
if (typeof supabase === 'undefined') {
    console.error("❌ Supabase library not loaded! Check your internet connection.");
    document.body.innerHTML += '<div style="color:red;padding:20px;">Error: Supabase SDK failed to load. Refresh the page.</div>';
} else {
    console.log("✅ Supabase SDK loaded");
    
    try {
        // Create client
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                autoRefreshToken: true,
                persistSession: true,
                detectSessionInUrl: true
            }
        });
        
        console.log("✅ Supabase client created successfully");
        
        // Test the connection
        window.supabase.auth.getSession().then(({ data, error }) => {
            if (error) {
                console.error("❌ Supabase connection test failed:", error);
            } else {
                console.log("✅ Supabase connection successful");
                // Dispatch event to notify other scripts
                window.dispatchEvent(new Event('supabase-ready'));
            }
        }).catch(err => {
            console.error("❌ Supabase test error:", err);
        });
        
    } catch (err) {
        console.error("❌ Failed to create Supabase client:", err);
    }
}


// sb_publishable_JdRC9zq7TZFD-KFz7Shbqw_iDD30d9r