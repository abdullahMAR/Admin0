// Configuration
const API_URL = 'https://my-doctor-api-wf84.onrender.com/api';
let authToken = localStorage.getItem('authToken');
let currentAdmin = JSON.parse(localStorage.getItem('currentAdmin') || '{}');
let map, marker;
let geocoder;
let autocompleteService;
let doctors = [];
let specialties = [];
let clinics = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        showDashboard();
        loadAllData();
    } else {
        showLogin();
    }
    
    // Event listeners
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('doctorForm').addEventListener('submit', handleAddDoctor);
    document.getElementById('clinicForm').addEventListener('submit', handleAddClinic);
    document.getElementById('specialtyForm').addEventListener('submit', handleAddSpecialty);
    
    // Initialize Google Places and Geocoder
    if (window.google && window.google.maps) {
        geocoder = new google.maps.Geocoder();
        autocompleteService = new google.maps.places.AutocompleteService();
        
        // Add search input listener
        const searchInput = document.getElementById('clinicSearchAddress');
        if (searchInput) {
            searchInput.addEventListener('input', handleAddressSearch);
            document.addEventListener('click', (e) => {
                if (e.target.id !== 'clinicSearchAddress') {
                    document.getElementById('searchSuggestions').style.display = 'none';
                }
            });
        }
    }
});

// Show/Hide Pages
function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('dashboard').classList.remove('active');
}

function showDashboard() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    if (currentAdmin.username) {
        document.getElementById('adminUsername').textContent = currentAdmin.username;
    }
}

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            authToken = data.access_token;
            currentAdmin = data.admin;
            localStorage.setItem('authToken', authToken);
            localStorage.setItem('currentAdmin', JSON.stringify(currentAdmin));
            
            showAlert('loginAlert', 'تم تسجيل الدخول بنجاح!', 'success');
            setTimeout(() => {
                showDashboard();
                loadAllData();
            }, 1000);
        } else {
            showAlert('loginAlert', data.detail || 'فشل تسجيل الدخول', 'error');
        }
    } catch (error) {
        showAlert('loginAlert', 'خطأ في الاتصال بالخادم. تأكد من تشغيل Backend', 'error');
    }
}

function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentAdmin');
    authToken = null;
    currentAdmin = {};
    showLogin();
}

// Tab Switching
function switchTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(`${tabName}Tab`).classList.add('active');
    
    if (tabName === 'clinics' && !map) {
        initMap();
    }
}

// Load All Data
async function loadAllData() {
    await loadSpecialties();
    await loadDoctors();
    await loadClinics();
    updateStats();
}

// Specialties
async function loadSpecialties() {
    try {
        const response = await fetch(`${API_URL}/specialties`);
        specialties = await response.json();
        
        renderSpecialtiesTable();
        updateSpecialtyDropdowns();
    } catch (error) {
        console.error('Error loading specialties:', error);
    }
}

