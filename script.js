
let db, auth;
if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();
} else {
    console.error("Firebase kütüphanesi eksik!");
}

// --- GÜVENLİK: XSS KORUMASI ---
function escapeHTML(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));
}

// --- YARDIMCI FONKSİYONLAR ---
function showLoading() { document.getElementById('loading-overlay').style.display = 'flex'; }
function hideLoading() { document.getElementById('loading-overlay').style.display = 'none'; }
function showToast(icon, title) {
    if(typeof Swal !== 'undefined') {
        Swal.fire({ position: 'top-end', icon: icon, title: title, showConfirmButton: false, timer: 1500, toast: true });
    } else {
        console.log(title);
    }
}

// --- SAYFA YÜKLENİNCE ---
document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    loadSiteSettings();
    
    // Mobil Menü
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if(hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = hamburger.querySelector('i');
            if(navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars'); icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times'); icon.classList.add('fa-bars');
            }
        });
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => { navLinks.classList.remove('active'); });
        });
    }

    const path = window.location.pathname;

    if (path.includes('index.html') || path === '/' || path.endsWith('/')) {
        loadProductsHomePage();
        setupStarRating();
        const reveals = document.querySelectorAll('.scroll-reveal');
        window.addEventListener('scroll', () => {
            const windowHeight = window.innerHeight;
            reveals.forEach(reveal => { if (reveal.getBoundingClientRect().top < windowHeight - 50) reveal.classList.add('active'); });
        });
    }
    if (path.includes('siparislerim.html')) loadUserOrders();
    if (path.includes('sepet.html')) loadCartPage();
    if (path.includes('admin.html')) {
        auth.onAuthStateChanged(user => {
            if (user && user.email === 'mckonca@gmail.com') { 
                document.getElementById('admin-login-screen').style.display = 'none';
                document.getElementById('admin-dashboard').style.display = 'block';
                loadAdminOrders(); loadAdminProducts(); calculateStats(); loadCoupons(); loadAdminSettings(); initDashboardCharts(); loadAdminBlog();
            } else {
                document.getElementById('admin-login-screen').style.display = 'flex';
                document.getElementById('admin-dashboard').style.display = 'none';
            }
        });
    }
    if (path.includes('blog.html')) loadBlogPage();

    if(auth && !path.includes('admin.html')) {
        auth.onAuthStateChanged(user => {
            const userBtn = document.getElementById('user-menu-btn');
            if (user) {
                if(userBtn) userBtn.innerHTML = '<i class="fas fa-user-check"></i> Hesabım';
                closeAuthModal();
            } else {
                if(userBtn) userBtn.innerHTML = '<i class="fas fa-user"></i> Giriş Yap';
            }
        });
    }
});

// --- ÜRÜN FİLTRELEME & ARAMA ---
let allProductsCache = [];
let currentCategory = 'all';

async function loadProductsHomePage() {
    const container = document.getElementById('dynamic-products');
    if (!container) return;
    container.innerHTML = '<p style="text-align:center; width:100%;">Ürünler Yükleniyor...</p>';
    try {
        const snapshot = await db.collection('urunler').get();
        allProductsCache = [];
        snapshot.forEach(doc => { let p = doc.data(); p.id = doc.id; allProductsCache.push(p); });
        renderProducts(allProductsCache);
    } catch (e) { console.error(e); container.innerHTML = "<p>Ürünler yüklenirken hata oluştu.</p>"; }
}

function renderProducts(products) {
    const container = document.getElementById('dynamic-products');
    container.innerHTML = ""; 
    if (products.length === 0) { container.innerHTML = "<p style='grid-column: 1/-1; text-align:center;'>Bu kriterlere uygun ürün bulunamadı.</p>"; return; }
    
    products.forEach(p => {
        let btnDisabled = p.stok <= 0 ? 'disabled style="background:gray; cursor:not-allowed;"' : '';
        let btnText = p.stok <= 0 ? 'TÜKENDİ' : 'Sepete Ekle';
        let ratingHtml = p.ortalamaPuan ? `<div style="color:gold; margin-bottom:5px;"><i class="fas fa-star"></i> ${p.ortalamaPuan.toFixed(1)} <small style="color:#666;">(${p.yorumSayisi || 0})</small></div>` : '';

        container.innerHTML += `
            <div class="product-card scroll-reveal active" onclick="openProductDetail('${p.id}')">
                <img src="${escapeHTML(p.resim)}" alt="${escapeHTML(p.ad)}" onerror="this.src='https://via.placeholder.com/300'">
                <h3>${escapeHTML(p.ad)}</h3>${ratingHtml}
                <p>${escapeHTML(p.aciklama).substring(0, 50)}...</p>
                <span class="price">${escapeHTML(p.fiyat)} TL</span>
                <button class="btn-cart" ${btnDisabled} onclick="event.stopPropagation(); addToCart('${p.id}', '${escapeHTML(p.ad)}', ${p.fiyat}, '${escapeHTML(p.resim)}', ${p.stok})">${btnText}</button>
            </div>`;
    });
}

