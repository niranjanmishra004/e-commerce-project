// cart.js - Shared Cart + Authentication State for NexaNest

const STORAGE_KEYS = {
    cart: 'nexanest_cart',
    users: 'nexanest_users',
    activeUser: 'nexanest_active_user',
    legacyUser: 'nexanest_user'
};

function safeReadJSON(key, fallback) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw);
    } catch (_err) {
        return fallback;
    }
}

function safeWriteJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
}

function sanitizeText(value) {
    return String(value || '').trim();
}

function normalizeEmail(email) {
    return sanitizeText(email).toLowerCase();
}

function getCart() {
    const cart = safeReadJSON(STORAGE_KEYS.cart, []);
    if (!Array.isArray(cart)) return [];

    return cart
        .map(item => ({
            title: sanitizeText(item.title),
            price: Number(item.price) || 0,
            image: sanitizeText(item.image),
            quantity: Math.max(1, Number(item.quantity) || 1)
        }))
        .filter(item => item.title && item.price > 0);
}

function saveCart(cart) {
    safeWriteJSON(STORAGE_KEYS.cart, Array.isArray(cart) ? cart : []);
}

function parsePrice(priceText) {
    return parseInt(String(priceText).replace(/[^\d]/g, ''), 10) || 0;
}

function showToast(message, type) {
    let toast = document.querySelector('.toast-notification');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'toast-notification';
        document.body.appendChild(toast);
    }

    const toastType = type === 'error' ? 'error' : 'success';
    toast.classList.remove('error', 'success');
    toast.classList.add(toastType);

    const icon = toastType === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;

    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 2600);
}

function getUsers() {
    const users = safeReadJSON(STORAGE_KEYS.users, []);
    return Array.isArray(users) ? users : [];
}

function saveUsers(users) {
    safeWriteJSON(STORAGE_KEYS.users, Array.isArray(users) ? users : []);
}

function setActiveUser(user) {
    safeWriteJSON(STORAGE_KEYS.activeUser, user);
    safeWriteJSON(STORAGE_KEYS.legacyUser, {
        name: user.name,
        email: user.email
    });
}

function getActiveUser() {
    const current = safeReadJSON(STORAGE_KEYS.activeUser, null);
    if (current && current.email) return current;

    const legacy = safeReadJSON(STORAGE_KEYS.legacyUser, null);
    if (legacy && legacy.email) {
        const migrated = {
            id: `legacy_${Date.now()}`,
            name: legacy.name || 'User',
            email: normalizeEmail(legacy.email),
            phone: '',
            address: '',
            pincode: '',
            password: '',
            authProvider: 'legacy',
            createdAt: new Date().toISOString()
        };
        setActiveUser(migrated);
        return migrated;
    }

    return null;
}

function clearActiveUser() {
    localStorage.removeItem(STORAGE_KEYS.activeUser);
    localStorage.removeItem(STORAGE_KEYS.legacyUser);
}

function findUserByEmail(email) {
    const normalizedEmail = normalizeEmail(email);
    return getUsers().find(user => normalizeEmail(user.email) === normalizedEmail) || null;
}

function validateRegistrationPayload(payload) {
    const errors = {};
    const name = sanitizeText(payload.name);
    const email = normalizeEmail(payload.email);
    const phone = sanitizeText(payload.phone);
    const address = sanitizeText(payload.address);
    const pincode = sanitizeText(payload.pincode);
    const password = String(payload.password || '');

    if (name.length < 2) {
        errors.name = 'Please enter your full name.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.email = 'Enter a valid email address.';
    }

    if (!/^\d{10}$/.test(phone)) {
        errors.phone = 'Phone number must be exactly 10 digits.';
    }

    if (address.length < 8) {
        errors.address = 'Please enter a complete address.';
    }

    if (!/^\d{6}$/.test(pincode)) {
        errors.pincode = 'Pincode must be exactly 6 digits.';
    }

    if (password.length < 6) {
        errors.password = 'Password must be at least 6 characters.';
    }

    return errors;
}

