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

        const [users, admins, executives, rawEvals, evalSetting] = await Promise.all([
            User.find({}).sort({ createdAt: -1 }),
            Admin.find({}).sort({ createdAt: -1 }),
            Executive.find({}).sort({ createdAt: -1 }),
            Evaluation.find({}).sort({ submittedAt: -1 }),
            Setting.findOne({ key: 'eval_open' })
        ]);

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
            users: users.map(u => ({ id: u._id, name: u.name, indexNumber: u.indexNumber, createdAt: u.createdAt })),
            admins: admins.map(a => ({ id: a._id, name: a.name, username: a.username, role: a.role, createdAt: a.createdAt })),
            executives: executives.map(ex => ({ id: ex._id.toString(), name: ex.name, portfolio: ex.portfolio, createdAt: ex.createdAt })),
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
        const existing = await User.findOne({ indexNumber: indexNumber.trim() });
        if (existing) {
            return res.status(400).json({ success: false, message: 'Index number already registered.' });
        }
        const newUser = new User({ name: name.trim(), indexNumber: indexNumber.trim(), password });
        await newUser.save();
        res.json({ success: true, user: { id: newUser._id, name: newUser.name, indexNumber: newUser.indexNumber } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// 3. Auth: Student Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { indexNumber, password } = req.body;
        const user = await User.findOne({ 
            indexNumber: (indexNumber || '').trim(), 
            password: password 
        });
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid index number or password.' });
        }
        res.json({ success: true, user: { id: user._id, name: user.name, indexNumber: user.indexNumber } });
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
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
        }
        res.json({ success: true, admin: { id: admin._id, name: admin.name, username: admin.username, role: admin.role } });
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
        const { name, portfolio } = req.body;
        const exec = new Executive({ name, portfolio });
        await exec.save();
        res.json({ success: true, executive: { id: exec._id.toString(), name: exec.name, portfolio: exec.portfolio } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

app.put('/api/executives/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, portfolio } = req.body;
        await Executive.findByIdAndUpdate(id, { name, portfolio });
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
            // Find existing student by index number or name to maintain their password
            const existingStudent = await User.findOne({
                $or: [
                    { indexNumber: { $regex: new RegExp(`^${u}$`, 'i') } },
                    { name: { $regex: new RegExp(`^${u}$`, 'i') } },
                    { name: { $regex: new RegExp(`^${n}$`, 'i') } }
                ]
            });
            if (existingStudent && existingStudent.password) {
                finalPassword = existingStudent.password;
            }
        }

        if (!finalPassword) {
            return res.status(400).json({ success: false, message: 'Password is required because no registered student was found with this username or name.' });
        }

        const newAdmin = new Admin({ name: n, username: u, password: finalPassword, role: role || 'Admin' });
        await newAdmin.save();
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