function filterByCategory(category, btn) {
    currentCategory = category;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filterProducts();
}

function filterProducts() {
    const searchTerm = document.getElementById('product-search').value.toLowerCase();
    const filtered = allProductsCache.filter(p => {
        const pCat = p.kategori || 'Diğer'; 
        const categoryMatch = (currentCategory === 'all') || (pCat === currentCategory);
        const searchMatch = p.ad.toLowerCase().includes(searchTerm);
        return categoryMatch && searchMatch;
    });
    renderProducts(filtered);
}

// --- DETAY & YORUM ---
let currentProductId = null;
async function openProductDetail(productId) {
    showLoading();
    currentProductId = productId;
    const doc = await db.collection('urunler').doc(productId).get();
    if(!doc.exists) { hideLoading(); return; }
    const p = doc.data();
    
    document.getElementById('detail-img').src = escapeHTML(p.resim);
    document.getElementById('detail-title').innerText = p.ad;
    document.getElementById('detail-price').innerText = p.fiyat + " TL";
    document.getElementById('detail-desc').innerText = p.aciklama;
    document.getElementById('detail-avg-score').innerText = p.ortalamaPuan ? p.ortalamaPuan.toFixed(1) : "0.0";
    document.getElementById('detail-review-count').innerText = p.yorumSayisi || 0;
    
    const btn = document.getElementById('detail-add-btn');
    if(p.stok <= 0) { btn.innerText = "TÜKENDİ"; btn.disabled = true; btn.style.background = 'gray'; }
    else { btn.innerText = "Sepete Ekle"; btn.disabled = false; btn.style.background = 'var(--accent-color)'; btn.onclick = () => addToCart(productId, p.ad, p.fiyat, p.resim, p.stok); }

    await loadReviews(productId);
    hideLoading();
    document.getElementById('product-detail-modal').style.display = 'flex';
}

async function loadReviews(productId) {
    const list = document.getElementById('reviews-list');
    list.innerHTML = "<p>Yükleniyor...</p>";
    const snapshot = await db.collection('yorumlar').where('urunId', '==', productId).orderBy('tarih', 'desc').get();
    list.innerHTML = "";
    if(snapshot.empty) { list.innerHTML = "<p style='color:#888;'>Bu ürün için henüz yorum yapılmamış.</p>"; return; }
    
    snapshot.forEach(doc => {
        const r = doc.data();
        let starsHtml = "";
        for(let i=0; i<5; i++) { if(i < r.puan) starsHtml += '<i class="fas fa-star" style="color:gold;"></i>'; else starsHtml += '<i class="far fa-star" style="color:#ddd;"></i>'; }
        
        list.innerHTML += `
            <div class="review-item">
                <div class="review-header">
                    <strong>${escapeHTML(r.kullaniciAd)}</strong>
                    <span>${starsHtml}</span>
                </div>
                <p>${escapeHTML(r.yorum)}</p>
                <small style="color:#aaa;">${new Date(r.tarih.seconds * 1000).toLocaleDateString('tr-TR')}</small>
            </div>`;
    });
}

function setupStarRating() {
    const stars = document.querySelectorAll('.star-input');
    stars.forEach(star => {
        star.addEventListener('click', function() {
            const val = this.getAttribute('data-value');
            document.getElementById('review-rating').value = val;
            stars.forEach(s => { if(s.getAttribute('data-value') <= val) { s.classList.remove('far'); s.classList.add('fas'); s.style.color = 'gold'; } else { s.classList.remove('fas'); s.classList.add('far'); s.style.color = '#ddd'; } });
        });
    });
}

async function submitReview() {
    const user = auth.currentUser;
    if(!user) { Swal.fire('Giriş Yapmalısınız', 'Yorum yapmak için lütfen giriş yapın.', 'warning'); return; }
    const rating = parseInt(document.getElementById('review-rating').value);
    const text = document.getElementById('review-text').value;
    
    if(rating === 0) { Swal.fire('Puanlayın', 'Lütfen bir yıldız seçin.', 'warning'); return; }
    if(text.trim() === "") { Swal.fire('Yorum Yazın', 'Lütfen yorumunuzu yazın.', 'warning'); return; }
    showLoading();
    
    let hasPurchased = false;
    const ordersSnap = await db.collection('siparisler').where('userId', '==', user.uid).get();
    ordersSnap.forEach(doc => { const order = doc.data(); if(order.urunler) { const found = order.urunler.find(item => item.id === currentProductId); if(found) hasPurchased = true; } });
    
    if(!hasPurchased) { hideLoading(); Swal.fire('Yetkisiz İşlem', 'Sadece bu ürünü satın almış kullanıcılar yorum yapabilir.', 'error'); return; }
    
    try {
        const uDoc = await db.collection('users').doc(user.uid).get();
        const userName = uDoc.exists ? uDoc.data().adSoyad : user.email;
        await db.collection('yorumlar').add({ urunId: currentProductId, userId: user.uid, kullaniciAd: userName, puan: rating, yorum: text, tarih: new Date() });
        
        const allReviews = await db.collection('yorumlar').where('urunId', '==', currentProductId).get();
        let totalScore = 0; let count = 0; allReviews.forEach(r => { totalScore += r.data().puan; count++; });
        await db.collection('urunler').doc(currentProductId).update({ ortalamaPuan: totalScore / count, yorumSayisi: count });
        
        hideLoading(); Swal.fire('Teşekkürler', 'Yorumunuz başarıyla eklendi.', 'success');
        document.getElementById('review-text').value = ""; document.getElementById('review-rating').value = "0";
        document.querySelectorAll('.star-input').forEach(s => { s.classList.remove('fas'); s.classList.add('far'); s.style.color = '#ddd'; });
        openProductDetail(currentProductId); 
    } catch(err) { hideLoading(); console.error(err); Swal.fire('Hata', 'Yorum eklenirken bir sorun oluştu.', 'error'); }
}

