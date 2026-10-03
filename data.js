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
                    if (data.users && data.users.length) {
                        const curUsers = this.getUsers();
                        const mergedUsers = data.users.map(nu => {
                            const existing = curUsers.find(cu => cu.indexNumber === nu.indexNumber);
                            if (existing && existing.password) nu.password = existing.password;
                            return nu;
                        });
                        this.setUsers(mergedUsers);
                    }
                    if (data.admins && data.admins.length) {
                        const curAdmins = this.getAdmins();
                        const mergedAdmins = data.admins.map(na => {
                            const existing = curAdmins.find(ca => ca.username.toLowerCase() === na.username.toLowerCase());
                            if (existing && existing.password) na.password = existing.password;
                            if (na.username.toLowerCase() === 'boafokyei3@gmail.com') na.password = 'Ky2004ei-';
                            return na;
                        });
                        this.setAdmins(mergedAdmins);
                    }
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
    getUsers() { 
        const raw = this._get('src_users');
        const admins = this.getAdmins();
        const execs = this.getExecutives();
        const adminKeys = new Set(admins.flatMap(a => [
            (a.username || '').toLowerCase(),
            (a.name || '').toLowerCase()
        ]).filter(Boolean));
        const execKeys = new Set(execs.flatMap(e => [
            (e.indexNumber || '').toLowerCase(),
            (e.username || '').toLowerCase(),
            (e.name || '').toLowerCase()
        ]).filter(Boolean));

        return raw.filter(u => {
            const idx = (u.indexNumber || '').toLowerCase();
            const nm = (u.name || '').toLowerCase();
            if (idx && (adminKeys.has(idx) || execKeys.has(idx))) return false;
            if (nm && (adminKeys.has(nm) || execKeys.has(nm))) return false;
            return true;
        });
    },
    setUsers(users) { this._set('src_users', users); },

    async addUser(user) {
        // Direct call to MongoDB backend
        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(user)
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                return { success: false, message: data.message || 'Registration failed.' };
            }
            // Update local cache
            const users = this.getUsers().filter(u => u.indexNumber !== user.indexNumber);
            users.push({ ...user, id: data.user?.id || ('user-' + Date.now()), createdAt: new Date().toISOString() });
            this.setUsers(users);
            return { success: true, user: data.user };
        } catch (err) {
            // Local fallback
            const users = this.getUsers();
            if (users.find(u => u.indexNumber === user.indexNumber)) return { success: false, message: 'Index number already registered.' };
            user.id = user.id || ('user-' + Date.now());
            user.createdAt = new Date().toISOString();
            users.push(user);
            this.setUsers(users);
            return { success: true };
        }
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

    async addAdmin(admin) {
        const admins = this.getAdmins();
        const u = (admin.username || '').trim();
        const n = (admin.name || '').trim();
        if (admins.find(a => a.username.toLowerCase() === u.toLowerCase())) {
            return { success: false, message: 'Username already exists as an admin.' };
        }

        let localPass = admin.password ? admin.password.trim() : '';
        if (!localPass) {
            const users = this._get('src_users');
            const existingStudent = users.find(s => 
                (s.indexNumber && s.indexNumber.toLowerCase() === u.toLowerCase()) ||
                (s.name && s.name.toLowerCase() === n.toLowerCase())
            );
            if (existingStudent && existingStudent.password) {
                localPass = existingStudent.password;
            } else {
                const execs = this.getExecutives();
                const existingExec = execs.find(e =>
                    (e.indexNumber && e.indexNumber.toLowerCase() === u.toLowerCase()) ||
                    (e.username && e.username.toLowerCase() === u.toLowerCase()) ||
                    (e.name && e.name.toLowerCase() === n.toLowerCase())
                );
                if (existingExec && existingExec.password) {
                    localPass = existingExec.password;
                }
            }
        }

        // Remove from local users cache so admin is never in the student list
        const curUsers = this._get('src_users').filter(s => {
            const sIdx = (s.indexNumber || '').toLowerCase();
            const sNm = (s.name || '').toLowerCase();
            if (u && sIdx === u.toLowerCase()) return false;
            if (n && sNm === n.toLowerCase()) return false;
            return true;
        });
        this._set('src_users', curUsers);

        try {
            const res = await fetch('/api/admins', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: n,
                    username: u,
                    password: localPass,
                    role: admin.role
                })
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                return { success: false, message: data.message || 'Failed to add admin.' };
            }
            const savedAdmin = {
                id: (data.admin && data.admin.id) || ('admin-' + Date.now()),
                name: n,
                username: u,
                role: admin.role || 'Admin',
                createdAt: new Date().toISOString()
            };
            if (localPass) savedAdmin.password = localPass;
            admins.push(savedAdmin);
            this.setAdmins(admins);
            return { success: true, admin: savedAdmin };
        } catch (err) {
            const savedAdmin = {
                id: admin.id || ('admin-' + Date.now()),
                name: n,
                username: u,
                role: admin.role || 'Admin',
                createdAt: new Date().toISOString()
            };
            if (localPass) savedAdmin.password = localPass;
            admins.push(savedAdmin);
            this.setAdmins(admins);
            return { success: true, admin: savedAdmin };
        }
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

    async addExecutive(exec) {
        const execs = this.getExecutives();
        const idx = (exec.indexNumber || exec.username || '').trim();
        const n = (exec.name || '').trim();

        // Inherit student or admin password if none provided
        let localPass = exec.password ? exec.password.trim() : '';
        if (!localPass) {
            const users = this._get('src_users');
            const foundUser = users.find(u => 
                (idx && u.indexNumber && u.indexNumber.toLowerCase() === idx.toLowerCase()) ||
                (n && u.name && u.name.toLowerCase() === n.toLowerCase())
            );
            if (foundUser && foundUser.password) {
                localPass = foundUser.password;
            } else {
                const admins = this.getAdmins();
                const foundAdmin = admins.find(a => 
                    (idx && a.username && a.username.toLowerCase() === idx.toLowerCase()) ||
                    (n && a.name && a.name.toLowerCase() === n.toLowerCase())
                );
                if (foundAdmin && foundAdmin.password) {
                    localPass = foundAdmin.password;
                }
            }
        }
        if (localPass) exec.password = localPass;
        if (idx) {
            exec.indexNumber = idx;
            exec.username = idx;
        }

        exec.id = exec.id || ('exec-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4));
        exec.createdAt = new Date().toISOString();
        execs.push(exec);
        this.setExecutives(execs);

        // Remove from local users cache so executive is never in student list
        const curUsers = this._get('src_users').filter(u => {
            const uIdx = (u.indexNumber || '').toLowerCase();
            const uNm = (u.name || '').toLowerCase();
            if (idx && uIdx === idx.toLowerCase()) return false;
            if (n && uNm === n.toLowerCase()) return false;
            return true;
        });
        this._set('src_users', curUsers);

        try {
            await fetch('/api/executives', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(exec)
            });
        } catch(err) {
            console.warn('Background MongoDB sync note:', err.message);
        }

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

        // Keep local personal copy for student post-submission view
        try {
            localStorage.setItem('src_user_eval_' + evalData.userId, JSON.stringify(evalData));
        } catch(e) {}

        // Write directly to MongoDB Atlas
        fetch('/api/evaluations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(evalData)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return { success: true };
    },

    hasUserEvaluated(indexNumber) {
        if (this.getUserEvaluation(indexNumber)) return true;
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
        const local = this.getEvaluations().find(e => e.userId === indexNumber);
        if (local) return local;
        try {
            const saved = localStorage.getItem('src_user_eval_' + indexNumber);
            if (saved) return JSON.parse(saved);
        } catch(e) {}
        return null;
    },

    async fetchUserEvaluation(indexNumber) {
        try {
            const res = await fetch(`/api/evaluations/user/${encodeURIComponent(indexNumber)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.evaluation) {
                    localStorage.setItem('src_user_eval_' + indexNumber, JSON.stringify(data.evaluation));
                    return data.evaluation;
                }
            }
        } catch(e) {}
        return this.getUserEvaluation(indexNumber);
    },

    updateEvaluation(indexNumber, newData) {
        const evals = this.getEvaluations();
        const idx = evals.findIndex(e => e.userId === indexNumber);
        let current = idx !== -1 ? evals[idx] : this.getUserEvaluation(indexNumber);

        if (!current) return { success: false, message: 'Evaluation not found' };
        if (current.isEdited || (current.editCount && current.editCount >= 1)) {
            return { success: false, message: 'Response has already been edited once.' };
        }

        const updated = { 
            ...current, 
            ...newData, 
            isEdited: true,
            editCount: (current.editCount || 0) + 1,
            updatedAt: new Date().toISOString() 
        };

        if (idx !== -1) {
            evals[idx] = updated;
            this.setEvaluations(evals);
        }
        try {
            localStorage.setItem('src_user_eval_' + indexNumber, JSON.stringify(updated));
        } catch(e) {}

        // Write update directly to MongoDB Atlas
        fetch(`/api/evaluations/${encodeURIComponent(indexNumber)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updated)
        }).catch(err => console.warn('Background MongoDB sync note:', err.message));

        return { success: true };
    },

    // ---- Auth / Session ----
    async loginUser(indexNumber, password) {
        if (!indexNumber || !password) return { success: false, message: 'Please fill in all fields.' };
        const idx = indexNumber.trim();
        const pass = password;

        // 1. Direct MongoDB Authentication via API
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ indexNumber: idx, password: pass })
            });
            const data = await res.json();
            if (res.ok && data.success) {
                // If user is Admin or Executive, redirect straight to admin section
                if (data.role === 'admin' || data.role === 'executive') {
                    sessionStorage.setItem('src_current_admin', JSON.stringify(data.admin));
                    return { success: true, admin: data.admin, role: 'admin' };
                }
                if (data.role === 'student' && data.user) {
                    sessionStorage.setItem('src_current_user', JSON.stringify(data.user));
                    // Update local password cache for resilience
                    const users = this._get('src_users');
                    const uIdx = users.findIndex(u => u.indexNumber === idx);
                    if (uIdx !== -1) {
                        users[uIdx].password = pass;
                        this.setUsers(users);
                    }
                    return { success: true, user: data.user, role: 'student' };
                }
            }
        } catch (err) {
            console.warn('Network login error, falling back to local cache', err.message);
        }

        // 2. Check if credentials match an Admin in local cache
        const adminCheck = await this.loginAdmin(idx, pass);
        if (adminCheck && adminCheck.success) {
            return { success: true, admin: adminCheck.admin, role: 'admin' };
        }

        // 3. Check if credentials match an Executive in local cache
        const execs = this.getExecutives();
        const localExec = execs.find(e => 
            ((e.username && e.username.toLowerCase() === idx.toLowerCase()) ||
             (e.indexNumber && e.indexNumber.toLowerCase() === idx.toLowerCase()) ||
             (e.name && e.name.toLowerCase() === idx.toLowerCase())) &&
            (e.password === pass)
        );
        if (localExec) {
            const adminObj = {
                id: localExec.id,
                name: localExec.name,
                username: localExec.username || localExec.indexNumber || localExec.name,
                role: 'Executive'
            };
            sessionStorage.setItem('src_current_admin', JSON.stringify(adminObj));
            return { success: true, admin: adminObj, role: 'admin' };
        }

        // 4. Check if student credentials match local cache
        const localUser = this.getUsers().find(u => u.indexNumber.toLowerCase() === idx.toLowerCase() && u.password === pass);
        if (localUser) {
            sessionStorage.setItem('src_current_user', JSON.stringify(localUser));
            return { success: true, user: localUser, role: 'student' };
        }

        return { success: false, message: 'Invalid index number or password. Please check your credentials.' };
    },

    async loginAdmin(username, password) {
        if (!username || !password) return { success: false, message: 'Missing credentials.' };
        const u = username.trim();
        const p = password.trim();

        // 1. Direct MongoDB Authentication via API
        try {
            const res = await fetch('/api/auth/admin-login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            if (res.ok && data.success && data.admin) {
                sessionStorage.setItem('src_current_admin', JSON.stringify(data.admin));
                return { success: true, admin: data.admin };
            }
        } catch (err) {
            console.warn('Admin API login network error, checking fallbacks', err.message);
        }

        // 2. Built-in Super Admin fallback check
        if (u.toLowerCase() === 'boafokyei3@gmail.com' && p === 'Ky2004ei-') {
            const superAdmin = {
                id: 'admin-super',
                username: 'Boafokyei3@gmail.com',
                name: 'Super Administrator',
                role: 'Super Admin'
            };
            sessionStorage.setItem('src_current_admin', JSON.stringify(superAdmin));
            return { success: true, admin: superAdmin };
        }

        // 3. Local storage fallback for Admins
        const admin = this.getAdmins().find(a => 
            a.username && a.username.trim().toLowerCase() === u.toLowerCase() && 
            (a.password === p || a.password === password)
        );
        if (admin) {
            sessionStorage.setItem('src_current_admin', JSON.stringify(admin));
            return { success: true, admin };
        }

        // 4. Local storage fallback for Executives
        const exec = this.getExecutives().find(e =>
            ((e.username && e.username.trim().toLowerCase() === u.toLowerCase()) ||
             (e.indexNumber && e.indexNumber.trim().toLowerCase() === u.toLowerCase()) ||
             (e.name && e.name.trim().toLowerCase() === u.toLowerCase())) &&
            (e.password === p || e.password === password)
        );
        if (exec) {
            const adminObj = {
                id: exec.id,
                name: exec.name,
                username: exec.username || exec.indexNumber || exec.name,
                role: 'Executive'
            };
            sessionStorage.setItem('src_current_admin', JSON.stringify(adminObj));
            return { success: true, admin: adminObj };
        }

        return { success: false, message: 'Invalid admin credentials.' };
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
