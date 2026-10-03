/* =========================================================
   SRC Evaluation — Data Layer (MongoDB Cloud & Cache Sync)
   ========================================================= */

const DataStore = {

    // ---- Initialization & Cloud Sync ----
    init() {
        const superAdmin = {
            id: 'admin-super',
            username: 'Boafokyei3@gmail.com',
            password: 'Ky2004ei-',
            name: 'Super Administrator',
            role: 'Super Admin',
            createdAt: new Date().toISOString()
        };

        let admins = this.getAdmins();
        admins = admins.filter(a => a.username.toLowerCase() !== 'admin');

        const superIdx = admins.findIndex(a => a.username.toLowerCase() === 'boafokyei3@gmail.com');
        if (superIdx !== -1) {
            admins[superIdx].username = 'Boafokyei3@gmail.com';
            admins[superIdx].password = 'Ky2004ei-';
            admins[superIdx].role = 'Super Admin';
            admins[superIdx].name = admins[superIdx].name || 'Super Administrator';
        } else {
            admins.unshift(superAdmin);
        }
        this.setAdmins(admins);

        if (!localStorage.getItem('src_initialized')) {
            this.setUsers([]);
            this.setExecutives([]);
            this.setEvaluations([]);
            localStorage.setItem('src_initialized', 'true');
        }

        // Clean out mock executives
        let execs = this.getExecutives();
        const fakeNames = ['Kwame Mensah', 'Abena Osei', 'Emmanuel Asante', 'Grace Addo', 'Samuel Boateng', 'Priscilla Mensah'];
        const cleanExecs = execs.filter(e => !fakeNames.includes(e.name));
        if (cleanExecs.length !== execs.length) {
            this.setExecutives(cleanExecs);
        }

        // Trigger asynchronous background sync with MongoDB Atlas
        this.syncWithCloud();
    },

    async syncWithCloud() {
        try {
            const admin = this.getCurrentAdmin();
            const adminUser = admin ? admin.username : '';
            const res = await fetch(`/api/sync?adminUser=${encodeURIComponent(adminUser)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    if (data.users && data.users.length) this.setUsers(data.users);
                    if (data.admins && data.admins.length) this.setAdmins(data.admins);
                    if (data.executives && data.executives.length) this.setExecutives(data.executives);
                    if (data.evaluations) this.setEvaluations(data.evaluations);
                    if (typeof data.isEvaluationOpen === 'boolean') this.setEvaluationOpen(data.isEvaluationOpen);
                    console.log('☁️ Synced with MongoDB Atlas Cloud Database');
                }
            }
        } catch (e) {
            console.log('Running in local/offline fallback mode.');
        }
    },

    // ---- Generic Storage ----
    _get(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (e) {
            return [];
        }
    },
    _set(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },

    // ---- Users (Students) ----
    getUsers() { return this._get('src_users'); },
    setUsers(users) { this._set('src_users', users); },

    addUser(user) {
        const users = this.getUsers();
        if (users.find(u => u.indexNumber === user.indexNumber)) return { success: false, message: 'Index number already registered.' };
        user.id = user.id || ('user-' + Date.now());
        user.createdAt = new Date().toISOString();
        users.push(user);
        this.setUsers(users);

        // Sync with MongoDB backend
        fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(user)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return { success: true };
    },

    updateUser(indexNumber, data) {
        const users = this.getUsers();
        const idx = users.findIndex(u => u.indexNumber === indexNumber);
        if (idx === -1) return false;
        users[idx] = { ...users[idx], ...data };
        this.setUsers(users);

        // Sync with MongoDB backend
        fetch(`/api/students/${encodeURIComponent(indexNumber)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return true;
    },

    removeUser(indexNumber) {
        const users = this.getUsers().filter(u => u.indexNumber !== indexNumber);
        this.setUsers(users);

        fetch(`/api/students/${encodeURIComponent(indexNumber)}`, {
            method: 'DELETE'
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));
    },

    // ---- Admins ----
    getAdmins() { return this._get('src_admins'); },
    setAdmins(admins) { this._set('src_admins', admins); },

    addAdmin(admin) {
        const admins = this.getAdmins();
        if (admins.find(a => a.username.toLowerCase() === admin.username.toLowerCase())) {
            return { success: false, message: 'Username already exists.' };
        }
        admin.id = admin.id || ('admin-' + Date.now());
        admin.createdAt = new Date().toISOString();
        admins.push(admin);
        this.setAdmins(admins);

        // Sync with MongoDB backend
        fetch('/api/admins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(admin)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return { success: true };
    },

    updateAdmin(username, data) {
        const admins = this.getAdmins();
        const idx = admins.findIndex(a => a.username.toLowerCase() === username.toLowerCase());
        if (idx === -1) return false;
        admins[idx] = { ...admins[idx], ...data };
        this.setAdmins(admins);

        // Sync with MongoDB backend
        fetch(`/api/admins/${encodeURIComponent(username)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return true;
    },

    removeAdmin(username) {
        const admins = this.getAdmins().filter(a => a.username.toLowerCase() !== username.toLowerCase());
        this.setAdmins(admins);

        fetch(`/api/admins/${encodeURIComponent(username)}`, {
            method: 'DELETE'
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));
    },

    // ---- Executives ----
    getExecutives() { return this._get('src_executives'); },
    setExecutives(execs) { this._set('src_executives', execs); },

    addExecutive(exec) {
        const execs = this.getExecutives();
        exec.id = exec.id || ('exec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4));
        exec.createdAt = new Date().toISOString();
        execs.push(exec);
        this.setExecutives(execs);

        fetch('/api/executives', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(exec)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return { success: true, id: exec.id };
    },

    updateExecutive(id, data) {
        const execs = this.getExecutives();
        const idx = execs.findIndex(e => e.id === id);
        if (idx === -1) return false;
        execs[idx] = { ...execs[idx], ...data };
        this.setExecutives(execs);

        fetch(`/api/executives/${encodeURIComponent(id)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return true;
    },

    removeExecutive(id) {
        const execs = this.getExecutives().filter(e => e.id !== id);
        this.setExecutives(execs);

        fetch(`/api/executives/${encodeURIComponent(id)}`, {
            method: 'DELETE'
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));
    },

    // ---- Evaluations ----
    getEvaluations() { return this._get('src_evaluations'); },
    setEvaluations(evals) { this._set('src_evaluations', evals); },

    addEvaluation(evalData) {
        const evals = this.getEvaluations();
        evalData.id = evalData.id || ('eval-' + Date.now());
        evalData.submittedAt = new Date().toISOString();
        evalData.editCount = 0;
        evalData.isEdited = false;
        evals.push(evalData);
        this.setEvaluations(evals);

        // Write directly to MongoDB Atlas
        fetch('/api/evaluations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evalData)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return { success: true };
    },

    hasUserEvaluated(indexNumber) {
        return this.getEvaluations().some(e => e.userId === indexNumber);
    },

    canUserEdit(indexNumber) {
        const ev = this.getUserEvaluation(indexNumber);
        if (!ev) return false;
        return !ev.isEdited && (!ev.editCount || ev.editCount < 1);
    },

    resetEvaluations() {
        this.setEvaluations([]);
        fetch('/api/evaluations', { method: 'DELETE' })
            .catch(err => console.warn('Background MongoDB sync note:', err.message));
    },

    getEvaluationStats() {
        const evals = this.getEvaluations();
        if (evals.length === 0) return { count: 0, avgRating: 0, issueCount: 0, editedCount: 0 };
        const avgRating = Math.round(evals.reduce((s, e) => s + parseInt(e.overallRating), 0) / evals.length);
        const issueCount = evals.filter(e => e.issue && e.issue.title).length;
        const editedCount = evals.filter(e => e.isEdited || (e.editCount && e.editCount > 0)).length;
        return { count: evals.length, avgRating, issueCount, editedCount };
    },

    // ---- Evaluation Toggle ----
    isEvaluationOpen() {
        const val = localStorage.getItem('src_eval_open');
        return val === null ? true : val === 'true';
    },

    setEvaluationOpen(open) {
        localStorage.setItem('src_eval_open', open ? 'true' : 'false');
        fetch('/api/settings/toggle-evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ open: !!open })
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));
    },

    // ---- Get/Update Individual Evaluation ----
    getUserEvaluation(indexNumber) {
        return this.getEvaluations().find(e => e.userId === indexNumber) || null;
    },

    updateEvaluation(indexNumber, newData) {
        const evals = this.getEvaluations();
        const idx = evals.findIndex(e => e.userId === indexNumber);
        if (idx === -1) return { success: false, message: 'Evaluation not found' };
        if (evals[idx].isEdited || (evals[idx].editCount && evals[idx].editCount >= 1)) {
            return { success: false, message: 'Response has already been edited once.' };
        }
        evals[idx] = { 
            ...evals[idx], 
            ...newData, 
            isEdited: true,
            editCount: (evals[idx].editCount || 0) + 1,
            updatedAt: new Date().toISOString() 
        };
        this.setEvaluations(evals);

        // Write update directly to MongoDB Atlas
        fetch(`/api/evaluations/${encodeURIComponent(indexNumber)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evals[idx])
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return { success: true };
    },

    // ---- Auth / Session ----
    loginUser(indexNumber, password) {
        const user = this.getUsers().find(u => u.indexNumber === indexNumber && u.password === password);
        if (user) {
            sessionStorage.setItem('src_current_user', JSON.stringify(user));
            return user;
        }
        return null;
    },

    loginAdmin(username, password) {
        if (!username || !password) return null;
        const u = username.trim().toLowerCase();
        const p = password.trim();
        const admin = this.getAdmins().find(a => 
            a.username.trim().toLowerCase() === u && 
            (a.password === password || a.password.trim() === p)
        );
        if (admin) {
            sessionStorage.setItem('src_current_admin', JSON.stringify(admin));
            return admin;
        }
        return null;
    },

    getCurrentUser() {
        const data = sessionStorage.getItem('src_current_user');
        return data ? JSON.parse(data) : null;
    },

    getCurrentAdmin() {
        const data = sessionStorage.getItem('src_current_admin');
        return data ? JSON.parse(data) : null;
    },

    logoutUser() { sessionStorage.removeItem('src_current_user'); },
    logoutAdmin() { sessionStorage.removeItem('src_current_admin'); },

    // ---- Super Admin helpers ----
    isSuperAdmin(adminOrUsername) {
        const u = typeof adminOrUsername === 'string' ? adminOrUsername : (adminOrUsername?.username || '');
        return u.toLowerCase() === 'boafokyei3@gmail.com';
    },

    // Reset any student's password (Super Admin only)
    resetUserPassword(indexNumber, newPassword) {
        return this.updateUser(indexNumber, { password: newPassword });
    },

    // Reset any admin's password (Super Admin only)
    resetAdminPassword(username, newPassword) {
        return this.updateAdmin(username, { password: newPassword });
    },

    // Get evaluation with identity masking for non-super-admins
    getEvaluationsForAdmin(viewerAdmin) {
        const isSuper = this.isSuperAdmin(viewerAdmin);
        return this.getEvaluations().map(e => {
            if (e.isAnonymous && !isSuper) {
                return { ...e, userName: 'Anonymous Student', userId: '***' };
            }
            return e;
        });
    }
};

// Auto-initialize
DataStore.init();