function registerUser(payload) {
    const normalized = {
        name: sanitizeText(payload.name),
        email: normalizeEmail(payload.email),
        phone: sanitizeText(payload.phone),
        address: sanitizeText(payload.address),
        pincode: sanitizeText(payload.pincode),
        password: String(payload.password || '')
    };

    const errors = validateRegistrationPayload(normalized);
    if (findUserByEmail(normalized.email)) {
        errors.email = 'An account with this email already exists.';
    }

    if (Object.keys(errors).length > 0) {
        return { ok: false, errors };
    }

    const users = getUsers();
    const newUser = {
        id: `user_${Date.now()}`,
        ...normalized,
        authProvider: 'email',
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    saveUsers(users);
    setActiveUser(newUser);
    updateHeaderAccountGreeting();
    return { ok: true, user: newUser };
}

function signInWithEmail(email, password) {
    const normalizedEmail = normalizeEmail(email);
    const plainPassword = String(password || '');

    if (!normalizedEmail || !plainPassword) {
        return { ok: false, message: 'Email and password are required.' };
    }

    const user = findUserByEmail(normalizedEmail);
    if (!user) {
        return { ok: false, message: 'No account found with this email.' };
    }

    if (String(user.password) !== plainPassword) {
        return { ok: false, message: 'Incorrect password.' };
    }

    setActiveUser(user);
    updateHeaderAccountGreeting();
    return { ok: true, user };
}

function signInWithGoogle() {
    const demoEmail = 'google.user@nexanest.demo';
    const existing = findUserByEmail(demoEmail);
    if (existing) {
        setActiveUser(existing);
        updateHeaderAccountGreeting();
        return { ok: true, user: existing, created: false };
    }

    const users = getUsers();
    const googleUser = {
        id: `google_${Date.now()}`,
        name: 'Google User',
        email: demoEmail,
        phone: '',
        address: '',
        pincode: '',
        password: '',
        authProvider: 'google',
        createdAt: new Date().toISOString()
    };

    users.push(googleUser);
    saveUsers(users);
    setActiveUser(googleUser);
    updateHeaderAccountGreeting();
    return { ok: true, user: googleUser, created: true };
}

function signOutUser() {
    clearActiveUser();
    updateHeaderAccountGreeting();
}

function requireAuth(redirectPath) {
    const user = getActiveUser();
    if (!user) {
        window.location.href = redirectPath || 'signin.html';
        return null;
    }
    return user;
}

function updateHeaderAccountGreeting() {
    const user = getActiveUser();
    const accountLinks = document.querySelectorAll('.topbar-right a');

    accountLinks.forEach(link => {
        const hasUserIcon = !!link.querySelector('.fa-user');
        const isAccountLink = hasUserIcon || link.classList.contains('account-link') || link.textContent.includes('Account') || link.textContent.includes('Hi,');
        if (!isAccountLink) return;

        const icon = link.querySelector('i');
        const iconClass = icon ? icon.className : 'fa-solid fa-user';

        if (user) {
            const firstName = sanitizeText(user.name).split(' ')[0] || 'User';
            link.innerHTML = `<i class="${iconClass}"></i> Hi, ${firstName}`;
            link.href = 'account.html';
        } else {
            link.innerHTML = `<i class="${iconClass}"></i> Account`;
            link.href = 'signin.html';
        }
    });
}

function updateCartUI() {
    const cart = getCart();
    let totalItems = 0;
    let totalPrice = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
        totalPrice += item.price * item.quantity;
    });

    const badges = document.querySelectorAll('.cart-badge');
    badges.forEach(badge => {
        badge.setAttribute('data-count', totalItems);
        badge.style.display = totalItems > 0 ? 'inline-flex' : 'none';
    });

    const cards = document.querySelectorAll('.market-card');
    cards.forEach(card => {
        const titleEl = card.querySelector('h3');
        const checkbox = card.querySelector('.cart-check');
        if (!titleEl || !checkbox) return;

        const plainTitle = sanitizeText(titleEl.textContent);
        const isInCart = cart.some(item => item.title === plainTitle);
        if (checkbox.checked !== isInCart) checkbox.checked = isInCart;
    });

    renderCartDrawerItems(cart, totalPrice);
    updateCheckoutSummary(cart, totalPrice);
}

