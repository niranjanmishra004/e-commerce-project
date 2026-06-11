// modal-scroll-fix.js
// Prevents scrolling on body when target hashes are active (e.g., #checkout-modal, #dynamic-product-modal)
(function() {
    function checkHash() {
        const hash = window.location.hash;
        if (hash && hash !== '#' && !hash.startsWith('#category-')) {
            document.body.classList.add('modal-open');
        } else {
            document.body.classList.remove('modal-open');
        }
    }

    window.addEventListener('hashchange', checkHash);
    window.addEventListener('DOMContentLoaded', checkHash);
})();
