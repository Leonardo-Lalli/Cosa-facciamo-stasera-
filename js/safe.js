// ===== DOM Safety Helper =====
// Usage: S('id') returns element or null, never throws
window.S = function(id) { return document.getElementById(id); };
// Safe classList operations
window.addClass = function(id, cls) { const el = S(id); if (el) el.classList.add(cls); };
window.removeClass = function(id, cls) { const el = S(id); if (el) el.classList.remove(cls); };
window.toggleClass = function(id, cls, force) { const el = S(id); if (el) el.classList.toggle(cls, force); };
// Safe text/display operations
window.setText = function(id, text) { const el = S(id); if (el) el.textContent = text; };
window.showEl = function(id) { removeClass(id, 'hidden'); };
window.hideEl = function(id) { addClass(id, 'hidden'); };
