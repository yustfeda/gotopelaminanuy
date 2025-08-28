// Konfigurasi Firebase Anda (Ganti dengan data Anda sendiri)
// Anda perlu membuat proyek di Firebase Console (console.firebase.google.com)
// dan mengaktifkan Realtime Database.
// Pastikan juga untuk mengamankan aturan database Anda.
const firebaseConfig = {
    apiKey: "AIzaSyCtJKPPPMKLd-yHjAxTD7EsaL-W0vL7jhs", // Kunci API Firebase Anda
    authDomain: "tabungan-c896c.firebaseapp.com", // Domain Autentikasi Firebase Anda
    projectId: "tabungan-c896c", // ID Proyek Firebase Anda
    databaseURL: "https://tabungan-c896c-default-rtdb.firebaseio.com", // URL Realtime Database Anda (misal: https://your-project-id-default-rtdb.firebaseio.com)
    storageBucket: "tabungan-c896c.firebasestorage.app", // Opsional: Bucket penyimpanan Firebase
    messagingSenderId: "345492652207", // Opsional: ID Pengirim Pesan Firebase
    appId: "1:345492652207:web:244cf219bc5cb43714145a" // Opsional: ID Aplikasi Firebase Anda
};

// Inisialisasi Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Dua referensi database terpisah untuk bagian anggaran dan transaksi historis
const dbRefParts = database.ref('weddingBudgetParts');
const dbRefTransactions = database.ref('weddingTransactions');

// --- Elemen DOM ---
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

// Form untuk menambah/mengedit Bagian Anggaran (di halaman Patungan Pelaminan)
const partForm = document.getElementById('partForm');
const partIdInput = document.getElementById('partId');
const partNameInput = document.getElementById('partName');
const partTargetAmountInput = document.getElementById('partTargetAmount');
const savePartBtn = document.getElementById('savePartBtn');
const cancelPartEditBtn = document.getElementById('cancelPartEditBtn');

// Kontainer untuk kartu-kartu bagian anggaran
const partsCardsContainer = document.getElementById('partsCardsContainer');


// Form Kontribusi Baru (di bawah ringkasan bagian anggaran)
const contributionForm = document.getElementById('contributionForm');
const selectPartInput = document.getElementById('selectPart');
const contributionAmountInput = document.getElementById('contributionAmount');
const contributionTypeInput = document.getElementById('contributionType');
const saverNameInput = document.getElementById('saverName'); // Elemen baru untuk penyetor
const saveContributionBtn = document.getElementById('saveContributionBtn');


// Tabel untuk menampilkan Rekap Transaksi (di halaman Rekap Dana)
const recapTableBody = document.getElementById('recapTableBody');

// Elemen loading dan empty state
const chartLoading = document.getElementById('chartLoading');
const chartEmptyState = document.getElementById('chartEmptyState');
const partsCardsLoading = document.getElementById('partsCardsLoading'); // Diubah dari partsTableLoading
const partsCardsEmptyState = document.getElementById('partsCardsEmptyState'); // Diubah dari partsTableEmptyState
const recapTableLoading = document.getElementById('recapTableLoading');
const recapTableEmptyState = document.getElementById('recapTableEmptyState');

// Elemen untuk ringkasan individu di Beranda
const myBoyContributionSpan = document.getElementById('myBoyContribution');
const myGirlContributionSpan = document.getElementById('myGirlContribution');
const overallContributionSpan = document.getElementById('overallContribution');


// --- Modal Konfirmasi ---
const confirmationModal = document.getElementById('confirmationModal');
const modalMessage = document.getElementById('modalMessage');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const closeModalBtn = document.querySelector('.close-button');

let currentAction = null; // Menyimpan aksi yang akan dilakukan (edit-part/delete-part/delete-transaction)
let currentKey = null; // Menyimpan kunci data yang akan diedit/dihapus