function renderSpecialtiesTable() {
    const tbody = document.getElementById('specialtiesTableBody');
    
    if (specialties.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center;">لا توجد تخصصات</td></tr>';
        return;
    }
    
    tbody.innerHTML = specialties.map((specialty, index) => {
        const doctorCount = doctors.filter(d => d.specialty_id === specialty.id).length;
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${specialty.name}</td>
                <td>${doctorCount}</td>
            </tr>
        `;
    }).join('');
}

function updateSpecialtyDropdowns() {
    const select = document.getElementById('doctorSpecialty');
    select.innerHTML = '<option value="">اختر التخصص</option>' +
        specialties.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

async function handleAddSpecialty(e) {
    e.preventDefault();
    
    const name = document.getElementById('specialtyName').value;
    
    try {
        const response = await fetch(`${API_URL}/specialties`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ name })
        });
        
        if (response.ok) {
            showAlert('specialtyAlert', 'تم إضافة التخصص بنجاح!', 'success');
            document.getElementById('specialtyForm').reset();
            await loadSpecialties();
            updateStats();
        } else {
            const data = await response.json();
            showAlert('specialtyAlert', data.detail || 'فشل إضافة التخصص', 'error');
        }
    } catch (error) {
        showAlert('specialtyAlert', 'خطأ في الاتصال بالخادم', 'error');
    }
}

// Doctors
async function loadDoctors() {
    try {
        const response = await fetch(`${API_URL}/doctors`);
        doctors = await response.json();
        
        renderDoctorsTable();
        updateDoctorDropdown();
    } catch (error) {
        console.error('Error loading doctors:', error);
    }
}

function renderDoctorsTable() {
    const tbody = document.getElementById('doctorsTableBody');
    
    if (doctors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">لا يوجد أطباء</td></tr>';
        return;
    }
    
    tbody.innerHTML = doctors.map(doctor => `
        <tr>
            <td>${doctor.name}</td>
            <td>${doctor.specialty.name}</td>
            <td>${doctor.phone || '-'}</td>
            <td>${doctor.email || '-'}</td>
            <td class="actions">
                <button class="btn btn-danger btn-sm" onclick="deleteDoctor(${doctor.id})">
                    حذف
                </button>
            </td>
        </tr>
    `).join('');
}

function updateDoctorDropdown() {
    const select = document.getElementById('clinicDoctor');
    select.innerHTML = '<option value="">اختر طبيب</option>' +
        doctors.map(d => `<option value="${d.id}">${d.name} - ${d.specialty.name}</option>`).join('');
}

async function handleAddDoctor(e) {
    e.preventDefault();
    
    const doctorData = {
        name: document.getElementById('doctorName').value,
        specialty_id: parseInt(document.getElementById('doctorSpecialty').value),
        phone: document.getElementById('doctorPhone').value || null,
        email: document.getElementById('doctorEmail').value || null,
        bio: document.getElementById('doctorBio').value || null
    };
    
    try {
        const response = await fetch(`${API_URL}/doctors`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(doctorData)
        });
        
        if (response.ok) {
            showAlert('doctorAlert', 'تم إضافة الطبيب بنجاح!', 'success');
            document.getElementById('doctorForm').reset();
            await loadDoctors();
            updateStats();
        } else {
            const data = await response.json();
            showAlert('doctorAlert', data.detail || 'فشل إضافة الطبيب', 'error');
        }
    } catch (error) {
        showAlert('doctorAlert', 'خطأ في الاتصال بالخادم', 'error');
    }
}

async function deleteDoctor(id) {
    if (!confirm('هل أنت متأكد من حذف هذا الطبيب؟ سيتم حذف جميع عياداته أيضاً.')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/doctors/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            await loadDoctors();
            await loadClinics();
            updateStats();
        } else {
            alert('فشل حذف الطبيب');
        }
    } catch (error) {
        alert('خطأ في الاتصال بالخادم');
    }
}

// Clinics
async function loadClinics() {
    try {
        const response = await fetch(`${API_URL}/clinics`);
        clinics = await response.json();
        
        renderClinicsTable();
    } catch (error) {
        console.error('Error loading clinics:', error);
    }
}

function renderClinicsTable() {
    const tbody = document.getElementById('clinicsTableBody');
    
    if (clinics.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">لا توجد عيادات</td></tr>';
        return;
    }
    
    tbody.innerHTML = clinics.map(clinic => `
        <tr>
            <td>${clinic.name}</td>
            <td>${clinic.doctor.name}</td>
            <td>${clinic.address}</td>
            <td>${clinic.phone || '-'}</td>
            <td>${clinic.working_hours || '-'}</td>
            <td class="actions">
                <button class="btn btn-danger btn-sm" onclick="deleteClinic(${clinic.id})">
                    حذف
                </button>
            </td>
        </tr>
    `).join('');
}

async function handleAddClinic(e) {
    e.preventDefault();
    
    const clinicData = {
        doctor_id: parseInt(document.getElementById('clinicDoctor').value),
        name: document.getElementById('clinicName').value,
        address: document.getElementById('clinicAddress').value,
        latitude: parseFloat(document.getElementById('clinicLat').value),
        longitude: parseFloat(document.getElementById('clinicLng').value),
        phone: document.getElementById('clinicPhone').value || null,
        working_hours: document.getElementById('clinicHours').value || null
    };
    
    try {
        const response = await fetch(`${API_URL}/clinics`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(clinicData)
        });
        
        if (response.ok) {
            showAlert('clinicAlert', 'تم إضافة العيادة بنجاح!', 'success');
            document.getElementById('clinicForm').reset();
            await loadClinics();
            updateStats();
            
            marker.setPosition({ lat: 34.7236, lng: 36.7639 });
            map.setCenter({ lat: 34.7236, lng: 36.7639 });
        } else {
            const data = await response.json();
            showAlert('clinicAlert', data.detail || 'فشل إضافة العيادة', 'error');
        }
    } catch (error) {
        showAlert('clinicAlert', 'خطأ في الاتصال بالخادم', 'error');
    }
}

async function deleteClinic(id) {
    if (!confirm('هل أنت متأكد من حذف هذه العيادة؟')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/clinics/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            await loadClinics();
            updateStats();
        } else {
            alert('فشل حذف العيادة');
        }
    } catch (error) {
        alert('خطأ في الاتصال بالخادم');
    }
}

// Address Search with Google Places
async function handleAddressSearch(e) {
    const query = e.target.value.trim();
    const suggestionsDiv = document.getElementById('searchSuggestions');
    
    if (query.length < 2) {
        suggestionsDiv.style.display = 'none';
        return;
    }
    
    try {
        // إضافة حمص في البحث تلقائياً
        const searchQuery = query.includes('حمص') ? query : query + ', حمص, سوريا';
        
        const predictions = await autocompleteService.getPlacePredictions({
            input: searchQuery,
            componentRestrictions: { country: 'sy' },
        });
        
        if (predictions.predictions.length === 0) {
            suggestionsDiv.innerHTML = '<div style="padding: 10px; color: #9ca3af;">لا توجد نتائج</div>';
            suggestionsDiv.style.display = 'block';
            return;
        }
        
        suggestionsDiv.innerHTML = predictions.predictions
            .map((prediction) => {
                const mainText = prediction.description || 'موقع';
                return `
                    <div style="
                        padding: 10px 15px;
                        border-bottom: 1px solid #e5e7eb;
                        cursor: pointer;
                        transition: background 0.2s;
                        text-align: right;
                    " 
                    onmouseover="this.style.background='#f3f4f6'" 
                    onmouseout="this.style.background='white'"
                    onclick="selectAddressFromSearch('${prediction.description.replace(/'/g, "\\'")}')">
                        <strong>${mainText}</strong>
                    </div>
                `;
            })
            .join('');
        
        suggestionsDiv.style.display = 'block';
    } catch (error) {
        console.error('Search error:', error);
    }
}

async function selectAddressFromSearch(address) {
    const searchInput = document.getElementById('clinicSearchAddress');
    const addressInput = document.getElementById('clinicAddress');
    const suggestionsDiv = document.getElementById('searchSuggestions');
    
    searchInput.value = address;
    addressInput.value = address;
    suggestionsDiv.style.display = 'none';
    
    try {
        await geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK' && results && results.length > 0) {
                const location = results[0].geometry.location;
                const lat = location.lat();
                const lng = location.lng();
                
                document.getElementById('clinicLat').value = lat.toFixed(6);
                document.getElementById('clinicLng').value = lng.toFixed(6);
                
                if (map && marker) {
                    const position = { lat, lng };
                    marker.setPosition(position);
                    map.setCenter(position);
                    map.setZoom(16);
                }
                
                showSearchAlert('تم تحديد الموقع بنجاح! ✓', 'success');
            } else {
                showSearchAlert('لم يتم العثور على الموقع. حاول بعنوان أكثر دقة', 'error');
            }
        });
    } catch (error) {
        console.error('Geocoding error:', error);
        showSearchAlert('خطأ في تحديد الموقع', 'error');
    }
}

function showSearchAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        color: white;
        border-radius: 8px;
        z-index: 2000;
        animation: slideIn 0.3s ease;
    `;
    alertDiv.textContent = message;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => alertDiv.remove(), 3000);
}

