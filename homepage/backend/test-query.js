import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const treeSchema = new mongoose.Schema({}, { strict: false });
const Tree = mongoose.model('Tree', treeSchema);

async function run() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/goplantatree');
    const trees = await Tree.find({}, 'name location growthForm');
    const locations = new Set();
    const growthForms = new Set();
    trees.forEach(t => {
        if(t.location) locations.add(t.location);
        if(t.growthForm) growthForms.add(t.growthForm);
        console.log(`- ${t.name} | L: ${t.location} | G: ${t.growthForm}`);
    });
    console.log('\n--- Unique Locations ---');
    console.log(Array.from(locations));
    console.log('\n--- Unique Growth Forms ---');
    console.log(Array.from(growthForms));
    process.exit(0);
}
run();
