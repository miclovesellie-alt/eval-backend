require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;
const MONGODB_URI = process.env.MONGODB_URI;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ───────────────────────────────────────────
// MONGOOSE SCHEMAS & MODELS
// ───────────────────────────────────────────

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    indexNumber: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

const AdminSchema = new mongoose.Schema({
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, default: 'Admin' },
    createdAt: { type: Date, default: Date.now }
});

const ExecutiveSchema = new mongoose.Schema({
    name: { type: String, required: true },
    portfolio: { type: String, required: true },
    username: { type: String },
    indexNumber: { type: String },
    password: { type: String },
    createdAt: { type: Date, default: Date.now }
});

const EvaluationSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    isAnonymous: { type: Boolean, default: false },
    overallRating: { type: String, default: '50' },
    starRatings: { type: Object, default: {} },
    executiveRatings: { type: Object, default: {} },
    concerns: { type: String, default: '' },
    commendations: { type: String, default: '' },
    recommendations: { type: String, default: '' },
    selectedTags: { type: Array, default: [] },
    issue: { type: Object, default: {} },
    isEdited: { type: Boolean, default: false },
    editCount: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date }
});

const SettingSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    value: { type: mongoose.Schema.Types.Mixed, default: true }
});

const User = mongoose.model('User', UserSchema);
const Admin = mongoose.model('Admin', AdminSchema);
const Executive = mongoose.model('Executive', ExecutiveSchema);
const Evaluation = mongoose.model('Evaluation', EvaluationSchema);
const Setting = mongoose.model('Setting', SettingSchema);

// ───────────────────────────────────────────
// DATABASE SEEDING
// ───────────────────────────────────────────

async function seedSuperAdmin() {
    try {
        const superEmail = 'boafokyei3@gmail.com';
        let superAdmin = await Admin.findOne({ username: { $regex: new RegExp(`^${superEmail}$`, 'i') } });
        if (!superAdmin) {
            superAdmin = new Admin({
                name: 'Super Administrator',
                username: 'Boafokyei3@gmail.com',
                password: 'Ky2004ei-',
                role: 'Super Admin'
            });
            await superAdmin.save();
            console.log('✅ Super Admin created in MongoDB: Boafokyei3@gmail.com');
        } else {
            superAdmin.password = 'Ky2004ei-';
            superAdmin.role = 'Super Admin';
            await superAdmin.save();
            console.log('✅ Super Admin verified in MongoDB.');
        }

        // Initialize evaluation switch setting
        let evalOpenSetting = await Setting.findOne({ key: 'eval_open' });
        if (!evalOpenSetting) {
            evalOpenSetting = new Setting({ key: 'eval_open', value: true });
            await evalOpenSetting.save();
        }
    } catch (err) {
        console.error('Error seeding Super Admin:', err.message);
    }
}

// ───────────────────────────────────────────
// API ROUTES
// ───────────────────────────────────────────

