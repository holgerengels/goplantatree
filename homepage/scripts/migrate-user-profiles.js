// Migration: Migrate single 'profile' field to 'profiles' array field for all users.
//
// How to run locally in development Docker container:
//   docker exec -i mongodb mongosh goplantatree --username admin --password password --authenticationDatabase admin < ./scripts/migrate-user-profiles.js
//
// How to run on the production server inside the MongoDB container:
//   docker exec -i goplantatree-mongo mongosh goplantatree < ./migrate-user-profiles.js

const dbName = typeof db !== 'undefined' ? db.getName() : 'goplantatree';
print(`Starting profile migration for database: ${dbName}...`);

let migratedCount = 0;
let skippedCount = 0;

db.users.find().forEach(user => {
    if (user.profile) {
        // Check if profiles array already contains this profile
        const hasProfile = user.profiles && user.profiles.some(p => String(p) === String(user.profile));
        
        if (!hasProfile) {
            const newProfiles = user.profiles ? [...user.profiles] : [];
            newProfiles.push(user.profile);
            
            db.users.updateOne(
                { _id: user._id },
                { $set: { profiles: newProfiles } }
            );
            migratedCount++;
        } else {
            skippedCount++;
        }
    } else {
        skippedCount++;
    }
});

print(`Migration complete.`);
print(`- Migrated (added legacy profile to profiles array): ${migratedCount} users`);
print(`- Skipped (already migrated or no legacy profile): ${skippedCount} users`);