// Fungsi untuk menampilkan modal konfirmasi
function showConfirmationModal(message, action, key = null) {
    console.log(`[Modal] Menampilkan modal untuk aksi: ${action}, key: ${key}`);
    modalMessage.textContent = message;
    currentAction = action;
    currentKey = key;
    confirmationModal.style.display = 'flex'; // Menggunakan flex untuk pemusatan
}

// Fungsi untuk menyembunyikan modal konfirmasi
function hideConfirmationModal() {
    console.log("[Modal] Menyembunyikan modal konfirmasi.");
    confirmationModal.style.display = 'none';
    currentAction = null;
    currentKey = null;
}

// Event listener untuk tombol di modal
modalConfirmBtn.addEventListener('click', () => {
    console.log(`[Modal] Modal dikonfirmasi. Aksi: ${currentAction}, Key: ${currentKey}`);
    if (currentAction === 'delete-part') {
        dbRefParts.child(currentKey).remove()
            .then(() => {
                alert('Bagian anggaran berhasil dihapus!');
                console.log(`[Firebase] Bagian anggaran dengan ID ${currentKey} berhasil dihapus.`);
                // Hapus juga transaksi terkait jika ada
                dbRefTransactions.orderByChild('partId').equalTo(currentKey).once('value', snapshot => {
                    snapshot.forEach(childSnapshot => {
                        dbRefTransactions.child(childSnapshot.key).remove();
                    });
                });
            })
            .catch(error => {
                console.error("[Firebase] Error deleting part: ", error);
                alert('Gagal menghapus bagian anggaran.');
            })
            .finally(() => {
                hideConfirmationModal();
            });
    } else if (currentAction === 'delete-transaction') {
        dbRefTransactions.child(currentKey).once('value', transactionSnapshot => {
            const transaction = transactionSnapshot.val();
            if (transaction) {
                const partId = transaction.partId;
                const amount = transaction.amount;
                const type = transaction.type;

                // Pertama, hapus transaksi historis
                dbRefTransactions.child(currentKey).remove()
                    .then(() => {
                        // Kedua, update danaTerkumpul di bagian anggaran terkait
                        return dbRefParts.child(partId).once('value');
                    })
                    .then(partSnapshot => {
                        const part = partSnapshot.val();
                        if (part) {
                            let newDanaTerkumpul = part.danaTerkumpul || 0;
                            if (type === 'masuk') {
                                newDanaTerkumpul -= amount; // Balikkan efek pemasukan
                            } else { // type === 'keluar'
                                newDanaTerkumpul += amount; // Balikkan efek pengeluaran
                            }
                            return dbRefParts.child(partId).update({ danaTerkumpul: newDanaTerkumpul });
                        }
                    })
                    .then(() => {
                        alert('Transaksi dan dana terkumpul berhasil diperbarui!');
                        console.log(`[Firebase] Transaksi dengan ID ${currentKey} dihapus dan danaTerkumpul diperbarui.`);
                    })
                    .catch(error => {
                        console.error("[Firebase] Error deleting transaction or updating part: ", error);
                        alert('Gagal menghapus transaksi atau memperbarui dana terkumpul.');
                    })
                    .finally(() => {
                        hideConfirmationModal();
                    });
            } else {
                alert('Transaksi tidak ditemukan.');
                hideConfirmationModal();
            }
        });
    } else {
        hideConfirmationModal();
    }
});


modalCancelBtn.addEventListener('click', () => {
    console.log("[Modal] Modal dibatalkan.");
    hideConfirmationModal();
});
closeModalBtn.addEventListener('click', () => {
    console.log("[Modal] Tombol close modal diklik.");
    hideConfirmationModal();
});
window.addEventListener('click', (event) => {
    if (event.target === confirmationModal) {
        console.log("[Modal] Klik di luar modal.");
        hideConfirmationModal();
    }
});


