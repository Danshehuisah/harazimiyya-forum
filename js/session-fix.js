// Simple session fix to prevent redirect loops
(function() {
    'use strict';
    
    console.log('Session fix loaded');
    
    // Track if we've already processed a redirect
    if (sessionStorage.getItem('redirectProcessed')) {
        console.log('Redirect already processed in this session');
        return;
    }
    
    // Only run on dashboard pages
    if (window.location.pathname.includes('member-dashboard.html') || 
        window.location.pathname.includes('admin.html')) {
        
        sessionStorage.setItem('redirectProcessed', 'true');
        
        // Clear the flag when leaving the site
        window.addEventListener('beforeunload', function() {
            if (window.location.pathname.includes('index.html')) {
                sessionStorage.removeItem('redirectProcessed');
            }
        });
    }
    
    // Clear flag on login page
    if (window.location.pathname.includes('index.html')) {
        sessionStorage.removeItem('redirectProcessed');
    }
})();