// Google Maps
function initMap() {
    const defaultCenter = { lat: 34.7236, lng: 36.7639 }; // حمص
    
    map = new google.maps.Map(document.getElementById('map'), {
        center: defaultCenter,
        zoom: 12
    });
    
    marker = new google.maps.Marker({
        position: defaultCenter,
        map: map,
        draggable: true
    });
    
    marker.addListener('dragend', () => {
        const position = marker.getPosition();
        document.getElementById('clinicLat').value = position.lat();
        document.getElementById('clinicLng').value = position.lng();
    });
    
    map.addListener('click', (e) => {
        marker.setPosition(e.latLng);
        document.getElementById('clinicLat').value = e.latLng.lat();
        document.getElementById('clinicLng').value = e.latLng.lng();
    });
}

// Statistics
function updateStats() {
    document.getElementById('totalDoctors').textContent = doctors.length;
    document.getElementById('totalClinics').textContent = clinics.length;
    document.getElementById('totalSpecialties').textContent = specialties.length;
}

// Alerts
function showAlert(elementId, message, type) {
    const alertDiv = document.getElementById(elementId);
    alertDiv.innerHTML = `
        <div class="alert alert-${type}">
            ${message}
        </div>
    `;
    
    setTimeout(() => {
        alertDiv.innerHTML = '';
    }, 5000);
}