// --- Fungsi Navigasi Halaman ---
function showPage(pageId) {
    console.log(`[Navigasi] Menampilkan halaman: ${pageId}`);
    // Sembunyikan semua halaman
    pages.forEach(page => page.classList.remove('active'));
    // Tampilkan halaman yang diminta
    document.getElementById(pageId).classList.add('active');

    // Atur kelas 'active' pada item navigasi
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === pageId) {
            item.classList.add('active');
        }
    });
}

// Event listener untuk navigasi
navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        console.log(`[Navigasi] Item navigasi diklik: ${e.target.dataset.page}`);
        e.preventDefault(); // Mencegah perilaku default link
        const pageId = e.target.dataset.page;
        showPage(pageId);
    });
});

// Inisialisasi halaman saat dokumen dimuat
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded. Menginisialisasi aplikasi.");
    showPage('beranda'); // Tampilkan halaman beranda secara default
    // Tampilkan loading saat pertama kali memuat data
    chartLoading.style.display = 'block';
    partsCardsLoading.style.display = 'block';
    recapTableLoading.style.display = 'block';
    // Panggil updateIndividualSummary saat pertama kali dimuat
    updateIndividualSummary();
});

// --- Logika Halaman Patungan Pelaminan (Form & Kartu Bagian Anggaran) ---

// Fungsi untuk mereset form Bagian Anggaran ke mode tambah
function resetPartForm() {
    console.log("[Form Bagian] Meriset form.");
    partIdInput.value = '';
    partNameInput.value = '';
    partTargetAmountInput.value = '';
    savePartBtn.textContent = 'Tambah Bagian Anggaran';
    savePartBtn.classList.remove('secondary-btn'); // Pastikan kembali ke primary
    savePartBtn.classList.add('primary-btn');
    cancelPartEditBtn.style.display = 'none';
}

// Event listener untuk submit form Bagian Anggaran
partForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Mencegah reload halaman
    console.log("[Form Bagian] Form submit terdeteksi.");

    const id = partIdInput.value;
    const name = partNameInput.value.trim();
    const targetAmount = parseInt(partTargetAmountInput.value);

    // Validasi input
    if (!name) {
        alert("Nama Bagian Anggaran tidak boleh kosong.");
        return;
    }
    if (isNaN(targetAmount) || targetAmount < 0) {
        alert("Target Dana harus berupa angka positif.");
        return;
    }

    if (id) {
        // Mode edit: update bagian anggaran yang sudah ada
        try {
            console.log(`[Firebase] Memperbarui bagian anggaran dengan ID: ${id}`);
            await dbRefParts.child(id).update({
                name,
                targetDana: targetAmount, // Perbarui targetDana
                // danaTerkumpul tidak diupdate di sini, hanya melalui transaksi
            });
            alert('Bagian anggaran berhasil diperbarui!');
            console.log(`[Firebase] Bagian anggaran ID ${id} berhasil diperbarui.`);
        } catch (error) {
            console.error("[Firebase] Error updating part:", error);
            alert('Gagal memperbarui bagian anggaran.');
        } finally {
            resetPartForm(); // Reset form setelah operasi
        }
    } else {
        // Mode tambah: push bagian anggaran baru
        try {
            console.log("[Firebase] Menambahkan bagian anggaran baru.");
            await dbRefParts.push({
                name,
                targetDana: targetAmount,
                danaTerkumpul: 0, // Inisialisasi danaTerkumpul menjadi 0 untuk bagian baru
                createdAt: new Date().toISOString()
            });
            alert('Bagian anggaran berhasil ditambahkan!');
            console.log("[Firebase] Bagian anggaran baru berhasil ditambahkan.");
        } catch (error) {
            console.error("[Firebase] Error adding part:", error);
            alert('Gagal menambahkan bagian anggaran.');
        } finally {
            resetPartForm(); // Reset form setelah operasi
        }
    }
});

// Event listener untuk tombol Batal Edit Bagian Anggaran
cancelPartEditBtn.addEventListener('click', (e) => {
    console.log("[Form Bagian] Tombol Batal Edit diklik.");
    resetPartForm();
});