// --- DİĞER İŞLEMLER ---
function addNewProduct() {
    const name = document.getElementById('new-p-name').value;
    const cat = document.getElementById('new-p-cat').value;
    const price = Number(document.getElementById('new-p-price').value);
    const stock = Number(document.getElementById('new-p-stock').value);
    const img = document.getElementById('new-p-img').value;
    const desc = document.getElementById('new-p-desc').value;
    db.collection('urunler').add({ ad: name, kategori: cat, fiyat: price, stok: stock, resim: img, aciklama: desc, ortalamaPuan: 0, yorumSayisi: 0 }).then(() => { showToast('success', 'Ürün eklendi!'); document.querySelector('.admin-form').reset(); }).catch(err => Swal.fire('Hata', err.message, 'error'));
}
function updateProduct() {
    const id = document.getElementById('edit-p-id').value;
    const name = document.getElementById('edit-p-name').value;
    const cat = document.getElementById('edit-p-cat').value;
    const price = Number(document.getElementById('edit-p-price').value);
    const stock = Number(document.getElementById('edit-p-stock').value);
    const img = document.getElementById('edit-p-img').value;
    const desc = document.getElementById('edit-p-desc').value;
    db.collection('urunler').doc(id).update({ ad: name, kategori: cat, fiyat: price, stok: stock, resim: img, aciklama: desc }).then(() => { showToast('success', 'Ürün güncellendi!'); closeEditModal(); }).catch(err => Swal.fire('Hata', err.message, 'error'));
}
async function openEditModal(productId) {
    const doc = await db.collection('urunler').doc(productId).get();
    if(!doc.exists) return;
    const p = doc.data();
    document.getElementById('edit-p-id').value = productId; document.getElementById('edit-p-name').value = p.ad;
    if(p.kategori) document.getElementById('edit-p-cat').value = p.kategori; 
    document.getElementById('edit-p-price').value = p.fiyat; document.getElementById('edit-p-stock').value = p.stok; document.getElementById('edit-p-img').value = p.resim; document.getElementById('edit-p-desc').value = p.aciklama;
    document.getElementById('edit-product-modal').style.display = 'flex';
}

// --- HESABIM & PROFİL ---
function handleUserMenu() { 
    if(auth.currentUser) { loadUserProfile(); document.getElementById('profile-modal').style.display='flex'; } 
    else { document.getElementById('auth-modal').style.display='flex'; } 
}

async function loadUserProfile() {
    const user = auth.currentUser;
    if (!user) return;
    document.getElementById('p-name').innerText = "Yükleniyor...";
    
    try {
        const doc = await db.collection('users').doc(user.uid).get();
        if (doc.exists) {
            const data = doc.data();
            document.getElementById('p-name').innerText = data.adSoyad || "İsim Girilmemiş";
            document.getElementById('p-phone').innerText = data.telefon || "Belirtilmemiş";
            document.getElementById('p-address').innerText = data.adres || "Adres Girilmemiş";
            document.getElementById('p-email').innerText = data.email || user.email;
        } else {
            // Admin veya profili olmayan kullanıcı
            document.getElementById('p-name').innerText = user.displayName || "Profil Bilgisi Yok";
            document.getElementById('p-email').innerText = user.email;
            document.getElementById('p-phone').innerText = "-";
            document.getElementById('p-address').innerText = "-";
        }
    } catch (error) {
        console.error("Profil hatası:", error);
        document.getElementById('p-name').innerText = "Veri çekilemedi";
    }
}