function renderCartDrawerItems(cart, totalPrice) {
    const container = document.getElementById('cartItemsContainer');
    const subtotalEl = document.getElementById('cartSubtotal');
    if (!container || !subtotalEl) return;

    subtotalEl.textContent = `₹${totalPrice.toLocaleString('en-IN')}`;

    if (cart.length === 0) {
        container.innerHTML = `
            <div class="cart-empty-msg">
                <i class="fa-solid fa-basket-shopping" style="font-size: 2.5rem; color: #cbd5e1; margin-bottom: 0.75rem; display: block;"></i>
                Your shopping cart is empty.
            </div>
        `;
        return;
    }

    container.innerHTML = cart
        .map((item, index) => `
        <div class="cart-drawer-item" data-index="${index}">
            <img src="${item.image}" alt="${item.title}" class="cart-item-img">
            <div class="cart-item-details">
                <div class="cart-item-title" title="${item.title}">${item.title}</div>
                <div class="cart-item-price">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
                <div class="cart-item-qty-controls">
                    <button class="qty-btn qty-minus" data-index="${index}"><i class="fa-solid fa-minus"></i></button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn qty-plus" data-index="${index}"><i class="fa-solid fa-plus"></i></button>
                </div>
            </div>
            <button class="cart-item-remove" data-index="${index}" aria-label="Remove item"><i class="fa-solid fa-trash-can"></i></button>
        </div>
    `)
        .join('');
}

function updateCheckoutSummary(cart, totalPrice) {
    const checkoutModals = document.querySelectorAll('#checkout-modal');
    checkoutModals.forEach(modal => {
        const form = modal.querySelector('.checkout-form');
        if (!form) return;

        let summary = form.querySelector('.checkout-summary');
        if (!summary) {
            summary = document.createElement('div');
            summary.className = 'checkout-summary';
            form.insertBefore(summary, form.firstChild);
        }

        if (cart.length === 0) {
            summary.innerHTML = `
                <div class="checkout-summary-title">Order Summary</div>
                <div style="font-size: 0.85rem; color: #64748b;">No items in cart</div>
            `;
            return;
        }

        const itemsHtml = cart
            .map(item => `
                <div class="checkout-summary-item">
                    <span class="checkout-summary-item-name">${item.title} (x${item.quantity})</span>
                    <span>₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
                </div>
            `)
            .join('');

        summary.innerHTML = `
            <div class="checkout-summary-title">Order Summary</div>
            <div class="checkout-summary-items-list">${itemsHtml}</div>
            <div class="checkout-summary-total">
                <span>Total Amount</span>
                <span>₹${totalPrice.toLocaleString('en-IN')}</span>
            </div>
        `;
    });
}