// Mendengarkan perubahan data dari Firebase Realtime Database untuk Bagian Anggaran
dbRefParts.on('value', (snapshot) => {
    console.log("[Firebase] Perubahan data bagian anggaran terdeteksi.");
    const partsData = snapshot.val();
    const parts = [];
    if (partsData) {
        for (const key in partsData) {
            parts.push({ id: key, ...partsData[key] });
        }
    }

    // Sortir bagian anggaran berdasarkan nama
    parts.sort((a, b) => a.name.localeCompare(b.name));

    partsCardsContainer.innerHTML = ''; // Kosongkan kontainer kartu sebelum mengisi ulang
    selectPartInput.innerHTML = '<option value="">-- Pilih Bagian --</option>'; // Reset opsi dropdown
    if (parts.length === 0) {
        partsCardsEmptyState.style.display = 'block';
        partsCardsLoading.style.display = 'none';
        // Nonaktifkan form kontribusi jika tidak ada bagian anggaran
        selectPartInput.disabled = true;
        contributionAmountInput.disabled = true;
        contributionTypeInput.disabled = true;
        saverNameInput.disabled = true; // Nonaktifkan juga input penyetor
        saveContributionBtn.disabled = true;
    } else {
        partsCardsEmptyState.style.display = 'none';
        // Aktifkan form kontribusi
        selectPartInput.disabled = false;
        contributionAmountInput.disabled = false;
        contributionTypeInput.disabled = false;
        saverNameInput.disabled = false; // Aktifkan input penyetor
        saveContributionBtn.disabled = false;

        parts.forEach(part => {
            // Render kartu bagian anggaran
            const progress = part.targetDana > 0 ? (part.danaTerkumpul / part.targetDana * 100) : 0;
            const progressDisplay = Math.min(100, Math.max(0, progress)).toFixed(1); // Pastikan antara 0-100%
            
            const partCard = document.createElement('div');
            partCard.classList.add('part-card');
            partCard.dataset.id = part.id; // Tambahkan data-id ke kartu untuk identifikasi

            partCard.innerHTML = `
                <h4>${part.name}</h4>
                <p><strong>Target:</strong> <span>${part.targetDana.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span></p>
                <p><strong>Terkumpul:</strong> <span>${part.danaTerkumpul.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</span></p>
                <div class="progress-bar-container">
                    <div class="progress-bar-fill" style="width: ${progressDisplay}%"></div>
                    <span class="progress-text">${progressDisplay}%</span>
                </div>
                <div class="part-card-actions">
                    <button class="action-btn edit-part-btn" data-id="${part.id}">Edit</button>
                    <button class="action-btn delete-part-btn" data-id="${part.id}">Hapus</button>
                </div>
            `;
            partsCardsContainer.appendChild(partCard);

            // Isi dropdown di form kontribusi
            const option = document.createElement('option');
            option.value = part.id;
            option.textContent = part.name;
            selectPartInput.appendChild(option);
        });
    }
    partsCardsLoading.style.display = 'none'; // Sembunyikan loading setelah kartu diisi

    // Perbarui grafik di Beranda
    updateChart(parts);
});

// Event listener untuk tombol Edit dan Hapus Bagian Anggaran di Kartu
partsCardsContainer.addEventListener('click', (e) => {
    const target = e.target;
    const partId = target.dataset.id;
    console.log(`[Kartu Bagian] Tombol di kartu diklik. ID: ${partId}, Tipe: ${target.classList}`);

    if (target.classList.contains('edit-part-btn')) {
        dbRefParts.child(partId).once('value', (snapshot) => {
            const part = snapshot.val();
            if (part) {
                console.log(`[Form Bagian] Mengisi form untuk edit bagian ID: ${partId}`);
                partIdInput.value = partId;
                partNameInput.value = part.name;
                partTargetAmountInput.value = part.targetDana;
                savePartBtn.textContent = 'Perbarui Bagian Anggaran';
                savePartBtn.classList.remove('primary-btn');
                savePartBtn.classList.add('secondary-btn');
                cancelPartEditBtn.style.display = 'inline-block';
                partForm.scrollIntoView({ behavior: 'smooth' });
            } else {
                console.error(`[Firebase] Bagian anggaran dengan ID ${partId} tidak ditemukan.`);
                alert("Bagian anggaran tidak ditemukan untuk diedit.");
            }
        });
    } else if (target.classList.contains('delete-part-btn')) {
        showConfirmationModal('Apakah Anda yakin ingin menghapus bagian anggaran ini? Semua transaksi terkait juga akan dihapus.', 'delete-part', partId);
    }
});