// 1. Initial State Sync (for fast frontend cache hydration)
app.get('/api/sync', async (req, res) => {
    try {
        const viewerAdmin = req.query.adminUser || '';
        const isSuper = viewerAdmin.toLowerCase() === 'boafokyei3@gmail.com';

        const [rawUsers, admins, executives, rawEvals, evalSetting] = await Promise.all([
            User.find({}).sort({ createdAt: -1 }),
            Admin.find({}).sort({ createdAt: -1 }),
            Executive.find({}).sort({ createdAt: -1 }),
            Evaluation.find({}).sort({ submittedAt: -1 }),
            Setting.findOne({ key: 'eval_open' })
        ]);

        // Filter out anyone who is an Admin or an Executive so they NEVER appear in the user/student list
        const adminUsernames = new Set(admins.map(a => (a.username || '').toLowerCase()));
        const adminNames = new Set(admins.map(a => (a.name || '').toLowerCase()));
        const execIdentifiers = new Set(executives.map(e => (e.indexNumber || e.username || '').toLowerCase()).filter(Boolean));
        const execNames = new Set(executives.map(e => (e.name || '').toLowerCase()));

        const filteredUsers = rawUsers.filter(u => {
            const idx = (u.indexNumber || '').toLowerCase();
            const nm = (u.name || '').toLowerCase();
            if (adminUsernames.has(idx) || adminNames.has(nm)) return false;
            if (execIdentifiers.has(idx) || execNames.has(nm)) return false;
            return true;
        });

        // Clean up duplicate User documents in MongoDB for admins & executives
        const toDeleteIds = rawUsers
            .filter(u => {
                const idx = (u.indexNumber || '').toLowerCase();
                const nm = (u.name || '').toLowerCase();
                return adminUsernames.has(idx) || adminNames.has(nm) || execIdentifiers.has(idx) || execNames.has(nm);
            })
            .map(u => u._id);
        if (toDeleteIds.length > 0) {
            User.deleteMany({ _id: { $in: toDeleteIds } }).catch(() => {});
        }

        // Anonymity masking for evaluations
        const evals = rawEvals.map(e => {
            const obj = e.toObject();
            obj.id = obj._id.toString();
            if (obj.isAnonymous && !isSuper) {
                obj.userName = 'Anonymous Student';
                obj.userId = '***';
            }
            return obj;
        });

        res.json({
            success: true,
            users: filteredUsers.map(u => ({ id: u._id, name: u.name, indexNumber: u.indexNumber, createdAt: u.createdAt })),
            admins: admins.map(a => ({ id: a._id, name: a.name, username: a.username, role: a.role, createdAt: a.createdAt })),
            executives: executives.map(ex => ({ id: ex._id.toString(), name: ex.name, portfolio: ex.portfolio, username: ex.username, indexNumber: ex.indexNumber, createdAt: ex.createdAt })),
            evaluations: evals,
            isEvaluationOpen: evalSetting ? evalSetting.value : true
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 2. Auth: Student Registration
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, indexNumber, password } = req.body;
        if (!name || !indexNumber || !password) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }
        const idx = indexNumber.trim();
        const existing = await User.findOne({ indexNumber: { $regex: new RegExp(`^${idx}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Index number already registered.' });
        }
        const existingAdmin = await Admin.findOne({ username: { $regex: new RegExp(`^${idx}$`, 'i') } });
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'This index number belongs to an administrator account. Please log in directly.' });
        }
        const existingExec = await Executive.findOne({ 
            $or: [
                { username: { $regex: new RegExp(`^${idx}$`, 'i') } },
                { indexNumber: { $regex: new RegExp(`^${idx}$`, 'i') } }
            ]
        });
        if (existingExec) {
            return res.status(400).json({ success: false, message: 'This index number belongs to an SRC executive account. Please log in directly.' });
        }

        const newUser = new User({ name: name.trim(), indexNumber: idx, password });
        await newUser.save();
        res.json({ success: true, user: { id: newUser._id, name: newUser.name, indexNumber: newUser.indexNumber } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Auth: Login (Unified for Students, Admins, and Executives)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { indexNumber, password } = req.body;
        const u = (indexNumber || '').trim();
        const p = (password || '').trim();

        // 1. Is this an Admin?
        const admin = await Admin.findOne({
            username: { $regex: new RegExp(`^${u}$`, 'i') },
            password: p
        });
        if (admin) {
            return res.json({ 
                success: true, 
                role: 'admin', 
                admin: { id: admin._id, name: admin.name, username: admin.username, role: admin.role } 
            });
        }

        // 2. Is this an Executive?
        const exec = await Executive.findOne({
            $or: [
                { username: { $regex: new RegExp(`^${u}$`, 'i') } },
                { indexNumber: { $regex: new RegExp(`^${u}$`, 'i') } },
                { name: { $regex: new RegExp(`^${u}$`, 'i') } }
            ],
            password: p
        });
        if (exec) {
            const linkedAdmin = await Admin.findOne({
                $or: [
                    { username: { $regex: new RegExp(`^${u}$`, 'i') } },
                    { name: { $regex: new RegExp(`^${exec.name}$`, 'i') } }
                ]
            });
            const adminObj = {
                id: exec._id.toString(),
                name: exec.name,
                username: exec.username || exec.indexNumber || exec.name,
                role: linkedAdmin ? linkedAdmin.role : 'Executive'
            };
            return res.json({
                success: true,
                role: 'executive',
                admin: adminObj,
                executive: exec
            });
        }

        // 3. Regular student
        const user = await User.findOne({ 
            indexNumber: { $regex: new RegExp(`^${u}$`, 'i') }, 
            password: p 
        });
        if (user) {
            // Verify they are not an admin or exec
            const isAdmin = await Admin.findOne({ username: { $regex: new RegExp(`^${user.indexNumber}$`, 'i') } });
            if (isAdmin) {
                return res.json({
                    success: true,
                    role: 'admin',
                    admin: { id: isAdmin._id, name: isAdmin.name, username: isAdmin.username, role: isAdmin.role }
                });
            }
            const isExec = await Executive.findOne({
                $or: [
                    { username: { $regex: new RegExp(`^${user.indexNumber}$`, 'i') } },
                    { indexNumber: { $regex: new RegExp(`^${user.indexNumber}$`, 'i') } },
                    { name: { $regex: new RegExp(`^${user.name}$`, 'i') } }
                ]
            });
            if (isExec) {
                return res.json({
                    success: true,
                    role: 'executive',
                    admin: { id: isExec._id.toString(), name: isExec.name, username: isExec.username || isExec.indexNumber || isExec.name, role: 'Executive' }
                });
            }

            return res.json({ success: true, role: 'student', user: { id: user._id, name: user.name, indexNumber: user.indexNumber } });
        }

        return res.status(401).json({ success: false, message: 'Invalid index number or password.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 4. Auth: Admin Login
app.post('/api/auth/admin-login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const u = (username || '').trim();
        const p = (password || '').trim();
        const admin = await Admin.findOne({ 
            username: { $regex: new RegExp(`^${u}$`, 'i') }, 
            password: p 
        });
        if (admin) {
            return res.json({ success: true, admin: { id: admin._id, name: admin.name, username: admin.username, role: admin.role } });
        }

        // Also allow Executive to log in directly
        const exec = await Executive.findOne({
            $or: [
                { username: { $regex: new RegExp(`^${u}$`, 'i') } },
                { indexNumber: { $regex: new RegExp(`^${u}$`, 'i') } },
                { name: { $regex: new RegExp(`^${u}$`, 'i') } }
            ],
            password: p
        });
        if (exec) {
            return res.json({ 
                success: true, 
                admin: { 
                    id: exec._id.toString(), 
                    name: exec.name, 
                    username: exec.username || exec.indexNumber || exec.name, 
                    role: 'Executive' 
                } 
            });
        }

        return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 5. Evaluations: Submit
app.post('/api/evaluations', async (req, res) => {
    try {
        const evalSetting = await Setting.findOne({ key: 'eval_open' });
        if (evalSetting && evalSetting.value === false) {
            return res.status(403).json({ success: false, message: 'Evaluations are currently closed.' });
        }

        const data = req.body;
        const existing = await Evaluation.findOne({ userId: data.userId });
        if (existing) {
            return res.status(400).json({ success: false, message: 'You have already submitted an evaluation. Use edit instead.' });
        }

        const newEval = new Evaluation({
            ...data,
            isEdited: false,
            editCount: 0,
            submittedAt: new Date()
        });
        await newEval.save();
        res.json({ success: true, evaluation: newEval });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 6. Evaluations: 1-Time Edit / Update
app.put('/api/evaluations/:userId', async (req, res) => {
    try {
        const evalSetting = await Setting.findOne({ key: 'eval_open' });
        if (evalSetting && evalSetting.value === false) {
            return res.status(403).json({ success: false, message: 'Evaluations are currently closed.' });
        }

        const { userId } = req.params;
        const existing = await Evaluation.findOne({ userId });
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Evaluation not found.' });
        }

        if (existing.isEdited || existing.editCount >= 1) {
            return res.status(403).json({ success: false, message: 'You have already used your 1-time revision permission. Further edits are not allowed.' });
        }

        Object.assign(existing, req.body);
        existing.isEdited = true;
        existing.editCount = (existing.editCount || 0) + 1;
        existing.updatedAt = new Date();
        await existing.save();

        res.json({ success: true, evaluation: existing });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 7. Evaluations: Get User's Own Evaluation
app.get('/api/evaluations/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const ev = await Evaluation.findOne({ userId });
        res.json({ success: true, evaluation: ev });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 8. Evaluations: Reset All (Super Admin only)
app.delete('/api/evaluations', async (req, res) => {
    try {
        await Evaluation.deleteMany({});
        res.json({ success: true, message: 'All evaluations cleared from MongoDB.' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 9. Executives CRUD
app.post('/api/executives', async (req, res) => {
    try {
        const { name, portfolio, indexNumber, username, password } = req.body;
        const n = (name || '').trim();
        const p_pos = (portfolio || '').trim();
        const idx = (indexNumber || username || '').trim();

        let finalPassword = password ? password.trim() : '';
        if (!finalPassword) {
            // Find existing student or admin to maintain password
            const existingStudent = await User.findOne({
                $or: [
                    ...(idx ? [{ indexNumber: { $regex: new RegExp(`^${idx}$`, 'i') } }] : []),
                    ...(n ? [{ name: { $regex: new RegExp(`^${n}$`, 'i') } }] : [])
                ]
            });
            if (existingStudent && existingStudent.password) {
                finalPassword = existingStudent.password;
            } else {
                const existingAdmin = await Admin.findOne({
                    $or: [
                        ...(idx ? [{ username: { $regex: new RegExp(`^${idx}$`, 'i') } }] : []),
                        ...(n ? [{ name: { $regex: new RegExp(`^${n}$`, 'i') } }] : [])
                    ]
                });
                if (existingAdmin && existingAdmin.password) {
                    finalPassword = existingAdmin.password;
                }
            }
        }

        const exec = new Executive({ 
            name: n, 
            portfolio: p_pos,
            indexNumber: idx,
            username: idx,
            password: finalPassword
        });
        await exec.save();

        // Remove from User collection if was a student
        if (idx || n) {
            await User.deleteMany({
                $or: [
                    ...(idx ? [{ indexNumber: { $regex: new RegExp(`^${idx}$`, 'i') } }] : []),
                    ...(n ? [{ name: { $regex: new RegExp(`^${n}$`, 'i') } }] : [])
                ]
            });
        }

        res.json({ 
            success: true, 
            executive: { 
                id: exec._id.toString(), 
                name: exec.name, 
                portfolio: exec.portfolio,
                indexNumber: exec.indexNumber,
                username: exec.username
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/executives/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, portfolio, indexNumber, username, password } = req.body;
        const updates = {};
        if (name) updates.name = name;
        if (portfolio) updates.portfolio = portfolio;
        if (indexNumber) updates.indexNumber = indexNumber;
        if (username) updates.username = username;
        if (password) updates.password = password;
        await Executive.findByIdAndUpdate(id, updates);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/executives/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await Executive.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 10. Student Management & Password Reset
app.put('/api/students/:indexNumber', async (req, res) => {
    try {
        const { indexNumber } = req.params;
        const { name, password } = req.body;
        const updates = { name };
        if (password) updates.password = password;
        await User.findOneAndUpdate({ indexNumber }, updates);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/students/:indexNumber', async (req, res) => {
    try {
        const { indexNumber } = req.params;
        await User.findOneAndDelete({ indexNumber });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 11. Admin Management & Password Reset
app.post('/api/admins', async (req, res) => {
    try {
        const { name, username, password, role } = req.body;
        const u = (username || '').trim();
        const n = (name || '').trim();
        if (!u || !n) {
            return res.status(400).json({ success: false, message: 'Name and username are required.' });
        }
        const existing = await Admin.findOne({ username: { $regex: new RegExp(`^${u}$`, 'i') } });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Username already exists as an admin.' });
        }

        let finalPassword = password ? password.trim() : '';
        if (!finalPassword) {
            // Find existing student or executive by index number or name to maintain their password
            const existingStudent = await User.findOne({
                $or: [
                    { indexNumber: { $regex: new RegExp(`^${u}$`, 'i') } },
                    { name: { $regex: new RegExp(`^${u}$`, 'i') } },
                    { name: { $regex: new RegExp(`^${n}$`, 'i') } }
                ]
            });
            if (existingStudent && existingStudent.password) {
                finalPassword = existingStudent.password;
            } else {
                const existingExec = await Executive.findOne({
                    $or: [
                        { indexNumber: { $regex: new RegExp(`^${u}$`, 'i') } },
                        { username: { $regex: new RegExp(`^${u}$`, 'i') } },
                        { name: { $regex: new RegExp(`^${u}$`, 'i') } },
                        { name: { $regex: new RegExp(`^${n}$`, 'i') } }
                    ]
                });
                if (existingExec && existingExec.password) {
                    finalPassword = existingExec.password;
                }
            }
        }

        if (!finalPassword) {
            return res.status(400).json({ success: false, message: 'Password is required because no registered student or executive was found with this username or name.' });
        }

        const newAdmin = new Admin({ name: n, username: u, password: finalPassword, role: role || 'Admin' });
        await newAdmin.save();

        // Remove from User collection if was a student (admins should not be in the user list)
        await User.deleteMany({
            $or: [
                { indexNumber: { $regex: new RegExp(`^${u}$`, 'i') } },
                { name: { $regex: new RegExp(`^${n}$`, 'i') } }
            ]
        });

        res.json({ success: true, admin: { id: newAdmin._id.toString(), name: newAdmin.name, username: newAdmin.username, role: newAdmin.role } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/admins/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { name, password, role } = req.body;
        const updates = { name, role };
        if (password) updates.password = password;
        if (username.toLowerCase() === 'boafokyei3@gmail.com') updates.role = 'Super Admin';
        await Admin.findOneAndUpdate({ username: { $regex: new RegExp(`^${username}$`, 'i') } }, updates);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.delete('/api/admins/:username', async (req, res) => {
    try {
        const { username } = req.params;
        if (username.toLowerCase() === 'boafokyei3@gmail.com') {
            return res.status(403).json({ success: false, message: 'Cannot delete Super Admin.' });
        }
        await Admin.findOneAndDelete({ username: { $regex: new RegExp(`^${username}$`, 'i') } });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 12. Toggle Submissions Switch
app.post('/api/settings/toggle-evaluation', async (req, res) => {
    try {
        const { open } = req.body;
        await Setting.findOneAndUpdate({ key: 'eval_open' }, { value: !!open }, { upsert: true });
        res.json({ success: true, isOpen: !!open });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ───────────────────────────────────────────
// START SERVER
// ───────────────────────────────────────────

if (!MONGODB_URI) {
    console.error('❌ FATAL: MONGODB_URI is not set! Please add MONGODB_URI in Render Environment variables.');
    process.exit(1);
}

console.log('📡 Connecting to MongoDB Atlas...');

mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000
})
.then(async () => {
    console.log('✅ Connected to MongoDB Atlas Cluster!');
    await seedSuperAdmin();
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 CCHN SRC Evaluation Server running live on port ${PORT}`);
    });
})
.catch(err => {
    console.error('❌ MongoDB Connection Failure:', err.message);
    if (err.name === 'MongooseServerSelectionError') {
        console.error('👉 TIP: Check MongoDB Atlas -> Network Access. Make sure 0.0.0.0/0 (Allow Access from Anywhere) is active!');
    }
    process.exit(1);
});

