import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Project from '../models/Project.js';
import Tree from '../models/Tree.js';
import Offering from '../models/Offering.js';
import User from '../models/User.js';

dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

const seedData = async () => {
    await connectDB();

    console.log('Seeding database...');

    // Create admin user
    const existingAdmin = await User.findOne({ username: 'holger' });
    if (!existingAdmin) {
        await User.create({
            username: 'holger',
            email: 'holger@goplantatree.org',
            passwordHash: 'changeme',
            role: 'admin',
            displayName: 'Holger Engels'
        });
        console.log('Admin user created (holger / changeme)');
    }

    // ─── Projects ───────────────────────────────────────────────────────

    let projectUlm = await Project.findOne({ slug: 'klimabaumaktion-ulm' });
    if (!projectUlm) {
        projectUlm = await Project.create({
            slug: 'klimabaumaktion-ulm',
            name: 'Klimabaumaktion Ulm',
            text: 'Die Klimabaumaktion Ulm verschenkt klimaresiliente Bäume an Bürgerinnen und Bürger der Stadt Ulm.',
            orderPeriod: { start: new Date('2025-09-01'), end: new Date('2025-10-31') },
            active: true,
            orderFormConfig: 'klimabaumaktion-order',
            content: {
                team: [
                    { name: 'Holger Engels', role: 'Vorstand, IT' },
                    { name: 'Andy Bayer', role: 'Vorstand, Baumexperte' },
                    { name: 'Joshi', role: 'Vorstand, PR' },
                    { name: 'Jule', role: 'Kreatives' },
                    { name: 'Nathan', role: 'Mitarbeit' }
                ],
                sponsors: [
                    { name: 'Stadt Ulm', url: 'https://ulm.de' },
                    { name: 'BUND Ulm', url: 'https://bund-ulm.de' },
                    { name: 'Einstein-Marathon', url: 'https://einstein-marathon.de' },
                    { name: 'Lokale Agenda Ulm 21', url: 'https://agenda21.ulm.de' }
                ],
                timeline: [
                    { date: '2025-09-01', label: 'Bestellstart', description: 'Ab jetzt können Bäume bestellt werden', status: 'upcoming' },
                    { date: '2025-10-31', label: 'Bestellende', description: 'Letzter Tag für Bestellungen', status: 'upcoming' },
                    { date: '2025-11-15', label: 'Ausgabe', description: 'Baumausgabe am Messegelände Ulm', status: 'upcoming' }
                ]
            }
        });
        console.log('Project "Klimabaumaktion Ulm" created');
    }

    let projectBC = await Project.findOne({ slug: '100-baeume-bc' });
    if (!projectBC) {
        projectBC = await Project.create({
            slug: '100-baeume-bc',
            name: '100 Bäume BC',
            text: '100 Bäume für Biberach — ein Projekt zur Begrünung der Stadt.',
            orderPeriod: { start: new Date('2025-10-01'), end: new Date('2025-11-30') },
            active: true,
            orderFormConfig: '100-baeume-bc-order',
            content: {
                team: [],
                sponsors: [],
                timeline: [
                    { date: '2025-10-01', label: 'Bestellstart', status: 'upcoming' },
                    { date: '2025-11-30', label: 'Bestellende', status: 'upcoming' },
                    { date: '2025-12-15', label: 'Ausgabe', status: 'upcoming' }
                ]
            }
        });
        console.log('Project "100 Bäume BC" created');
    }

    // ─── Tree Profiles (Baumsteckbriefe, project-independent) ───────────

    const existingTrees = await Tree.countDocuments();
    let treeMap = {};  // shortName → _id mapping for offerings

    if (existingTrees === 0) {
        const treeProfiles = [
            { name: "Feldahorn \u2018Elsrijk\u2019", shortName: 'feldahorn', category: 'Laubbaum', height: 'bis 12m', width: 'bis 6m', flowering: 'Mai', sortOrder: 1 },
            { name: 'Lederblättriger Weißdorn / Apfeldorn', shortName: 'apfeldorn', category: 'Laubbaum', height: 'bis 8m', sortOrder: 2 },
            { name: 'Echte Mispel', shortName: 'mispel', category: 'Laubbaum', height: 'bis 5m', sortOrder: 3 },
            { name: 'Gemeine Felsenbirne', shortName: 'felsenbirne', category: 'Laubbaum', height: 'bis 5m', sortOrder: 4 },
            { name: 'Chinesischer Judasbaum', shortName: 'judasbaum', category: 'Laubbaum', notice: 'Jungbäume benötigen für den Stamm einen Schutz gegen Frostrisse.', sortOrder: 5 },
            { name: 'Weißer Maulbeerbaum', shortName: 'maulbeerbaum', category: 'Laubbaum', sortOrder: 6 },
            { name: 'Wildapfel', shortName: 'wildapfel', category: 'Laubbaum', sortOrder: 7 },
            { name: 'Kleinfruchtiger Zierapfel', shortName: 'zierapfel', category: 'Laubbaum', sortOrder: 8 },
            { name: 'Echte Mehlbeere', shortName: 'aria', category: 'Laubbaum', sortOrder: 9 },
            { name: 'Mehlbeere / Eberesche', shortName: 'dodong', category: 'Laubbaum', sortOrder: 10 },
            { name: 'Pyramiden-Hainbuche', shortName: 'hainbuche', category: 'Laubbaum', sortOrder: 11 },
            { name: 'Säulen-Tulpenbaum', shortName: 'tulpenbaum', category: 'Laubbaum', notice: 'Regelmäßige und tiefgründige Wässerung in Trockenperioden wichtig.', sortOrder: 12 },
            { name: 'Säulen-Eiche', shortName: 'säuleneiche', category: 'Laubbaum', sortOrder: 13 },
            { name: 'Säulen-Amberbaum', shortName: 'säulenamber', category: 'Laubbaum', notice: 'Jungbäume benötigen für den Stamm einen Schutz gegen Frostrisse.', sortOrder: 14 },
            { name: 'Amberbaum Worplesdon', shortName: 'worplesdon', category: 'Laubbaum', notice: 'Jungbäume benötigen für den Stamm einen Schutz gegen Frostrisse.', sortOrder: 15 },
            { name: 'Winterlinde', shortName: 'winterlinde', category: 'Laubbaum', notice: 'Wird bis zu 25 m hoch und kann Durchmesser von 12 m erreichen.', sortOrder: 16 },
            { name: 'Zerr-Eiche', shortName: 'zerreiche', category: 'Laubbaum', notice: 'Wird bis zu 35 m hoch und kann Durchmesser von 25 m erreichen.', sortOrder: 17 },
            { name: 'Herbstapfel Alkmene', shortName: 'alkmene', category: 'Obstbaum', sortOrder: 18 },
            { name: 'Winterapfel Roter Boskoop', shortName: 'boskoop', category: 'Obstbaum', sortOrder: 19 },
            { name: 'Winterapfel Topaz', shortName: 'topaz', category: 'Obstbaum', sortOrder: 20 },
            { name: 'Herbstapfel Geheimrat Dr. Oldenburg', shortName: 'geheimrat', category: 'Obstbaum', sortOrder: 21 },
            { name: 'Herbstbirne Clapps Liebling', shortName: 'liebling', category: 'Obstbaum', sortOrder: 22 },
            { name: 'Birne Gute Luise v. Avranches', shortName: 'luise', category: 'Obstbaum', sortOrder: 23 },
            { name: 'Sommerbirne Williams Christ', shortName: 'williams', category: 'Obstbaum', sortOrder: 24 },
            { name: 'Birne Conference', shortName: 'conference', category: 'Obstbaum', sortOrder: 25 },
            { name: 'Ulmer Butterbirne', shortName: 'butterbirne', category: 'Obstbaum', sortOrder: 26 },
            { name: 'Konstantinopeler Apfelquitte', shortName: 'quitte', category: 'Obstbaum', sortOrder: 27 },
            { name: 'Pflaume Reneklode', shortName: 'reneklode', category: 'Obstbaum', sortOrder: 28 },
            { name: 'Blutpflaume Trailblazer', shortName: 'blutpflaume', category: 'Obstbaum', sortOrder: 29 },
            { name: 'Hauszwetschge', shortName: 'hauszwetschge', category: 'Obstbaum', sortOrder: 30 },
            { name: 'Marone', shortName: 'marone', category: 'Obstbaum', sortOrder: 31 }
        ];

        const inserted = await Tree.insertMany(treeProfiles);
        console.log(`${inserted.length} tree profiles seeded`);

        // Build shortName → _id map
        for (const t of inserted) {
            treeMap[t.shortName] = t._id;
        }
    } else {
        // Load existing trees into map
        const allTrees = await Tree.find();
        for (const t of allTrees) {
            treeMap[t.shortName] = t._id;
        }
    }

    // ─── Offerings (bestellbare Angebote, project-specific) ─────────────

    const existingOfferingsUlm = await Offering.countDocuments({ project: projectUlm._id });
    if (existingOfferingsUlm === 0) {
        const ulmOfferings = [
            // Laubbäume
            { name: "Feldahorn \u2018Elsrijk\u2019", tree: treeMap['feldahorn'], category: 'Laubbaum', sortOrder: 1 },
            { name: 'Lederblättriger Weißdorn / Apfeldorn', tree: treeMap['apfeldorn'], category: 'Laubbaum', sortOrder: 2 },
            { name: 'Echte Mispel', tree: treeMap['mispel'], category: 'Laubbaum', sortOrder: 3 },
            { name: 'Gemeine Felsenbirne', tree: treeMap['felsenbirne'], category: 'Laubbaum', sortOrder: 4 },
            { name: 'Chinesischer Judasbaum', tree: treeMap['judasbaum'], category: 'Laubbaum', notice: 'Jungbäume benötigen Stammschutz gegen Frostrisse.', sortOrder: 5 },
            { name: 'Weißer Maulbeerbaum', tree: treeMap['maulbeerbaum'], category: 'Laubbaum', sortOrder: 6 },
            { name: 'Wildapfel', tree: treeMap['wildapfel'], category: 'Laubbaum', sortOrder: 7 },
            { name: 'Kleinfruchtiger Zierapfel', tree: treeMap['zierapfel'], category: 'Laubbaum', sortOrder: 8 },
            { name: 'Echte Mehlbeere', tree: treeMap['aria'], category: 'Laubbaum', sortOrder: 9 },
            { name: 'Mehlbeere / Eberesche', tree: treeMap['dodong'], category: 'Laubbaum', sortOrder: 10 },
            { name: 'Pyramiden-Hainbuche', tree: treeMap['hainbuche'], category: 'Laubbaum', sortOrder: 11 },
            { name: 'Säulen-Tulpenbaum', tree: treeMap['tulpenbaum'], category: 'Laubbaum', sortOrder: 12 },
            { name: 'Säulen-Eiche', tree: treeMap['säuleneiche'], category: 'Laubbaum', sortOrder: 13 },
            { name: 'Säulen-Amberbaum', tree: treeMap['säulenamber'], category: 'Laubbaum', sortOrder: 14 },
            { name: 'Amberbaum Worplesdon', tree: treeMap['worplesdon'], category: 'Laubbaum', sortOrder: 15 },
            { name: 'Winterlinde', tree: treeMap['winterlinde'], category: 'Laubbaum', sortOrder: 16 },
            { name: 'Zerr-Eiche', tree: treeMap['zerreiche'], category: 'Laubbaum', sortOrder: 17 },
            // Halbstamm-Obstbäume
            { name: 'Herbstapfel Alkmene (Halbstamm)', tree: treeMap['alkmene'], category: 'Halbstamm-Obstbaum', notice: 'Obstbäume sind sehr pflegeintensiv.', sortOrder: 18 },
            { name: 'Winterapfel Roter Boskoop (Halbstamm)', tree: treeMap['boskoop'], category: 'Halbstamm-Obstbaum', notice: 'Obstbäume sind sehr pflegeintensiv.', sortOrder: 19 },
            { name: 'Winterapfel Topaz (Halbstamm)', tree: treeMap['topaz'], category: 'Halbstamm-Obstbaum', notice: 'Obstbäume sind sehr pflegeintensiv.', sortOrder: 20 },
            { name: 'Herbstapfel Geheimrat Dr. Oldenburg (Halbstamm)', tree: treeMap['geheimrat'], category: 'Halbstamm-Obstbaum', sortOrder: 21 },
            { name: 'Herbstbirne Clapps Liebling (Halbstamm)', tree: treeMap['liebling'], category: 'Halbstamm-Obstbaum', sortOrder: 22 },
            { name: 'Birne Gute Luise v. Avranches (Halbstamm)', tree: treeMap['luise'], category: 'Halbstamm-Obstbaum', sortOrder: 23 },
            { name: 'Sommerbirne Williams Christ (Halbstamm)', tree: treeMap['williams'], category: 'Halbstamm-Obstbaum', sortOrder: 24 },
            { name: 'Birne Conference (Halbstamm)', tree: treeMap['conference'], category: 'Halbstamm-Obstbaum', sortOrder: 25 },
            { name: 'Ulmer Butterbirne (Halbstamm)', tree: treeMap['butterbirne'], category: 'Halbstamm-Obstbaum', sortOrder: 26 },
            // Hochstamm-Obstbäume
            { name: 'Herbstapfel Alkmene (Hochstamm)', tree: treeMap['alkmene'], category: 'Hochstamm-Obstbaum', sortOrder: 27 },
            { name: 'Winterapfel Roter Boskoop (Hochstamm)', tree: treeMap['boskoop'], category: 'Hochstamm-Obstbaum', sortOrder: 28 },
            { name: 'Winterapfel Topaz (Hochstamm)', tree: treeMap['topaz'], category: 'Hochstamm-Obstbaum', sortOrder: 29 },
            { name: 'Konstantinopeler Apfelquitte (Hochstamm)', tree: treeMap['quitte'], category: 'Hochstamm-Obstbaum', sortOrder: 30 },
            { name: 'Pflaume Reneklode (Hochstamm)', tree: treeMap['reneklode'], category: 'Hochstamm-Obstbaum', sortOrder: 31 },
            { name: 'Blutpflaume Trailblazer (Hochstamm)', tree: treeMap['blutpflaume'], category: 'Hochstamm-Obstbaum', sortOrder: 32 },
            { name: 'Hauszwetschge (Hochstamm)', tree: treeMap['hauszwetschge'], category: 'Hochstamm-Obstbaum', sortOrder: 33 },
            { name: 'Marone (Hochstamm)', tree: treeMap['marone'], category: 'Hochstamm-Obstbaum', sortOrder: 34 },
        ];

        await Offering.insertMany(ulmOfferings.map(o => ({ ...o, project: projectUlm._id, available: true })));
        console.log(`${ulmOfferings.length} offerings seeded for "Klimabaumaktion Ulm"`);
    }

    const existingOfferingsBC = await Offering.countDocuments({ project: projectBC._id });
    if (existingOfferingsBC === 0) {
        const bcOfferings = [
            { name: 'Feldahorn', tree: treeMap['feldahorn'], category: 'Laubbaum', sortOrder: 1 },
            { name: 'Wildapfel', tree: treeMap['wildapfel'], category: 'Laubbaum', sortOrder: 2 },
            { name: 'Marone', tree: treeMap['marone'], category: 'Obstbaum', sortOrder: 3 },
        ];

        await Offering.insertMany(bcOfferings.map(o => ({ ...o, project: projectBC._id, available: true })));
        console.log(`${bcOfferings.length} placeholder offerings seeded for "100 Bäume BC"`);
    }

    console.log('Seed complete!');
    await mongoose.disconnect();
};

seedData().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