// Event listener untuk submit form Kontribusi Baru
contributionForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Mencegah reload halaman
    console.log("[Form Kontribusi] Form submit terdeteksi.");

    const partId = selectPartInput.value;
    const amount = parseInt(contributionAmountInput.value);
    const type = contributionTypeInput.value;
    const saver = saverNameInput.value; // Ambil nilai penyetor
    const timestamp = new Date().toISOString();

    // Validasi input
    if (!partId) {
        alert("Harap pilih Bagian Anggaran.");
        return;
    }
    if (isNaN(amount) || amount <= 0) {
        alert("Jumlah dana harus berupa angka positif.");
        return;
    }
    if (!saver) { // Validasi penyetor
        alert("Harap pilih Penyetor.");
        return;
    }

    try {
        // 1. Tambahkan transaksi ke weddingTransactions
        await dbRefTransactions.push({
            partId,
            type,
            amount,
            saver, // Simpan informasi penyetor
            timestamp
        });
        console.log(`[Firebase] Transaksi baru ditambahkan untuk part ID ${partId} oleh ${saver}.`);

        // 2. Perbarui danaTerkumpul di weddingBudgetParts
        const partSnapshot = await dbRefParts.child(partId).once('value');
        const part = partSnapshot.val();

        if (part) {
            let newDanaTerkumpul = part.danaTerkumpul || 0;
            if (type === 'masuk') {
                newDanaTerkumpul += amount;
            } else { // type === 'keluar'
                newDanaTerkumpul -= amount;
            }
            await dbRefParts.child(partId).update({ danaTerkumpul: newDanaTerkumpul });
            alert('Dana berhasil disimpan!');
            console.log(`[Firebase] Dana terkumpul untuk part ID ${partId} diperbarui menjadi ${newDanaTerkumpul}.`);
        } else {
            console.error(`[Firebase] Bagian anggaran dengan ID ${partId} tidak ditemukan.`);
            alert('Gagal menemukan bagian anggaran terkait untuk memperbarui dana.');
        }
    } catch (error) {
        console.error("[Firebase] Error saving contribution or updating part:", error);
        alert('Gagal menyimpan dana atau memperbarui bagian anggaran.');
    } finally {
        contributionForm.reset(); // Reset form setelah disimpan
        selectPartInput.value = ''; // Pastikan dropdown kembali ke default
        saverNameInput.value = ''; // Reset pilihan penyetor
        // Panggil updateIndividualSummary lagi setelah transaksi berhasil
        updateIndividualSummary();
    }
});


// --- Logika Halaman Rekap Dana ---