function injectCartDrawerMarkup() {
    if (document.getElementById('cartDrawer')) return;

    const cartLinks = document.querySelectorAll('.cart-link');
    if (cartLinks.length === 0) return;

    const overlay = document.createElement('div');
    overlay.className = 'cart-drawer-overlay';
    overlay.id = 'cartOverlay';

    const drawer = document.createElement('div');
    drawer.className = 'cart-drawer';
    drawer.id = 'cartDrawer';
    drawer.innerHTML = `
        <div class="cart-drawer-header">
            <h2><i class="fa-solid fa-cart-shopping"></i> Shopping Cart</h2>
            <button class="cart-drawer-close" id="cartCloseBtn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="cart-drawer-items" id="cartItemsContainer"></div>
        <div class="cart-drawer-footer">
            <div class="cart-subtotal-row">
                <span class="cart-subtotal-label">Subtotal</span>
                <span class="cart-subtotal-val" id="cartSubtotal">₹0</span>
            </div>
            <button class="cart-checkout-btn" id="cartCheckoutBtn">Proceed to Checkout</button>
        </div>
    `;

    document.body.appendChild(overlay);
    document.body.appendChild(drawer);

    const closeDrawer = () => {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
        document.body.classList.remove('modal-open');
    };

    document.getElementById('cartCloseBtn').addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);

    cartLinks.forEach(link => {
        link.addEventListener('click', event => {
            event.preventDefault();
            drawer.classList.add('open');
            overlay.classList.add('open');
            document.body.classList.add('modal-open');
        });
    });

    document.getElementById('cartCheckoutBtn').addEventListener('click', () => {
        const cart = getCart();
        if (cart.length === 0) {
            showToast('Please add items to your cart first.', 'error');
            return;
        }
        closeDrawer();
        window.location.hash = '#checkout-modal';
    });

    drawer.addEventListener('click', event => {
        const plusBtn = event.target.closest('.qty-plus');
        const minusBtn = event.target.closest('.qty-minus');
        const removeBtn = event.target.closest('.cart-item-remove');
        if (!plusBtn && !minusBtn && !removeBtn) return;

        const cart = getCart();

        if (plusBtn) {
            const index = Number(plusBtn.dataset.index);
            if (!cart[index]) return;
            cart[index].quantity += 1;
            saveCart(cart);
            updateCartUI();
            return;
        }

        if (minusBtn) {
            const index = Number(minusBtn.dataset.index);
            if (!cart[index]) return;
            if (cart[index].quantity > 1) {
                cart[index].quantity -= 1;
            } else {
                cart.splice(index, 1);
            }
            saveCart(cart);
            updateCartUI();
            return;
        }

        const index = Number(removeBtn.dataset.index);
        if (!cart[index]) return;
        const removedTitle = cart[index].title;
        cart.splice(index, 1);
        saveCart(cart);
        updateCartUI();
        showToast(`Removed "${removedTitle}" from cart.`);
    });
}

function setupPageProductListeners() {
    document.body.addEventListener('change', event => {
        if (!event.target.classList.contains('cart-check')) return;

        const checkbox = event.target;
        const card = checkbox.closest('.market-card');
        if (!card) return;

        const titleEl = card.querySelector('h3');
        const priceEl = card.querySelector('.card-foot > span');
        const imgEl = card.querySelector('img');
        if (!titleEl || !priceEl || !imgEl) return;

        const title = sanitizeText(titleEl.textContent);
        const price = parsePrice(priceEl.textContent);
        const image = imgEl.src;

        const cart = getCart();
        const existingIndex = cart.findIndex(item => item.title === title);

        if (checkbox.checked) {
            if (existingIndex === -1) {
                cart.push({ title, price, image, quantity: 1 });
                showToast(`Added "${title}" to cart.`);
            }
        } else if (existingIndex !== -1) {
            cart.splice(existingIndex, 1);
            showToast(`Removed "${title}" from cart.`);
        }

        saveCart(cart);
        updateCartUI();
    });

    document.body.addEventListener('click', event => {
        const buyBtn = event.target.closest('.buy-now-btn');
        if (!buyBtn || buyBtn.closest('.detail-modal-actions')) return;

        const card = buyBtn.closest('.market-card');
        if (!card) return;

        const checkbox = card.querySelector('.cart-check');
        if (checkbox && !checkbox.checked) {
            checkbox.checked = true;
            checkbox.dispatchEvent(new Event('change'));
        }
    });

    document.body.addEventListener('click', event => {
        const detailsLink = event.target.closest('.product-media-link, .product-title-link');
        if (!detailsLink) return;

        event.preventDefault();
        const card = detailsLink.closest('.market-card');
        if (!card) return;

        const titleEl = card.querySelector('h3');
        const priceEl = card.querySelector('.card-foot > span');
        const imgEl = card.querySelector('img');
        const descEl = card.querySelector('p');
        const checkbox = card.querySelector('.cart-check');
        if (!titleEl || !priceEl || !imgEl || !descEl || !checkbox) return;

        openDynamicProductModal(
            sanitizeText(titleEl.textContent),
            imgEl.src,
            sanitizeText(priceEl.textContent),
            sanitizeText(descEl.textContent),
            checkbox.id
        );
    });

    const successToggles = document.querySelectorAll('.checkout-success-toggle');
    successToggles.forEach(toggle => {
        toggle.addEventListener('change', () => {
            if (!toggle.checked) return;
            saveCart([]);
            updateCartUI();
        });
    });
}

