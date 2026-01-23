// Apply theme before React loads to prevent flash
(function() {
  var storageKey = 'oficaz-theme';
  var theme = localStorage.getItem(storageKey) || 'system';
  var isDark = false;
  
  if (theme === 'dark') {
    isDark = true;
  } else if (theme === 'system') {
    isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  
  if (isDark) {
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';
  }
})();
