require('dotenv').config();
const mongoose = require('mongoose');

const uri = process.env.MONGODB_URI;

console.log('Connecting to MongoDB Atlas...');

mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
    .then(() => {
        console.log('SUCCESS: Connected to MongoDB Atlas cluster0.fftruuf.mongodb.net!');
        console.log('Database name:', mongoose.connection.name);
        process.exit(0);
    })
    .catch(err => {
        console.error('ERROR connecting to MongoDB:', err.message);
        process.exit(1);
    });