function openDynamicProductModal(title, img, price, desc, checkboxId) {
    let modal = document.getElementById('dynamic-product-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'dynamic-product-modal';
        modal.className = 'market-modal';
        document.body.appendChild(modal);
    }

    const inCart = getCart().some(item => item.title === title);
    const buttonLabel = inCart ? 'Added' : 'Add to Cart';
    const buttonIcon = inCart ? 'fa-check' : 'fa-cart-plus';
    const activeStyle = inCart ? 'style="background: linear-gradient(135deg, #10b981, #059669); border-color: #047857;"' : '';

    modal.innerHTML = `
        <a href="#" class="market-modal-overlay" aria-label="Close details"></a>
        <div class="market-modal-card detail-modal-card">
            <a href="#" class="market-modal-close" aria-label="Close details"><i class="fa-solid fa-xmark"></i></a>
            <div class="detail-modal-grid">
                <img src="${img}" alt="${title}">
                <div class="detail-modal-info">
                    <span class="tag">NexaNest Selects</span>
                    <h2>${title}</h2>
                    <div class="market-modal-price">${price}</div>
                    <p class="detail-modal-desc">${desc}</p>
                    <div class="detail-modal-actions">
                        <button class="add-cart-btn detail-add-btn" data-checkbox-id="${checkboxId}" ${activeStyle}>
                            <i class="fa-solid ${buttonIcon}"></i>
                            <span class="btn-lbl">${buttonLabel}</span>
                        </button>
                        <button class="buy-now-btn detail-buy-btn" data-checkbox-id="${checkboxId}">Buy Now</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const addBtn = modal.querySelector('.detail-add-btn');
    const buyBtn = modal.querySelector('.detail-buy-btn');

    addBtn.addEventListener('click', () => {
        const sourceCheckbox = document.getElementById(checkboxId);
        if (!sourceCheckbox) return;
        sourceCheckbox.checked = !sourceCheckbox.checked;
        sourceCheckbox.dispatchEvent(new Event('change'));

        const updatedInCart = getCart().some(item => item.title === title);
        addBtn.innerHTML = updatedInCart
            ? '<i class="fa-solid fa-check"></i><span class="btn-lbl">Added</span>'
            : '<i class="fa-solid fa-cart-plus"></i><span class="btn-lbl">Add to Cart</span>';
        if (updatedInCart) {
            addBtn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
            addBtn.style.borderColor = '#047857';
        } else {
            addBtn.style.background = '';
            addBtn.style.borderColor = '';
        }
    });

    buyBtn.addEventListener('click', () => {
        const sourceCheckbox = document.getElementById(checkboxId);
        if (sourceCheckbox && !sourceCheckbox.checked) {
            sourceCheckbox.checked = true;
            sourceCheckbox.dispatchEvent(new Event('change'));
        }
        window.location.hash = '#checkout-modal';
    });

    window.location.hash = '#dynamic-product-modal';
}

window.showToast = showToast;
window.updateHeaderAccountGreeting = updateHeaderAccountGreeting;
window.NexaNestAuth = {
    getUsers,
    getActiveUser,
    registerUser,
    signInWithEmail,
    signInWithGoogle,
    signOutUser,
    requireAuth,
    validateRegistrationPayload
};

document.addEventListener('DOMContentLoaded', () => {
    injectCartDrawerMarkup();
    setupPageProductListeners();
    updateCartUI();
    updateHeaderAccountGreeting();
});