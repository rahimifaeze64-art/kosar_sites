// Offline Mode Configuration
// This file ensures all API calls are disabled and localStorage is used

(function() {
    'use strict';
    
    console.log('🔒 Offline mode activated - using localStorage only');
    
    // Override CONFIG.API_ENABLED if it exists
    if (typeof CONFIG !== 'undefined') {
        CONFIG.API_ENABLED = false;
    }
    
    // Disable APIDataModule if it exists
    if (typeof APIDataModule !== 'undefined') {
        APIDataModule.isAvailable = false;
    }
    
    // Disable APIOrdersModule if it exists
    if (typeof APIOrdersModule !== 'undefined') {
        APIOrdersModule.isAPIEnabled = function() {
            return false;
        };
    }
    
    // Disable APIModule if it exists
    if (typeof APIModule !== 'undefined') {
        APIModule.disabled = true;
        APIModule.init = async function() {
            console.log('🔒 APIModule disabled - offline mode');
        };
    }
    
    console.log('✅ Offline mode configured successfully');
})();