// --- STANDARTLAR ---
function adminLogin() { const e = document.getElementById('admin-email').value; const p = document.getElementById('admin-pass').value; if(e !== 'mckonca@gmail.com') { Swal.fire('Hata', 'Yetkisiz giriş!', 'error'); return; } auth.signInWithEmailAndPassword(e, p).catch(err => Swal.fire('Hata', err.message, 'error')); }
function switchAdminTab(tab) { document.querySelectorAll('.admin-section').forEach(sec => sec.style.display = 'none'); document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active')); document.getElementById(`tab-${tab}`).style.display = 'block'; event.currentTarget.classList.add('active'); }
function deleteDoc(col, id) { Swal.fire({ title: 'Emin misiniz?', text: "Bu işlem geri alınamaz!", icon: 'warning', showCancelButton: true, confirmButtonColor: '#d33', cancelButtonColor: '#3085d6', confirmButtonText: 'Evet, Sil' }).then((result) => { if (result.isConfirmed) { db.collection(col).doc(id).delete(); showToast('success', 'Silindi!'); } }); }
function addToCart(docId, productName, price, imageSrc, stockLimit) { const user = auth.currentUser; if (!user) { Swal.fire({ icon: 'info', title: 'Giriş Yapmalısınız', text: 'Sepete eklemek için lütfen giriş yapın.' }).then((result) => { if (result.isConfirmed) document.getElementById('auth-modal').style.display = 'flex'; }); return; } let cart = JSON.parse(localStorage.getItem('myCart')) || []; let item = cart.find(i => i.id === docId); if (item) { if(item.qty < stockLimit) { item.qty += 1; showToast('success', 'Sepet güncellendi'); } else { Swal.fire('Stok Yetersiz', 'Bu üründen stoktaki son adedi eklediniz.', 'warning'); return; } } else { cart.push({ id: docId, name: productName, price: price, image: imageSrc, qty: 1, maxStock: stockLimit }); showToast('success', 'Sepete Eklendi'); } localStorage.setItem('myCart', JSON.stringify(cart)); updateCartCount(); }
function updateCartCount() { let cart = JSON.parse(localStorage.getItem('myCart')) || []; let total = cart.reduce((sum, item) => sum + (item.qty || 1), 0); const badge = document.getElementById('cart-count'); if(badge) badge.innerText = total; }
let appliedCouponCode = ""; let activeDiscount = 0;
async function applyCoupon() { const code = document.getElementById('coupon-input').value.toUpperCase(); if(!code) return; const snap = await db.collection('kuponlar').where('kod', '==', code).get(); if(!snap.empty) { const coupon = snap.docs[0].data(); activeDiscount = coupon.oran; appliedCouponCode = code; Swal.fire('Başarılı', `%${activeDiscount} indirim uygulandı!`, 'success'); loadCartPage(); } else { Swal.fire('Hata', 'Geçersiz kupon kodu!', 'error'); activeDiscount = 0; appliedCouponCode = ""; loadCartPage(); } }
function loadCartPage() { let cart = JSON.parse(localStorage.getItem('myCart')) || []; const wrapper = document.getElementById('cart-items-wrapper'); const totalSpan = document.getElementById('cart-total'); const subTotalSpan = document.getElementById('cart-subtotal'); const discountDisplay = document.getElementById('discount-display'); const discountAmountSpan = document.getElementById('discount-amount'); if (!wrapper) return; wrapper.innerHTML = ""; let subTotal = 0; cart.forEach((item, index) => { subTotal += item.price * item.qty; wrapper.innerHTML += `<tr><td><div class="product-info"><img src="${escapeHTML(item.image)}" class="cart-img"> <span>${escapeHTML(item.name)}</span></div></td><td><button onclick="changeQty(${index},-1)">-</button> ${item.qty} <button onclick="changeQty(${index},1)">+</button></td><td>${item.price * item.qty} TL</td><td><button onclick="removeFromCart(${index})" class="btn-delete">Sil</button></td></tr>`; }); let discountAmount = (subTotal * activeDiscount) / 100; let finalTotal = subTotal - discountAmount; if(subTotalSpan) subTotalSpan.innerText = subTotal; if(totalSpan) totalSpan.innerText = finalTotal; if(activeDiscount > 0) { discountDisplay.style.display = 'block'; discountAmountSpan.innerText = discountAmount; } else { if(discountDisplay) discountDisplay.style.display = 'none'; } }
function changeQty(i, c) { let cart = JSON.parse(localStorage.getItem('myCart')) || []; if(c > 0 && cart[i].qty >= cart[i].maxStock) { Swal.fire('Stok Uyarısı', 'Daha fazla stok yok!', 'warning'); return; } cart[i].qty += c; if(cart[i].qty <= 0) cart.splice(i, 1); localStorage.setItem('myCart', JSON.stringify(cart)); loadCartPage(); updateCartCount(); }
function removeFromCart(i) { let cart = JSON.parse(localStorage.getItem('myCart')) || []; cart.splice(i, 1); localStorage.setItem('myCart', JSON.stringify(cart)); loadCartPage(); updateCartCount(); }
function clearCart() { localStorage.removeItem('myCart'); activeDiscount=0; appliedCouponCode=""; loadCartPage(); updateCartCount(); }
function closeAuthModal() { document.getElementById('auth-modal').style.display='none'; } function closeProfileModal() { document.getElementById('profile-modal').style.display='none'; } function closeModal() { document.getElementById('order-modal').style.display='none'; } function closeEditModal() { document.getElementById('edit-product-modal').style.display = 'none'; }
function logoutUser() { auth.signOut().then(()=>location.reload()); } function switchTab(t) { if(t==='login'){ document.getElementById('form-login').style.display='block'; document.getElementById('form-register').style.display='none'; } else { document.getElementById('form-login').style.display='none'; document.getElementById('form-register').style.display='block'; } } function loginUser() { const e = document.getElementById('login-email').value; const p = document.getElementById('login-pass').value; auth.signInWithEmailAndPassword(e, p).then(()=>{ showToast('success', "Giriş Başarılı!"); closeAuthModal(); }).catch(err=>Swal.fire('Hata', err.message, 'error')); } function registerUser() { const e = document.getElementById('reg-email').value; const p = document.getElementById('reg-pass').value; const n = document.getElementById('reg-name').value; const ph = document.getElementById('reg-phone').value; const ad = document.getElementById('reg-address').value; auth.createUserWithEmailAndPassword(e, p).then((cred)=>{ return db.collection('users').doc(cred.user.uid).set({ adSoyad: n, telefon: ph, adres: ad, email: e }); }).then(()=>{ Swal.fire('Başarılı', "Kayıt Başarılı!", 'success'); closeAuthModal(); }).catch(err=>Swal.fire('Hata', err.message, 'error')); }
function openPaymentModal() { const user = auth.currentUser; if(!user) { document.getElementById('auth-modal').style.display = 'flex'; showToast('warning', "Lütfen önce giriş yapın."); return; } let cart = JSON.parse(localStorage.getItem('myCart')) || []; if(cart.length === 0) { showToast('warning', "Sepetiniz boş!"); return; } const totalAmount = document.getElementById('cart-total').innerText; document.getElementById('payment-total-display').innerText = totalAmount + " TL"; document.getElementById('payment-modal').style.display = 'flex'; } function closePaymentModal() { document.getElementById('payment-modal').style.display = 'none'; } function formatCardNumber(input) { let val = input.value.replace(/\D/g, ''); let f = ''; for(let i=0; i<val.length; i++){ if(i>0 && i%4===0) f+=' '; f+=val[i]; } input.value=f; } function formatExpiry(input) { let val = input.value.replace(/\D/g, ''); if(val.length>=2) input.value=val.substring(0,2)+'/'+val.substring(2,4); else input.value=val; }
async function processPayment() { const btn = document.getElementById('btn-pay-now'); const txt = document.getElementById('pay-text'); const load = document.getElementById('pay-loader'); btn.disabled = true; btn.style.background = '#ccc'; txt.style.display = 'none'; load.style.display = 'inline-block'; setTimeout(async () => { await finalizeOrder('Kredi Kartı (Iyzico)'); btn.disabled = false; btn.style.background = 'var(--accent-color)'; txt.style.display = 'inline-block'; load.style.display = 'none'; closePaymentModal(); }, 2000); }
async function finalizeOrder(paymentMethod) { showLoading(); const user = auth.currentUser; if(!user) { hideLoading(); Swal.fire('Hata', 'Kullanıcı girişi yapılmamış.', 'error'); return; } let cart = JSON.parse(localStorage.getItem('myCart')) || []; const invalidItem = cart.find(item => !item.id); if(invalidItem) { hideLoading(); Swal.fire('Sepet Güncellenmeli', 'Sepetinizdeki veri yapısı eski.', 'warning').then(() => clearCart()); return; } try { const batch = db.batch(); let orderMusteri = user.email; let orderTelefon = "Belirtilmemiş"; let orderAdres = "Adres bilgisi çekilemedi"; let orderEmail = user.email; const uDoc = await db.collection('users').doc(user.uid).get(); if(uDoc.exists) { const uData = uDoc.data(); orderMusteri = uData.adSoyad || user.email; orderTelefon = uData.telefon || "Belirtilmemiş"; orderAdres = uData.adres || "Adres Girilmemiş"; orderEmail = uData.email || user.email; } const newOrderRef = db.collection('siparisler').doc(); const orderData = { musteri: orderMusteri, telefon: orderTelefon, adres: orderAdres, email: orderEmail, userId: user.uid, tarih: new Date().toLocaleString(), urunler: cart, toplamTutar: document.getElementById('cart-total').innerText + " TL", durum: "Yeni Sipariş", odemeYontemi: paymentMethod, kupon: typeof appliedCouponCode !== 'undefined' ? appliedCouponCode : null }; batch.set(newOrderRef, orderData); cart.forEach(item => { const productRef = db.collection('urunler').doc(item.id); batch.update(productRef, { stok: firebase.firestore.FieldValue.increment(-item.qty) }); }); await batch.commit(); hideLoading(); Swal.fire({ title: 'Sipariş Alındı!', text: `Sipariş Numaranız: #${newOrderRef.id.slice(0,6)}`, icon: 'success', confirmButtonText: 'Tamam' }).then(() => { clearCart(); window.location.href = "siparislerim.html"; }); } catch (error) { hideLoading(); console.error("Batch Hatası:", error); Swal.fire('Sipariş Oluşturulamadı', 'Stok hatası veya bağlantı sorunu: ' + error.message, 'error'); } }
function calculateStats() { db.collection('urunler').onSnapshot(snap => { document.getElementById('stat-products').innerText = snap.size; }); db.collection('siparisler').onSnapshot(snap => { let totalOrders = snap.size; let pending = 0; let revenue = 0; snap.forEach(doc => { const data = doc.data(); if(data.durum === 'Yeni Sipariş' || data.durum === 'Hazırlanıyor') { pending++; } let price = parseFloat(data.toplamTutar.replace(' TL', '')); if(!isNaN(price)) revenue += price; }); document.getElementById('stat-orders').innerText = totalOrders; document.getElementById('stat-pending').innerText = pending; document.getElementById('stat-revenue').innerText = revenue.toLocaleString('tr-TR') + " TL"; }); }
function loadAdminOrders() { const tbody = document.getElementById('admin-orders-list'); db.collection('siparisler').orderBy('tarih', 'desc').onSnapshot(snapshot => { tbody.innerHTML = ""; snapshot.forEach(doc => { const order = doc.data(); const tr = document.createElement('tr'); let statusColor = 'black'; if(order.durum === 'Yeni Sipariş') statusColor = 'green'; if(order.durum === 'Kargolandı') statusColor = 'blue'; tr.innerHTML = `<td>${order.tarih}</td><td><strong>${escapeHTML(order.musteri)}</strong></td><td>${order.toplamTutar}</td><td style="color:${statusColor}; font-weight:bold;">${order.durum}<br><small>${order.kargoTakip || ''}</small></td><td><button onclick="viewOrderDetails('${doc.id}')" class="btn-nav" style="padding:5px 10px; font-size:0.8rem; margin-right:5px;" title="Detay"><i class="fas fa-eye"></i></button><button onclick="updateToCargo('${doc.id}')" class="btn-qty" style="margin-right:5px;" title="Kargola"><i class="fas fa-truck"></i></button><button onclick="deleteDoc('siparisler', '${doc.id}')" class="btn-delete" title="Sil"><i class="fas fa-trash"></i></button></td>`; tbody.appendChild(tr); }); }); }
function updateToCargo(orderId) { Swal.fire({ title: 'Kargo Takip No Girin', input: 'text', showCancelButton: true, confirmButtonText: 'Kaydet', cancelButtonText: 'İptal', confirmButtonColor: 'var(--primary-color)' }).then((result) => { if (result.isConfirmed) { let updateData = { durum: "Kargolandı" }; if(result.value) updateData.kargoTakip = result.value; db.collection('siparisler').doc(orderId).update(updateData).then(() => showToast('success', 'Sipariş Kargolandı!')).catch((error) => Swal.fire('Hata', error.message, 'error')); } }); }
async function viewOrderDetails(orderId) { const doc = await db.collection('siparisler').doc(orderId).get(); if (!doc.exists) return; const order = doc.data(); const content = document.getElementById('order-detail-content'); const modal = document.getElementById('order-detail-modal'); let productsHtml = '<ul class="order-detail-list">'; if(order.urunler) { order.urunler.forEach(p => { productsHtml += `<li><div style="display:flex; align-items:center;"><img src="${escapeHTML(p.image)}" onerror="this.src='https://via.placeholder.com/50'"><div><strong>${escapeHTML(p.name)}</strong><br><small>${p.price} TL x ${p.qty}</small></div></div><span>${p.price * p.qty} TL</span></li>`; }); } productsHtml += '</ul>'; let couponInfo = order.kupon ? `<p style="color:green;"><strong>Kupon:</strong> ${order.kupon}</p>` : ''; content.innerHTML = `<div style="margin-bottom:20px; padding-bottom:10px; border-bottom:1px solid #ddd;"><p><strong>Müşteri:</strong> ${escapeHTML(order.musteri)}</p><p><strong>Telefon:</strong> ${escapeHTML(order.telefon)}</p><p><strong>Adres:</strong> ${escapeHTML(order.adres)}</p><p><strong>Kargo:</strong> ${order.kargoTakip || '-'}</p>${couponInfo}</div><h3>Ürünler</h3>${productsHtml}<h3 style="text-align:right; margin-top:10px; color:var(--primary-color);">Toplam: ${order.toplamTutar}</h3>`; modal.style.display = 'flex'; }
function closeOrderModal() { document.getElementById('order-detail-modal').style.display = 'none'; }
function loadAdminProducts() { const grid = document.getElementById('admin-products-list'); db.collection('urunler').onSnapshot(snapshot => { grid.innerHTML = ""; snapshot.forEach(doc => { const p = doc.data(); let stockColor = p.stok > 0 ? 'green' : 'red'; let stockText = p.stok > 0 ? `${p.stok} Adet` : 'TÜKENDİ'; grid.innerHTML += `<div class="product-card" style="position:relative;"><div style="position:absolute; top:10px; right:10px; display:flex; gap:5px;"><button onclick="openEditModal('${doc.id}')" style="background:#f39c12; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer;"><i class="fas fa-pen"></i></button><button onclick="deleteDoc('urunler', '${doc.id}')" style="background:red; color:white; border:none; width:30px; height:30px; border-radius:50%; cursor:pointer;"><i class="fas fa-trash"></i></button></div><img src="${escapeHTML(p.resim)}" style="height:150px; object-fit:cover;"><h4>${escapeHTML(p.ad)}</h4><p>${p.fiyat} TL</p><p style="color:${stockColor}; font-weight:bold;">Stok: ${stockText}</p></div>`; }); }); }
function loadCoupons() { const list = document.getElementById('coupon-list'); db.collection('kuponlar').onSnapshot(snap => { list.innerHTML = ""; snap.forEach(doc => { const k = doc.data(); list.innerHTML += `<div style="background:#fff; padding:10px; margin-bottom:5px; border-radius:5px; display:flex; justify-content:space-between;"><strong>${escapeHTML(k.kod)}</strong> <span>%${k.oran} İndirim</span><button onclick="deleteDoc('kuponlar', '${doc.id}')" style="color:red; border:none; background:none; cursor:pointer;">Sil</button></div>`; }); }); }
function addCoupon() { const code = document.getElementById('coupon-code').value.toUpperCase(); const rate = Number(document.getElementById('coupon-rate').value); db.collection('kuponlar').add({ kod: code, oran: rate }).then(() => showToast('success', 'Kupon eklendi!')); }
async function loadAdminSettings() { const doc = await db.collection('ayarlar').doc('genel').get(); if(doc.exists) { const s = doc.data(); document.getElementById('set-hero-title').value = s.heroTitle || ''; document.getElementById('set-hero-desc').value = s.heroDesc || ''; document.getElementById('set-instagram').value = s.instagram || ''; document.getElementById('set-whatsapp').value = s.whatsapp || ''; } }
function saveSiteSettings() { const s = { heroTitle: document.getElementById('set-hero-title').value, heroDesc: document.getElementById('set-hero-desc').value, instagram: document.getElementById('set-instagram').value, whatsapp: document.getElementById('set-whatsapp').value }; db.collection('ayarlar').doc('genel').set(s).then(() => showToast('success', 'Ayarlar kaydedildi!')).catch(e => Swal.fire('Hata', e.message, 'error')); }
async function loadSiteSettings() { try { const doc = await db.collection('ayarlar').doc('genel').get(); if(doc.exists) { const s = doc.data(); const hTitle = document.getElementById('hero-title-display'); const hDesc = document.getElementById('hero-desc-display'); if(hTitle && s.heroTitle) hTitle.innerHTML = escapeHTML(s.heroTitle); if(hDesc && s.heroDesc) hDesc.innerText = s.heroDesc; const lInsta = document.getElementById('link-instagram'); const lWhats = document.getElementById('link-whatsapp'); if(lInsta && s.instagram) lInsta.href = s.instagram; if(lWhats && s.whatsapp) lWhats.href = `https://wa.me/${s.whatsapp}`; } } catch(e) { console.log("Ayarlar yüklenemedi"); } }
function addBlogPost() { const title = document.getElementById('blog-title').value; const img = document.getElementById('blog-img').value; const content = document.getElementById('blog-content').value; const summary = content.substring(0, 100) + "..."; db.collection('blog').add({ baslik: title, resim: img, icerik: content, ozet: summary, tarih: new Date().toLocaleDateString('tr-TR'), tarihRaw: new Date() }).then(() => { Swal.fire('Başarılı', "Yazı yayınlandı! 📰", 'success'); document.querySelector('#tab-blog form').reset(); }).catch(err => Swal.fire('Hata', err.message, 'error')); }
function loadAdminBlog() { const list = document.getElementById('admin-blog-list'); db.collection('blog').orderBy('tarihRaw', 'desc').onSnapshot(snap => { list.innerHTML = ""; snap.forEach(doc => { const b = doc.data(); list.innerHTML += `<div class="product-card"><img src="${escapeHTML(b.resim)}" style="height:150px; object-fit:cover;"><h4>${escapeHTML(b.baslik)}</h4><p style="font-size:0.8rem; color:#666;">${b.tarih}</p><button onclick="deleteDoc('blog', '${doc.id}')" class="btn-delete" style="margin-top:10px;">Sil</button></div>`; }); }); }
function loadBlogPage() { const container = document.getElementById('blog-container'); if(!container) return; db.collection('blog').orderBy('tarihRaw', 'desc').onSnapshot(snap => { container.innerHTML = ""; if(snap.empty) { container.innerHTML = "<p>Henüz blog yazısı eklenmemiş.</p>"; return; } snap.forEach(doc => { const b = doc.data(); const html = `<div class="blog-card"><div class="blog-img-box"><img src="${escapeHTML(b.resim)}" alt="${escapeHTML(b.baslik)}"></div><div class="blog-content"><span class="blog-date">${b.tarih}</span><h3>${escapeHTML(b.baslik)}</h3><p>${escapeHTML(b.ozet)}</p><button onclick="openBlogModal('${doc.id}')" class="btn-read-more">Devamını Oku &rarr;</button></div></div>`; container.innerHTML += html; }); }); }
async function openBlogModal(docId) { const doc = await db.collection('blog').doc(docId).get(); if(!doc.exists) return; const b = doc.data(); document.getElementById('modal-blog-title').innerText = b.baslik; document.getElementById('modal-blog-img').src = escapeHTML(b.resim); document.getElementById('modal-blog-content').innerHTML = escapeHTML(b.icerik).replace(/\n/g, '<br>'); document.getElementById('blog-modal').style.display = 'flex'; }
function loadUserOrders() { const list = document.getElementById('my-orders-list'); const warning = document.getElementById('login-warning'); if(!list) return; auth.onAuthStateChanged(user => { if (user) { warning.style.display = 'none'; list.style.display = 'block'; db.collection('siparisler').where('userId', '==', user.uid).orderBy('tarih', 'desc').onSnapshot(snapshot => { list.innerHTML = ""; if(snapshot.empty) { list.innerHTML = "<p style='text-align:center;'>Henüz siparişiniz bulunmuyor.</p>"; return; } snapshot.forEach(doc => { const data = doc.data(); let statusClass = 'status-pending'; if(data.durum === 'Kargolandı') statusClass = 'status-shipped'; if(data.durum === 'Teslim Edildi') statusClass = 'status-delivered'; let productsHtml = ""; if(data.urunler) { data.urunler.forEach(p => { productsHtml += `<div class="order-item-row"><img src="${escapeHTML(p.image)}" alt="${escapeHTML(p.name)}"><div><strong>${escapeHTML(p.name)}</strong> <br><small>${p.qty} Adet x ${p.price} TL</small></div></div>`; }); } const card = `<div class="user-order-card"><div class="order-header"><div><strong>Tarih:</strong> ${data.tarih} <br><strong>Sipariş No:</strong> #${doc.id.slice(0,6)}</div><div class="order-status ${statusClass}">${escapeHTML(data.durum)}${data.kargoTakip ? `<br><small>Takip: ${escapeHTML(data.kargoTakip)}</small>` : ''}</div></div><div class="order-body">${productsHtml}</div><div class="order-footer"><span>Toplam Tutar:</span><span class="total-price">${escapeHTML(data.toplamTutar)}</span></div></div>`; list.innerHTML += card; }); }, error => { console.error("Sipariş yükleme hatası:", error); if(error.message.includes("index")) { console.log("Lütfen konsoldaki linke tıklayarak 'siparisler' için Composite Index oluşturun."); } }); } else { list.style.display = 'none'; warning.style.display = 'block'; } }); }
let salesChartInstance = null; let productsChartInstance = null; function initDashboardCharts() { if(salesChartInstance) salesChartInstance.destroy(); if(productsChartInstance) productsChartInstance.destroy(); db.collection('siparisler').get().then(snapshot => { const orders = []; snapshot.forEach(doc => orders.push(doc.data())); let productCounts = {}; let last7Days = {}; const today = new Date(); for(let i=6; i>=0; i--) { let d = new Date(); d.setDate(today.getDate() - i); let dateStr = d.toLocaleDateString('tr-TR'); last7Days[dateStr] = 0; } orders.forEach(order => { if(order.urunler) { order.urunler.forEach(item => { if(productCounts[item.name]) productCounts[item.name] += item.qty; else productCounts[item.name] = item.qty; }); } let orderDate = order.tarih.split(' ')[0]; let price = parseFloat(order.toplamTutar.replace(' TL', '')); Object.keys(last7Days).forEach(dayKey => { if(orderDate.includes(dayKey) || dayKey.includes(orderDate)) last7Days[dayKey] += price; }); }); const ctxSales = document.getElementById('salesChart').getContext('2d'); salesChartInstance = new Chart(ctxSales, { type: 'line', data: { labels: Object.keys(last7Days), datasets: [{ label: 'Günlük Ciro (TL)', data: Object.values(last7Days), borderColor: '#7c3aed', backgroundColor: 'rgba(124, 58, 237, 0.1)', fill: true, tension: 0.4 }] }, options: { responsive: true } }); const ctxProducts = document.getElementById('productsChart').getContext('2d'); productsChartInstance = new Chart(ctxProducts, { type: 'doughnut', data: { labels: Object.keys(productCounts), datasets: [{ data: Object.values(productCounts), backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'] }] }, options: { responsive: true } }); }); }
window.onclick = function(e) { if(e.target.className.includes('modal-overlay')) e.target.style.display='none'; }