// Mendengarkan perubahan data dari Firebase Realtime Database untuk Transaksi
dbRefTransactions.on('value', async (snapshot) => {
    console.log("[Firebase] Perubahan data transaksi terdeteksi (on 'value' event).");
    const transactionsData = snapshot.val();
    const transactions = [];
    if (transactionsData) {
        for (const key in transactionsData) {
            transactions.push({ id: key, ...transactionsData[key] });
        }
    }

    // Ambil data bagian anggaran untuk mendapatkan nama bagian
    const partsSnapshot = await dbRefParts.once('value');
    const partsMap = {};
    if (partsSnapshot.val()) {
        for (const key in partsSnapshot.val()) {
            partsMap[key] = partsSnapshot.val()[key];
        }
    }

    // Sortir transaksi berdasarkan timestamp terbaru terlebih dahulu
    transactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    recapTableBody.innerHTML = ''; // Kosongkan tabel sebelum mengisi ulang
    if (transactions.length === 0) {
        recapTableEmptyState.style.display = 'block';
        recapTableLoading.style.display = 'none';
    } else {
        recapTableEmptyState.style.display = 'none';
        transactions.forEach(transaction => {
            const row = document.createElement('tr');
            const date = new Date(transaction.timestamp).toLocaleString('id-ID', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const partName = partsMap[transaction.partId] ? partsMap[transaction.partId].name : `Bagian ID: ${transaction.partId} (Dihapus)`;
            const saverDisplay = transaction.saver === 'my_boy' ? 'My Boy' : (transaction.saver === 'my_girl' ? 'My Girl' : 'Tidak Diketahui');

            row.innerHTML = `
                <td data-label="Tanggal" class="col-rekap-tanggal">${date}</td>
                <td data-label="Bagian Anggaran" class="col-rekap-bagian">${partName}</td>
                <td data-label="Jenis" class="col-rekap-jenis">${transaction.type === 'masuk' ? 'Pemasukan' : 'Pengeluaran'}</td>
                <td data-label="Jumlah" class="col-rekap-jumlah">${transaction.amount.toLocaleString('id-ID')}</td>
                <td data-label="Penyetor" class="col-rekap-penyetor">${saverDisplay}</td>
                <td data-label="Aksi" class="col-rekap-aksi">
                     <button class="action-btn delete-transaction-btn" data-id="${transaction.id}">Hapus</button>
                </td>
            `;
            recapTableBody.appendChild(row);
        });
    }
    recapTableLoading.style.display = 'none'; // Sembunyikan loading setelah tabel diisi

    // Setelah tabel rekap diupdate, panggil juga updateIndividualSummary untuk memastikan data terbaru
    updateIndividualSummary();
});

// Event listener untuk tombol Hapus Transaksi di tabel Rekap
recapTableBody.addEventListener('click', (e) => {
    const target = e.target;
    const transactionId = target.dataset.id;
    console.log(`[Tabel Rekap] Tombol Hapus Transaksi diklik. ID: ${transactionId}`);

    if (target.classList.contains('delete-transaction-btn')) {
        showConfirmationModal('Apakah Anda yakin ingin menghapus transaksi ini? Dana terkumpul di bagian anggaran terkait juga akan disesuaikan.', 'delete-transaction', transactionId);
    }
});


// --- Logika Halaman Beranda (Grafik dan Ringkasan Individu dengan Chart.js) ---

let myChart; // Variabel global untuk instance chart

function updateChart(parts) { // Menerima data bagian anggaran, bukan transaksi
    console.log("[Chart] Memperbarui grafik.");
    if (parts.length === 0) {
        chartEmptyState.style.display = 'block';
        chartLoading.style.display = 'none';
        if (myChart) {
            myChart.destroy(); // Hancurkan chart jika tidak ada data
            myChart = null;
        }
        return;
    } else {
        chartEmptyState.style.display = 'none';
    }

    const labels = []; // Nama Bagian Anggaran
    const dataCurrentSaved = []; // Dana yang sudah terkumpul
    const dataTargetDana = []; // Target Dana

    // Warna acak atau tetap untuk setiap bagian
    let colorIndex = 0;
    const predefinedColors = [
        'rgba(255, 99, 132, 0.7)', // Merah muda untuk tema pernikahan
        'rgba(54, 162, 235, 0.7)', // Biru
        'rgba(255, 205, 86, 0.7)', // Kuning
        'rgba(75, 192, 192, 0.7)', // Tosca
        'rgba(153, 102, 255, 0.7)', // Ungu
        'rgba(201, 203, 207, 0.7)', // Abu-abu
        'rgba(255, 159, 64, 0.7)'  // Oranye
    ];
    // const colorMap = {}; // Tidak diperlukan lagi jika warna dataset global

    parts.forEach(part => {
        labels.push(part.name);
        dataCurrentSaved.push(part.danaTerkumpul || 0);
        dataTargetDana.push(part.targetDana || 0);

        // if (!colorMap[part.name]) {
        //     colorMap[part.name] = predefinedColors[colorIndex % predefinedColors.length];
        //     colorIndex++;
        // }
    });

    const ctx = document.getElementById('targetChart').getContext('2d');

    if (myChart) {
        myChart.destroy(); // Hancurkan chart lama sebelum membuat yang baru
    }

    myChart = new Chart(ctx, {
        type: 'bar', // Menggunakan bar chart untuk perbandingan target
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Dana Terkumpul',
                    data: dataCurrentSaved,
                    backgroundColor: labels.map((_, i) => predefinedColors[i % predefinedColors.length]), // Warna per bagian
                    borderColor: labels.map((_, i) => predefinedColors[i % predefinedColors.length].replace('0.7', '1')),
                    borderWidth: 1
                },
                {
                    label: 'Target Dana',
                    data: dataTargetDana,
                    backgroundColor: 'rgba(233, 30, 99, 0.2)', // Warna berbeda untuk target (lebih ke pink)
                    borderColor: 'rgba(233, 30, 99, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Penting untuk kontrol tinggi chart di CSS
            scales: {
                x: {
                    stacked: false, // Tidak ditumpuk agar bisa membandingkan target vs terkumpul
                    grid: {
                        display: false // Sembunyikan grid x
                    }
                },
                y: {
                    beginAtZero: true,
                    stacked: false,
                    title: {
                        display: true,
                        text: 'Jumlah Dana (IDR)',
                        font: {
                            size: 10 // Font kecil untuk judul sumbu
                        }
                    },
                    ticks: {
                        font: {
                            size: 9 // Font kecil untuk label sumbu y
                        },
                         callback: function(value, index, values) {
                            return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value); // Format angka tanpa desimal
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 10 // Font kecil untuk legend
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(context.parsed.y);
                            }
                            return label;
                        },
                        title: function(context) {
                            return `Bagian: ${context[0].label}`;
                        }
                    },
                    bodyFont: {
                        size: 10 // Font kecil untuk tooltip
                    },
                    titleFont: {
                        size: 11 // Font kecil untuk judul tooltip
                    }
                }
            }
        }
    });
    chartLoading.style.display = 'none'; // Sembunyikan loading setelah chart dibuat
}

