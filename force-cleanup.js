// EMERGENCY CLEANUP SCRIPT - Run this in browser console to clear corrupted tokens
// This script will completely clear all localStorage and sessionStorage

console.log('🚨 STARTING EMERGENCY CLEANUP');

// Clear all localStorage
localStorage.clear();
console.log('✓ localStorage cleared');

// Clear all sessionStorage  
sessionStorage.clear();
console.log('✓ sessionStorage cleared');

// Clear all cookies for this domain
document.cookie.split(";").forEach(function(c) { 
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
});
console.log('✓ Cookies cleared');

// Clear all IndexedDB
if ('indexedDB' in window) {
  indexedDB.webkitGetDatabaseNames().onsuccess = function(sender,args) {
    var r = sender.target.result;
    for(var i in r) {
      indexedDB.deleteDatabase(r[i]);
    }
  };
}
console.log('✓ IndexedDB cleared');

console.log('🎉 CLEANUP COMPLETE - Please refresh the page');

// Force page reload after cleanup
setTimeout(() => {
  window.location.reload();
}, 1000);