// Fungsi untuk memperbarui ringkasan kontribusi individu
async function updateIndividualSummary() {
    console.log("[Summary] Memperbarui ringkasan kontribusi individu.");
    try {
        const snapshot = await dbRefTransactions.once('value');
        const transactionsData = snapshot.val();
        let myBoyTotal = 0;
        let myGirlTotal = 0;
        let overallTotal = 0;

        if (transactionsData) {
            for (const key in transactionsData) {
                const transaction = transactionsData[key];
                if (transaction.type === 'masuk') {
                    if (transaction.saver === 'my_boy') {
                        myBoyTotal += transaction.amount;
                    } else if (transaction.saver === 'my_girl') {
                        myGirlTotal += transaction.amount;
                    }
                } else { // type === 'keluar'
                    // Pengeluaran mengurangi total keseluruhan, tapi tidak mengurangi kontribusi individu
                    // Jika ingin pengeluaran individu mengurangi total individu, logika perlu disesuaikan
                }
            }
        }
        overallTotal = myBoyTotal + myGirlTotal; // Total keseluruhan dari pemasukan individu

        myBoyContributionSpan.textContent = myBoyTotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
        myGirlContributionSpan.textContent = myGirlTotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
        overallContributionSpan.textContent = overallTotal.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' });
        console.log(`[Summary] My Boy: ${myBoyTotal}, My Girl: ${myGirlTotal}, Overall: ${overallTotal}`);

    } catch (error) {
        console.error("[Summary] Error updating individual summary:", error);
    }
}
